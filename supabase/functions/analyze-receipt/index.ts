import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS })
  }

  try {
    const { imageUrls } = await req.json() as { imageUrls: string[] }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set")
    if (!imageUrls?.length) throw new Error("imageUrls is empty")

    // Fetch each signed URL and convert to base64
    // (Claude cannot reliably fetch private Supabase signed URLs directly)
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
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: [
              ...imageContent,
              {
                type: "text",
                text: 'ניתח את החשבונית. החזר JSON בלבד (ללא markdown) בפורמט: {"total": מספר_או_null, "store": "שם_או_null", "date": "DD/MM/YYYY_או_null", "items_count": מספר_או_null}',
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
    const text: string = claude.content[0].text
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`No JSON in Claude response: ${text}`)

    return new Response(JSON.stringify(JSON.parse(match[0])), {
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[analyze-receipt]", message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
