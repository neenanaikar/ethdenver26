import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiKey, getAgentFromApiKey } from '@/lib/auth'
import { emitMatchEvent } from '@/lib/frames'

// POST /api/matches/[id]/ready - Signal ready for fair start
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: matchId } = await params

  // Authenticate
  const apiKey = getApiKey(req)
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
  }

  const agent = await getAgentFromApiKey(apiKey)
  if (!agent) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  const body = await req.json()
  const { agent_id } = body

  if (agent_id !== agent.id) {
    return NextResponse.json({ error: 'agent_id does not match API key' }, { status: 403 })
  }

  // Find the match
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      agent1: { select: { id: true, name: true } },
      agent2: { select: { id: true, name: true } },
    },
  })

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  // Verify agent is in this match
  const isAgent1 = match.agent1Id === agent_id
  const isAgent2 = match.agent2Id === agent_id

  if (!isAgent1 && !isAgent2) {
    return NextResponse.json({ error: 'You are not in this match' }, { status: 403 })
  }

  // Only allow ready signal during ready_check phase
  if (match.status !== 'ready_check') {
    return NextResponse.json({
      error: `Cannot signal ready in status: ${match.status}`,
      status: match.status,
    }, { status: 400 })
  }

  // Mark this agent as ready
  const updateData = isAgent1 ? { agent1Ready: true } : { agent2Ready: true }

  const updatedMatch = await prisma.match.update({
    where: { id: matchId },
    data: updateData,
    include: {
      agent1: { select: { id: true, name: true } },
      agent2: { select: { id: true, name: true } },
    },
  })

  // Check if both agents are now ready
  const bothReady = (isAgent1 ? true : updatedMatch.agent1Ready) &&
                    (isAgent2 ? true : updatedMatch.agent2Ready)

  if (bothReady) {
    // Start the match!
    const now = new Date()
    const endsAt = new Date(now.getTime() + match.timeLimitSeconds * 1000)

    const activeMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'active',
        startedAt: now,
        endsAt,
      },
      include: {
        agent1: { select: { id: true, name: true } },
        agent2: { select: { id: true, name: true } },
      },
    })

    // Emit match start event
    emitMatchEvent(matchId, 'match_start', {
      agent1: { agent_id: activeMatch.agent1!.id, name: activeMatch.agent1!.name },
      agent2: { agent_id: activeMatch.agent2!.id, name: activeMatch.agent2!.name },
      task_description: activeMatch.taskDescription,
      start_url: activeMatch.startUrl,
      target_article: activeMatch.targetArticle,
      time_limit_seconds: activeMatch.timeLimitSeconds,
      started_at: activeMatch.startedAt?.toISOString(),
      ends_at: activeMatch.endsAt?.toISOString(),
    })

    return NextResponse.json({
      status: 'active',
      message: 'Both agents ready. Match started!',
      started_at: activeMatch.startedAt?.toISOString(),
      ends_at: activeMatch.endsAt?.toISOString(),
    })
  }

  // Emit ready event so opponent knows
  emitMatchEvent(matchId, 'agent_ready', {
    agent_id: agent_id,
    agent_name: agent.name,
  })

  return NextResponse.json({
    status: 'ready_check',
    message: 'Ready signal received. Waiting for opponent to ready up.',
    you_ready: true,
    opponent_ready: isAgent1 ? updatedMatch.agent2Ready : updatedMatch.agent1Ready,
  })
}
