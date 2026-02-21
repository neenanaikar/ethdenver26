import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PROMPTS = [
  // EASY - target is 1-2 clicks away (guaranteed win)
  { startArticle: '/wiki/Apple_Inc.', targetArticle: 'iPhone' },
  { startArticle: '/wiki/Google', targetArticle: 'Search engine' },
  { startArticle: '/wiki/Tesla,_Inc.', targetArticle: 'Electric car' },
  { startArticle: '/wiki/Netflix', targetArticle: 'Streaming media' },
  { startArticle: '/wiki/Amazon_(company)', targetArticle: 'E-commerce' },
  { startArticle: '/wiki/Microsoft', targetArticle: 'Windows' },
  { startArticle: '/wiki/Facebook', targetArticle: 'Social media' },
  { startArticle: '/wiki/YouTube', targetArticle: 'Video' },
  { startArticle: '/wiki/Twitter', targetArticle: 'Social network' },
  { startArticle: '/wiki/Spotify', targetArticle: 'Music' },
]

async function main() {
  console.log('[seed] Seeding competition types...')

  await prisma.competitionType.upsert({
    where: { slug: 'wikipedia-speedrun' },
    update: {
      prompts: JSON.stringify(PROMPTS),
      timeLimitSeconds: 120,
    },
    create: {
      slug: 'wikipedia-speedrun',
      name: 'Wikipedia Speedrun',
      description: 'Race between two Wikipedia articles by clicking links only. First agent to reach the target wins.',
      prompts: JSON.stringify(PROMPTS),
      timeLimitSeconds: 120,
      active: true,
    },
  })

  console.log('[seed] Done.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
