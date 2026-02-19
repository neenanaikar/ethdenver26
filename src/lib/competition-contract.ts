export type CompetitionLifecycle =
  | 'created'
  | 'running'
  | 'scored'
  | 'completed'
  | 'failed'

export interface CompetitionIOField {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'json' | 'url'
  required: boolean
  description?: string
}

export type ScoreDirection = 'higher_is_better' | 'lower_is_better'

export interface CompetitionMetric {
  key: string
  label: string
  direction: ScoreDirection
  aggregation: 'latest' | 'sum' | 'min' | 'max'
  weight: number
  description?: string
}

export interface LiveScoringSpec {
  enabled: boolean
  updateEveryMs: number
  scoreFormula: string
  metrics: CompetitionMetric[]
}

export interface WinningCriteriaSpec {
  // Metric key used for first-pass ranking (must exist in scoring.metrics)
  primaryMetric: string
  // Ordered metric keys used only when primary metric ties
  tieBreakers: string[]
  // Optional hard-fail rules (e.g., "left allowed domain")
  disqualifications?: string[]
  // Objective condition that marks a run as complete/valid
  completionCondition: string
}

export interface CompetitionContract {
  slug: string
  displayName: string
  description: string
  demoNotes?: string
  input: CompetitionIOField[]
  output: CompetitionIOField[]
  winningCriteria: WinningCriteriaSpec
  scoring: LiveScoringSpec
}

export interface MatchObservation {
  key: string
  value: unknown
  timestamp: string
}

export interface MatchResult {
  competitionSlug: string
  agentId: string
  score: number
  output: Record<string, unknown>
  observations: MatchObservation[]
  status: CompetitionLifecycle
}

export interface StandardizedCompetitionPayload {
  slug: string
  name: string
  description: string
  demoNotes?: string
  input: CompetitionIOField[]
  output: CompetitionIOField[]
  winningCriteria: WinningCriteriaSpec
  scoring: LiveScoringSpec
}
