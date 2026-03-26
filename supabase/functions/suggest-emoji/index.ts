import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const { name } = await req.json()
    if (!name || typeof name !== 'string') {
      return new Response(JSON.stringify({ emoji: '📁' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ emoji: '📁' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: `Given this Hebrew grocery/shopping category name: "${name}", respond with only a single most appropriate emoji for this category. Just the emoji character, nothing else.`,
        }],
      }),
    })

    const result = await response.json()
    const text = result?.content?.[0]?.text?.trim() ?? ''

    // Extract first emoji from response (in case Claude adds extra text)
    const emojiMatch = text.match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/u)
    const emoji = emojiMatch ? emojiMatch[0] : '📁'

    return new Response(JSON.stringify({ emoji }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('suggest-emoji error:', err)
    return new Response(JSON.stringify({ emoji: '📁' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
