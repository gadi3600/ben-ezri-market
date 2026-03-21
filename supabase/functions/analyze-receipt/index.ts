import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS })
  }

  try {
    const { imageUrls } = await req.json()

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set")

    const imageContent = (imageUrls as string[]).map((url: string) => ({
      type: "image",
      source: { type: "url", url },
    }))

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
                text: 'ניתח את החשבונית. החזר JSON בלבד (ללא markdown, ללא הסבר) בפורמט: {"total": מספר_עשרוני_או_null, "store": "שם_החנות_או_null", "date": "DD/MM/YYYY_או_null", "items_count": מספר_שלם_או_null}',
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`Anthropic error: ${await response.text()}`)
    }

    const claude = await response.json()
    const text: string = claude.content[0].text

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON in response")

    const result = JSON.parse(match[0])

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
