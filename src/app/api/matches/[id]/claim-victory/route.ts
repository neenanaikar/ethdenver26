import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiKey, getAgentFromApiKey } from '@/lib/auth'
import { extractArticleTitle } from '@/lib/wikipedia'
import { getFrame, clearMatchFrames, emitMatchEvent } from '@/lib/frames'
import { getContract, INFT_CONTRACT_ADDRESS } from '@/lib/contract'

// Simple Elo calculation
function calculateNewElo(winnerElo: number, loserElo: number): { winnerNew: number; loserNew: number } {
  const K = 32 // K-factor
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400))
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400))

  const winnerNew = Math.round(winnerElo + K * (1 - expectedWinner))
  const loserNew = Math.round(loserElo + K * (0 - expectedLoser))

  return { winnerNew, loserNew: Math.max(loserNew, 100) } // Min Elo of 100
}

// Update agent stats on-chain (non-blocking)
async function updateOnChainStats(agent: {
  inftTokenId: string | null
  wins: number
  losses: number
  draws: number
  bestClickCount: number | null
  eloRating: number
}) {
  if (!INFT_CONTRACT_ADDRESS || !agent.inftTokenId) {
    return
  }

  try {
    const contract = getContract()
    const tx = await contract.updateStats(
      BigInt(agent.inftTokenId),
      BigInt(agent.wins),
      BigInt(agent.losses),
      BigInt(agent.draws),
      BigInt(agent.bestClickCount || 0),
      BigInt(agent.eloRating)
    )
    await tx.wait()
    console.log(`[Victory] Updated on-chain stats for iNFT #${agent.inftTokenId}`)
  } catch (error) {
    console.error(`[Victory] Failed to update on-chain stats:`, error)
    // Non-blocking - continue even if on-chain update fails
  }
}

// POST /api/matches/[id]/claim-victory - Claim victory
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
  const { agent_id, final_url } = body

  if (agent_id !== agent.id) {
    return NextResponse.json({ error: 'agent_id does not match API key' }, { status: 403 })
  }

  // Find the match
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      agent1: true,
      agent2: true,
    },
  })

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  if (match.status !== 'active') {
    return NextResponse.json({ error: 'Match is not active' }, { status: 400 })
  }

  // Check for timeout
  if (match.endsAt && new Date() > match.endsAt) {
    return NextResponse.json({ error: 'Match has timed out' }, { status: 400 })
  }

  const isAgent1 = match.agent1Id === agent_id
  const isAgent2 = match.agent2Id === agent_id

  if (!isAgent1 && !isAgent2) {
    return NextResponse.json({ error: 'You are not in this match' }, { status: 403 })
  }

  // Get the URL to verify (from request or from last frame)
  let urlToVerify = final_url
  if (!urlToVerify) {
    const lastFrame = getFrame(matchId, agent_id)
    urlToVerify = lastFrame?.currentUrl
  }

  if (!urlToVerify) {
    return NextResponse.json({ error: 'No URL to verify. Include final_url or push frames.' }, { status: 400 })
  }

  // Extract article title from URL
  const articleTitle = extractArticleTitle(urlToVerify)

  if (!articleTitle) {
    return NextResponse.json({
      result: 'rejected',
      message: 'Could not parse article from URL',
      url: urlToVerify,
    }, { status: 400 })
  }

  // Check if it matches the target (case-insensitive, handle underscores)
  const normalizedTitle = articleTitle.toLowerCase().replace(/_/g, ' ')
  const normalizedTarget = match.targetArticle.toLowerCase().replace(/_/g, ' ')

  if (normalizedTitle !== normalizedTarget) {
    return NextResponse.json({
      result: 'rejected',
      verified_article: articleTitle,
      target_article: match.targetArticle,
      message: `You are on '${articleTitle}', not the target. Keep going!`,
    })
  }

  // Victory confirmed!
  const clickCount = isAgent1 ? match.agent1Clicks : match.agent2Clicks
  const agentPath = JSON.parse(isAgent1 ? match.agent1Path : match.agent2Path) as string[]
  const now = new Date()
  const timeElapsed = match.startedAt
    ? Math.floor((now.getTime() - match.startedAt.getTime()) / 1000)
    : 0

  // Calculate new Elo ratings
  const winner = isAgent1 ? match.agent1 : match.agent2
  const loser = isAgent1 ? match.agent2 : match.agent1
  const winnerOldElo = winner?.eloRating || 1200
  const loserOldElo = loser?.eloRating || 1200
  const { winnerNew, loserNew } = calculateNewElo(winnerOldElo, loserOldElo)

  // Update match status
  await prisma.match.update({
    where: { id: matchId },
    data: {
      status: 'complete',
      winnerId: agent_id,
      completedAt: now,
    },
  })

  // Update winner stats
  const updatedWinner = await prisma.agent.update({
    where: { id: agent_id },
    data: {
      wins: { increment: 1 },
      eloRating: winnerNew,
      bestClickCount: agent.bestClickCount === null || clickCount < agent.bestClickCount
        ? clickCount
        : agent.bestClickCount,
    },
  })

  // Update loser stats
  const loserId = isAgent1 ? match.agent2Id : match.agent1Id
  let updatedLoser = null
  if (loserId) {
    updatedLoser = await prisma.agent.update({
      where: { id: loserId },
      data: {
        losses: { increment: 1 },
        eloRating: loserNew,
      },
    })
  }

  // Update on-chain stats (non-blocking)
  updateOnChainStats(updatedWinner)
  if (updatedLoser) {
    updateOnChainStats(updatedLoser)
  }

  // Emit match complete event to spectators
  emitMatchEvent(matchId, 'match_complete', {
    winner: {
      agent_id: agent_id,
      name: agent.name,
      click_count: clickCount,
      path: agentPath,
      new_elo: winnerNew,
    },
    time_elapsed_seconds: timeElapsed,
  })

  // Clear frames from memory
  clearMatchFrames(matchId)

  return NextResponse.json({
    result: 'victory',
    winner: {
      agent_id: agent_id,
      name: agent.name,
    },
    verified_article: articleTitle,
    click_count: clickCount,
    path: agentPath,
    time_elapsed_seconds: timeElapsed,
    new_elo: winnerNew,
    message: `Victory! You reached ${match.targetArticle} in ${clickCount} clicks.`,
  })
}
