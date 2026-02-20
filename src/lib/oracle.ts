import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import { ethers } from 'ethers'
import OpenAI from 'openai'

const ZG_PROVIDER_ADDRESS = '0xf07240Efa67755B5311bc75784a061eDB47165Dd'
const ZG_RPC = 'https://evmrpc-testnet.0g.ai'

const ORACLE_SYSTEM_PROMPT = `You are an impartial judge for a Wikipedia Speedrun competition. Two AI agents race to navigate from a starting Wikipedia article to a target article by clicking links only.

You will be given:
- The task (start article → target article)
- Each agent's final URL and click count

Rules for judging:
- If an agent's final URL matches the target article, they win
- If both reached it, the one with fewer clicks wins
- If neither reached it, judge who made better progress toward the target based on their final URL topic
- Only declare a draw if both agents have clearly equivalent outcomes

Respond with ONLY valid JSON:
{
  "winner": "agent1" | "agent2" | "draw",
  "reasoning": "<1-3 sentences explaining the decision>"
}`

export interface OracleInput {
  taskDescription: string
  targetArticle: string
  agent1: {
    agentId: string
    name: string
    clickCount: number
    lastUrl: string | null
  }
  agent2: {
    agentId: string
    name: string
    clickCount: number
    lastUrl: string | null
  }
}

export interface OracleVerdict {
  winner: 'agent1' | 'agent2' | 'draw'
  winnerId: string | null
  reasoning: string
}

function buildUserMessage(input: OracleInput): string {
  return `Task: ${input.taskDescription}
Target article: ${input.targetArticle}

Agent 1 (${input.agent1.name}):
- Final URL: ${input.agent1.lastUrl ?? 'unknown'}
- Clicks: ${input.agent1.clickCount}

Agent 2 (${input.agent2.name}):
- Final URL: ${input.agent2.lastUrl ?? 'unknown'}
- Clicks: ${input.agent2.clickCount}

Who won?`
}

function parseVerdict(text: string, input: OracleInput): OracleVerdict {
  try {
    // Extract JSON from response (in case model wraps it in markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text)

    const winner: 'agent1' | 'agent2' | 'draw' =
      parsed.winner === 'agent1' ? 'agent1'
      : parsed.winner === 'agent2' ? 'agent2'
      : 'draw'

    return {
      winner,
      winnerId:
        winner === 'agent1' ? input.agent1.agentId
        : winner === 'agent2' ? input.agent2.agentId
        : null,
      reasoning: String(parsed.reasoning ?? 'No reasoning provided.'),
    }
  } catch {
    console.error('[oracle] Failed to parse verdict:', text)
    return {
      winner: 'draw',
      winnerId: null,
      reasoning: 'Oracle returned an unparseable response. Match declared a draw.',
    }
  }
}

async function get0GClient() {
  const privateKey = process.env.ZERO_GRAVITY_PRIVATE_KEY
  if (!privateKey) throw new Error('ZERO_GRAVITY_PRIVATE_KEY not set')

  const provider = new ethers.JsonRpcProvider(ZG_RPC)
  const wallet = new ethers.Wallet(privateKey, provider)
  const broker = await createZGComputeNetworkBroker(wallet)

  const { endpoint, model } = await broker.inference.getServiceMetadata(ZG_PROVIDER_ADDRESS)
  const headers = await broker.inference.getRequestHeaders(ZG_PROVIDER_ADDRESS, model)

  const client = new OpenAI({
    baseURL: endpoint,
    apiKey: 'unused',
    defaultHeaders: headers as unknown as Record<string, string>,
  })

  return { client, model }
}

export async function runOracle(input: OracleInput): Promise<OracleVerdict> {
  if (!process.env.ZERO_GRAVITY_PRIVATE_KEY) {
    console.error('[oracle] ZERO_GRAVITY_PRIVATE_KEY not set — declaring draw')
    return {
      winner: 'draw',
      winnerId: null,
      reasoning: 'Oracle unavailable (no 0G key configured). Match declared a draw.',
    }
  }

  try {
    console.log('[oracle] Connecting to 0G compute...')
    const { client, model } = await get0GClient()

    const response = await client.chat.completions.create({
      model,
      max_tokens: 512,
      messages: [
        { role: 'system', content: ORACLE_SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(input) },
      ],
    })

    const text = response.choices[0]?.message?.content ?? ''
    console.log('[oracle] 0G verdict raw:', text)
    return parseVerdict(text, input)
  } catch (err) {
    console.error('[oracle] 0G compute failed:', err)
    return {
      winner: 'draw',
      winnerId: null,
      reasoning: 'Oracle failed to produce a verdict. Match declared a draw.',
    }
  }
}
