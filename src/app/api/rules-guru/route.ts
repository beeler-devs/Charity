import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      // Return a mock response for development
      return NextResponse.json({
        response: getMockResponse(message),
      })
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert tennis referee and rules expert. You have comprehensive knowledge of:
- The 2025 Friend at Court (USTA Official Rules)
- SACT CUP Bylaws and regulations
- ITF Rules of Tennis
- USTA League regulations

Provide clear, accurate, and concise answers to tennis rules questions. When relevant, cite specific rule numbers or sections. If a rule varies between organizations (USTA vs ITF), clarify the differences. Be helpful and educational in your responses.`,
          },
          {
            role: 'user',
            content: message,
          },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('OpenAI API error:', error)
      return NextResponse.json(
        { error: 'Failed to get response from AI' },
        { status: 500 }
      )
    }

    const data = await response.json()
    const aiResponse = data.choices[0]?.message?.content || 'Sorry, I could not generate a response.'

    return NextResponse.json({ response: aiResponse })
  } catch (error) {
    console.error('Rules Guru error:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}

// Mock responses for development without OpenAI key
function getMockResponse(question: string): string {
  const lowerQuestion = question.toLowerCase()

  if (lowerQuestion.includes('let') && lowerQuestion.includes('serve')) {
    return `A let serve occurs when:
1. The serve touches the net, strap, or band but is otherwise good
2. The serve is delivered before the receiver is ready

When a let is called, the server gets to replay that serve. There's no limit to the number of lets that can be called.

Reference: ITF Rules of Tennis, Rule 22`
  }

  if (lowerQuestion.includes('foot fault')) {
    return `A foot fault occurs when:
1. The server touches the baseline or the court before hitting the ball
2. The server touches the area outside the imaginary extension of the sideline
3. The server changes position by walking or running

The server must remain behind the baseline and between the center mark and sideline until contact with the ball.

Reference: ITF Rules of Tennis, Rule 18`
  }

  if (lowerQuestion.includes('tie') && lowerQuestion.includes('break')) {
    return `Tie-break scoring (at 6-6 in a set):
1. First to 7 points wins, with 2-point margin
2. Points are called 1, 2, 3, etc. (not love, 15, 30, 40)
3. Server serves first point from deuce court
4. Opponents alternate serves every 2 points
5. Change ends every 6 points
6. The player who served first in the tie-break receives first in the next set

Reference: ITF Rules of Tennis, Rule 5, Appendix V`
  }

  if (lowerQuestion.includes('time') && lowerQuestion.includes('point')) {
    return `Time between points:
- Maximum 25 seconds between points (from when one point ends to the next serve)
- 90 seconds during changeovers
- 120 seconds at set breaks

Violations can result in:
1. First: Warning
2. Second: Point penalty
3. Third and subsequent: Game penalty

Reference: ITF Rules of Tennis, Rule 29a`
  }

  if (lowerQuestion.includes('code') && lowerQuestion.includes('violation')) {
    return `Code violation penalties follow a progressive system:
1. First offense: Warning
2. Second offense: Point penalty
3. Third offense: Game penalty
4. Fourth offense: Default (at referee's discretion)

Common code violations include:
- Ball abuse
- Racket abuse
- Verbal abuse
- Audible obscenity
- Visible obscenity
- Coaching
- Unsportsmanlike conduct

Reference: USTA Code of Conduct`
  }

  return `I'd be happy to help with your tennis rules question about "${question}".

Based on the 2025 Friend at Court and USTA regulations, I can provide guidance on this topic. For the most accurate ruling in your specific situation, I recommend:

1. Consulting the official USTA Friend at Court document
2. Contacting your local USTA sectional office
3. Speaking with a certified referee at your facility

Is there a specific aspect of this rule you'd like me to clarify?`
}
