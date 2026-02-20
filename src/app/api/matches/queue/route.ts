import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiKey, getAgentFromApiKey } from '@/lib/auth'
import { getRandomMatchArticles } from '@/lib/wikipedia'
import { emitMatchEvent } from '@/lib/frames'

// POST /api/matches/queue - Join matchmaking queue (chess.com style)
// Agent joins queue -> waits -> paired when another agent joins -> match created
export async function POST(req: NextRequest) {
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
  const agentId = body.agent_id

  // Verify agent_id matches the authenticated agent
  if (agentId !== agent.id) {
    return NextResponse.json({ error: 'agent_id does not match API key' }, { status: 403 })
  }

  // Check if agent is already in a match
  const existingMatch = await prisma.match.findFirst({
    where: {
      OR: [
        { agent1Id: agentId, status: { in: ['ready_check', 'active'] } },
        { agent2Id: agentId, status: { in: ['ready_check', 'active'] } },
      ],
    },
  })

  if (existingMatch) {
    return NextResponse.json({
      error: 'Already in a match',
      match_id: existingMatch.id,
      status: existingMatch.status,
    }, { status: 400 })
  }

  // Check if agent is already in queue
  const existingQueueEntry = await prisma.queueEntry.findUnique({
    where: { agentId },
  })

  if (existingQueueEntry) {
    return NextResponse.json({
      status: 'queued',
      message: 'Already in queue. Waiting for opponent.',
      queue_position: await getQueuePosition(agentId),
    })
  }

  // Look for another agent waiting in queue (FIFO - first come, first served)
  const waitingEntry = await prisma.queueEntry.findFirst({
    where: {
      agentId: { not: agentId }, // Can't match with yourself
    },
    orderBy: { createdAt: 'asc' },
    include: { agent: { select: { id: true, name: true } } },
  })

  if (waitingEntry) {
    // Found a match! Create the match and remove both from queue
    const { startPath, targetTitle } = await getRandomMatchArticles()

    // Create match with both agents
    const match = await prisma.match.create({
      data: {
        agent1Id: waitingEntry.agentId,
        agent2Id: agentId,
        status: 'ready_check',
        startArticle: startPath,
        targetArticle: targetTitle,
        timeLimitSeconds: 300,
      },
      include: {
        agent1: { select: { id: true, name: true } },
        agent2: { select: { id: true, name: true } },
      },
    })

    // Remove the waiting agent from queue
    await prisma.queueEntry.delete({
      where: { id: waitingEntry.id },
    })

    // Emit match_paired event - both agents should prepare and signal ready
    emitMatchEvent(match.id, 'match_paired', {
      agent1: { agent_id: match.agent1!.id, name: match.agent1!.name },
      agent2: { agent_id: match.agent2!.id, name: match.agent2!.name },
      start_article: `https://en.wikipedia.org${match.startArticle}`,
      target_article: match.targetArticle,
      time_limit_seconds: match.timeLimitSeconds,
    })

    return NextResponse.json({
      status: 'paired',
      match_id: match.id,
      match_status: match.status,
      start_article: `https://en.wikipedia.org${match.startArticle}`,
      target_article: match.targetArticle,
      time_limit_seconds: match.timeLimitSeconds,
      opponent: {
        agent_id: match.agent1!.id,
        name: match.agent1!.name,
      },
      message: 'Paired with opponent! Call /api/matches/{id}/ready when ready to start.',
    })
  }

  // No one waiting - add this agent to the queue
  await prisma.queueEntry.create({
    data: { agentId },
  })

  return NextResponse.json({
    status: 'queued',
    message: 'Added to queue. Waiting for opponent to join.',
    queue_position: 1, // First in queue since no one else was waiting
  })
}

// GET /api/matches/queue - Check queue status
export async function GET(req: NextRequest) {
  const apiKey = getApiKey(req)
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
  }

  const agent = await getAgentFromApiKey(apiKey)
  if (!agent) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  // Check if agent is in queue
  const queueEntry = await prisma.queueEntry.findUnique({
    where: { agentId: agent.id },
  })

  if (!queueEntry) {
    // Check if they're in a match instead
    const match = await prisma.match.findFirst({
      where: {
        OR: [
          { agent1Id: agent.id, status: { in: ['ready_check', 'active'] } },
          { agent2Id: agent.id, status: { in: ['ready_check', 'active'] } },
        ],
      },
      include: {
        agent1: { select: { id: true, name: true } },
        agent2: { select: { id: true, name: true } },
      },
    })

    if (match) {
      const isAgent1 = match.agent1Id === agent.id
      const opponent = isAgent1 ? match.agent2 : match.agent1
      return NextResponse.json({
        status: 'paired',
        match_id: match.id,
        match_status: match.status,
        start_article: `https://en.wikipedia.org${match.startArticle}`,
        target_article: match.targetArticle,
        time_limit_seconds: match.timeLimitSeconds,
        opponent: opponent ? { agent_id: opponent.id, name: opponent.name } : null,
      })
    }

    return NextResponse.json({
      status: 'not_queued',
      message: 'Not in queue. Call POST /api/matches/queue to join.',
    })
  }

  return NextResponse.json({
    status: 'queued',
    queue_position: await getQueuePosition(agent.id),
    waiting_since: queueEntry.createdAt,
    message: 'Waiting for opponent.',
  })
}

// DELETE /api/matches/queue - Leave the queue
export async function DELETE(req: NextRequest) {
  const apiKey = getApiKey(req)
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
  }

  const agent = await getAgentFromApiKey(apiKey)
  if (!agent) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  const deleted = await prisma.queueEntry.deleteMany({
    where: { agentId: agent.id },
  })

  if (deleted.count === 0) {
    return NextResponse.json({
      status: 'not_queued',
      message: 'Was not in queue.',
    })
  }

  return NextResponse.json({
    status: 'left_queue',
    message: 'Successfully left the queue.',
  })
}

// Helper to get queue position
async function getQueuePosition(agentId: string): Promise<number> {
  const entry = await prisma.queueEntry.findUnique({
    where: { agentId },
  })
  if (!entry) return 0

  const ahead = await prisma.queueEntry.count({
    where: { createdAt: { lt: entry.createdAt } },
  })
  return ahead + 1
}
