import { prisma } from '@/lib/db'
import {
  CompetitionContract,
  CompetitionIOField,
  CompetitionMetric,
  LiveScoringSpec,
  StandardizedCompetitionPayload,
  WinningCriteriaSpec,
} from '@/lib/competition-contract'

function validateIoFields(fields: CompetitionIOField[], kind: 'input' | 'output') {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error(`${kind} must be a non-empty array`)
  }

  for (const field of fields) {
    if (!field.key || !field.label || !field.type) {
      throw new Error(`${kind} fields must include key, label, and type`)
    }
  }
}

function validateMetrics(metrics: CompetitionMetric[]) {
  if (!Array.isArray(metrics) || metrics.length === 0) {
    throw new Error('scoring.metrics must be a non-empty array')
  }

  for (const metric of metrics) {
    if (!metric.key || !metric.label || !metric.direction || !metric.aggregation) {
      throw new Error('each scoring metric must include key, label, direction, and aggregation')
    }

    if (!Number.isFinite(metric.weight)) {
      throw new Error('each scoring metric must include numeric weight')
    }
  }
}

function validateWinningCriteria(winningCriteria: WinningCriteriaSpec) {
  if (!winningCriteria?.primaryMetric || !winningCriteria?.completionCondition) {
    throw new Error('winningCriteria.primaryMetric and winningCriteria.completionCondition are required')
  }

  if (!Array.isArray(winningCriteria.tieBreakers)) {
    throw new Error('winningCriteria.tieBreakers must be an array')
  }
}

function validateScoring(scoring: LiveScoringSpec) {
  if (typeof scoring?.enabled !== 'boolean') {
    throw new Error('scoring.enabled is required')
  }

  if (!Number.isFinite(scoring?.updateEveryMs) || scoring.updateEveryMs <= 0) {
    throw new Error('scoring.updateEveryMs must be a positive number')
  }

  if (!scoring?.scoreFormula?.trim()) {
    throw new Error('scoring.scoreFormula is required')
  }

  validateMetrics(scoring.metrics)
}

export function normalizeCompetitionPayload(
  payload: StandardizedCompetitionPayload
): CompetitionContract {
  const slug = payload.slug?.trim().toLowerCase()
  const displayName = payload.name?.trim()
  const description = payload.description?.trim()

  if (!slug || !displayName || !description) {
    throw new Error('slug, name, and description are required')
  }

  validateIoFields(payload.input, 'input')
  validateIoFields(payload.output, 'output')
  validateWinningCriteria(payload.winningCriteria)
  validateScoring(payload.scoring)

  return {
    slug,
    displayName,
    description,
    demoNotes: payload.demoNotes?.trim(),
    input: payload.input,
    output: payload.output,
    winningCriteria: payload.winningCriteria,
    scoring: {
      ...payload.scoring,
      scoreFormula: payload.scoring.scoreFormula.trim(),
    },
  }
}

export async function addCompetition(payload: StandardizedCompetitionPayload) {
  const normalized = normalizeCompetitionPayload(payload)

  return prisma.competition.upsert({
    where: { slug: normalized.slug },
    update: {
      displayName: normalized.displayName,
      description: normalized.description,
      demoNotes: normalized.demoNotes,
      inputSchema: normalized.input,
      outputSchema: normalized.output,
      winningCriteria: normalized.winningCriteria,
      scoringConfig: normalized.scoring,
    },
    create: {
      slug: normalized.slug,
      displayName: normalized.displayName,
      description: normalized.description,
      demoNotes: normalized.demoNotes,
      inputSchema: normalized.input,
      outputSchema: normalized.output,
      winningCriteria: normalized.winningCriteria,
      scoringConfig: normalized.scoring,
    },
  })
}

export async function listCompetitions() {
  return prisma.competition.findMany({ orderBy: { createdAt: 'desc' } })
}
