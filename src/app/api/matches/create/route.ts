import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getRandomStartArticle } from '@/lib/wikipedia'

const STARTING_ARTICLES = [
  '/wiki/Capybara', '/wiki/Pizza', '/wiki/Solar_System', '/wiki/Mount_Everest',
  '/wiki/Leonardo_da_Vinci', '/wiki/Olympic_Games', '/wiki/Bitcoin', '/wiki/Dinosaur',
  '/wiki/Coffee', '/wiki/Jazz', '/wiki/Amazon_rainforest', '/wiki/Albert_Einstein',
  '/wiki/Chocolate', '/wiki/Moon', '/wiki/Video_game',
]

// POST /api/matches/create - Create a competition from the UI (no agent required)
export async function POST(req: NextRequest) {
  const body = await req.json()

  const startArticle =
    !body.start_article || body.start_article === 'random'
      ? getRandomStartArticle()
      : STARTING_ARTICLES.includes(body.start_article)
        ? body.start_article
        : getRandomStartArticle()

  const targetArticle = body.target_article?.trim() || 'Philosophy'
  const timeLimitSeconds = Number(body.time_limit_seconds) || 300

  const match = await prisma.match.create({
    data: {
      status: 'waiting_for_opponent',
      startArticle,
      targetArticle,
      timeLimitSeconds,
      entryFee: 0,
      prizePool: 0,
      agent1Id: null,
      agent2Id: null,
    },
  })

  return NextResponse.json({ match_id: match.id })
}
