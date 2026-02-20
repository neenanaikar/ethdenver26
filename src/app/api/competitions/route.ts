import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/competitions - List all active competition types with queue depth
export async function GET() {
  const types = await prisma.competitionType.findMany({
    where: { active: true },
    include: {
      _count: {
        select: {
          matches: { where: { status: 'waiting_for_opponent' } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    competitions: types.map(t => ({
      slug: t.slug,
      name: t.name,
      description: t.description,
      time_limit_seconds: t.timeLimitSeconds,
      waiting_count: t._count.matches,
    })),
  })
}
