import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Convert ArrayBuffer → base64 string (Deno-safe, chunked to avoid stack overflow)
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 8192
  const parts: string[] = []
  for (let i = 0; i < bytes.length; i += chunkSize) {
    parts.push(String.fromCharCode(...Array.from(bytes.subarray(i, i + chunkSize))))
  }
  return btoa(parts.join(""))
}

// ── JSON cleaning + parsing ───────────────────────────────────────────────────
//
// Claude sometimes returns:
//   1. Markdown fences: ```json ... ```
//   2. Hebrew geresh marks inside strings: ק"ג  מ"ל  ג"ר
//      These look like ASCII " but break JSON.parse at that position.
//
function parseClaudeJSON(raw: string): unknown {
  // Step 1: strip markdown code fences
  let text = raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/m, "")
    .trim()

  // Step 2: extract the outermost { … } object
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    console.error("[analyze-receipt] No JSON object found. Raw response:", raw.slice(0, 500))
    throw new Error(`No JSON object in Claude response: ${raw.slice(0, 200)}`)
  }
  text = match[0]

  // Step 3: fix Hebrew geresh — replace " between Hebrew letters with '
  // e.g.  ק"ג  →  ק'ג   |   מ"ל  →  מ'ל   |   ג"ר  →  ג'ר
  text = text.replace(/([\u05D0-\u05EA])"([\u05D0-\u05EA])/g, "$1'$2")

  // Step 4: parse with detailed error logging
  try {
    return JSON.parse(text)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[analyze-receipt] JSON.parse failed:", msg)
    console.error("[analyze-receipt] Cleaned text (first 800 chars):", text.slice(0, 800))
    throw new Error(`JSON parse error — ${msg}`)
  }
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS })
  }

  try {
    const { imageUrls, purchaseId } = await req.json() as {
      imageUrls: string[]
      purchaseId?: string
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
    if (!apiKey)            throw new Error("ANTHROPIC_API_KEY not set")
    if (!imageUrls?.length) throw new Error("imageUrls is empty")

    // Fetch each signed URL and convert to base64
    const imageContent = await Promise.all(
      imageUrls.map(async (url) => {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Image fetch failed: ${res.status} ${url}`)
        const buffer = await res.arrayBuffer()
        const ct = res.headers.get("content-type") ?? "image/jpeg"
        const mediaType = ALLOWED_TYPES.includes(ct) ? ct : "image/jpeg"
        return {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: toBase64(buffer) },
        }
      }),
    )

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              ...imageContent,
              {
                type: "text",
                // Prompt in English to reduce instruction/data confusion.
                // Units: avoid abbreviations with " (e.g. use קג not ק"ג).
                text: `Analyze this receipt image. Return ONLY a valid JSON object — no markdown, no text before or after.
Schema:
{"total": <number|null>, "store": "<store name|null>", "date": "<DD/MM/YYYY|null>", "items": [{"name": "<product name>", "quantity": <number>, "unit": "<unit>", "price_per_unit": <number|null>, "total_price": <number|null>}]}
Rules:
- Use standard ASCII double-quotes only. Never use " as part of a Hebrew word inside a string.
- For units use only: יחידה, קג, ליטר, מל, גרם, יח (no abbreviations with quotes).
- Product names in Hebrew as they appear on the receipt.
- If no items are clearly visible, use "items": [].`,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Anthropic ${response.status}: ${body}`)
    }

    const claude = await response.json()
    const rawText: string = claude.content[0].text

    console.log("[analyze-receipt] Raw Claude response:", rawText.slice(0, 300))

    const result = parseClaudeJSON(rawText) as {
      total: number | null
      store: string | null
      date: string | null
      items: Array<{
        name: string
        quantity: number
        unit: string
        price_per_unit: number | null
        total_price: number | null
      }>
    }

    // ── Save items to purchase_items using service role (bypasses RLS) ──────────
    if (purchaseId && result.items?.length > 0) {
      const supabaseUrl    = Deno.env.get("APP_SUPABASE_URL")
      const serviceRoleKey = Deno.env.get("APP_SERVICE_ROLE_KEY")

      if (supabaseUrl && serviceRoleKey) {
        const supabase = createClient(supabaseUrl, serviceRoleKey)

        // Replace any existing items for this purchase
        await supabase.from("purchase_items").delete().eq("purchase_id", purchaseId)

        const { error: insertErr } = await supabase.from("purchase_items").insert(
          result.items.map(item => ({
            purchase_id:    purchaseId,
            name:           item.name,
            quantity:       Number(item.quantity) || 1,
            unit:           item.unit || "יחידה",
            price_per_unit: item.price_per_unit ?? null,
            total_price:    item.total_price ?? null,
          })),
        )

        if (insertErr) {
          console.error("[analyze-receipt] purchase_items insert failed:", insertErr.message)
        } else {
          console.log(`[analyze-receipt] saved ${result.items.length} items for purchase ${purchaseId}`)
        }
      } else {
        console.warn("[analyze-receipt] APP_SUPABASE_URL or APP_SERVICE_ROLE_KEY not set — skipping DB write")
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[analyze-receipt] fatal:", message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
