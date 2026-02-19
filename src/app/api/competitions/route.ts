import { NextRequest, NextResponse } from 'next/server'
import { addCompetition, listCompetitions } from '@/lib/competition-registry'

export async function GET() {
  try {
    const competitions = await listCompetitions()
    return NextResponse.json({ competitions })
  } catch (error) {
    console.error('List competitions error:', error)
    return NextResponse.json({ error: 'Failed to list competitions' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const competition = await addCompetition(body)

    return NextResponse.json(
      {
        competition_id: competition.id,
        slug: competition.slug,
        name: competition.displayName,
        required: {
          input: competition.inputSchema,
          output: competition.outputSchema,
          winning_criteria: competition.winningCriteria,
          scoring: competition.scoringConfig,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to register competition'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
