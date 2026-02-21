import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ethdenver26-production.up.railway.app'

async function main() {
  const prisma = new PrismaClient()
  const agents = await prisma.agent.findMany({
    where: { claimCode: { not: null }, claimed: false, inftTokenId: { not: null } },
    select: { id: true, name: true, inftTokenId: true, claimCode: true },
    take: 3
  })

  console.log('Unclaimed agents with iNFTs:\n')
  for (const agent of agents) {
    console.log(`Agent: ${agent.name}`)
    console.log(`  Token ID: ${agent.inftTokenId}`)
    console.log(`  Claim URL: ${BASE_URL}/claim/${agent.claimCode}`)
    console.log('')
  }

  await prisma.$disconnect()
}

main()
