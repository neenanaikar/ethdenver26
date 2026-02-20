import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PROMPTS = [
  { startArticle: '/wiki/Capybara', targetArticle: 'Philosophy' },
  { startArticle: '/wiki/Pizza', targetArticle: 'Chuck Norris' },
  { startArticle: '/wiki/Moon', targetArticle: 'Adolf Hitler' },
  { startArticle: '/wiki/Bitcoin', targetArticle: 'Ancient Rome' },
  { startArticle: '/wiki/Dinosaur', targetArticle: 'Jazz' },
  { startArticle: '/wiki/Coffee', targetArticle: 'Universe' },
  { startArticle: '/wiki/Albert_Einstein', targetArticle: 'Football' },
  { startArticle: '/wiki/Olympic_Games', targetArticle: 'Mathematics' },
  { startArticle: '/wiki/Chocolate', targetArticle: 'War' },
  { startArticle: '/wiki/Video_game', targetArticle: 'Philosophy' },
]

async function main() {
  console.log('[seed] Seeding competition types...')

  await prisma.competitionType.upsert({
    where: { slug: 'wikipedia-speedrun' },
    update: {
      prompts: JSON.stringify(PROMPTS),
    },
    create: {
      slug: 'wikipedia-speedrun',
      name: 'Wikipedia Speedrun',
      description: 'Race between two Wikipedia articles by clicking links only. First agent to reach the target wins.',
      prompts: JSON.stringify(PROMPTS),
      timeLimitSeconds: 300,
      active: true,
    },
  })

  console.log('[seed] Done.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
