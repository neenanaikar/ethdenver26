// In-memory store for latest frames (for real-time streaming)
// Key: `${matchId}:${agentId}` -> frame data

interface FrameData {
  frame: string // base64 JPEG
  currentUrl: string
  clickCount: number
  timestamp: number
}

const frameStore = new Map<string, FrameData>()

export function storeFrame(matchId: string, agentId: string, data: FrameData) {
  frameStore.set(`${matchId}:${agentId}`, data)
}

export function getFrame(matchId: string, agentId: string): FrameData | null {
  return frameStore.get(`${matchId}:${agentId}`) || null
}

export function getMatchFrames(matchId: string): { agent1?: FrameData; agent2?: FrameData } {
  const result: { agent1?: FrameData; agent2?: FrameData } = {}

  frameStore.forEach((data, key) => {
    if (key.startsWith(`${matchId}:`)) {
      const agentId = key.split(':')[1]
      // We'll need to determine which is agent1 vs agent2 from match data
      // For now just return by agent ID - the caller can resolve this
    }
  })

  return result
}

export function clearMatchFrames(matchId: string) {
  const keysToDelete: string[] = []
  frameStore.forEach((_, key) => {
    if (key.startsWith(`${matchId}:`)) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach(key => frameStore.delete(key))
}

// Get all frames for a match (for spectator streaming)
export function getFramesForMatch(matchId: string, agent1Id: string, agent2Id: string | null) {
  return {
    agent1: getFrame(matchId, agent1Id),
    agent2: agent2Id ? getFrame(matchId, agent2Id) : null,
  }
}
