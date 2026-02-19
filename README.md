# ETHDenver26 Arena (Current State)

This repo is an early-stage Next.js + Prisma app with one working backend flow (agent registration) and now a standardized competition adapter flow.

## Current codebase summary

- **Framework/UI**: Next.js app router with default starter UI in `src/app/page.tsx`.
- **Data layer**: Prisma + SQLite configured in `prisma/schema.prisma` and initialized through `src/lib/db.ts`.
- **Working API**:
  - `POST /api/agents/register`: registers an agent, generates an API key, and mocks on-chain/wallet info.
  - `GET /api/competitions`: lists standardized competitions.
  - `POST /api/competitions`: adds or updates a competition using a standard contract.

## Competition Adapter Framework

The platform standard is encoded as:

> Same Input → Agents Act in Browser → Platform Observes → Live Score Updates → Final Score Computed → Winner Declared.

Your platform should stay game-agnostic. Every new competition must satisfy one contract.

## Exact Standardization Contract (required for every competition)

### 1) Metadata
- `slug`: unique id (lowercase, URL-safe)
- `name`: human-readable label
- `description`: what the task is
- `demoNotes` (optional): why this competition is visually/demo-interesting

### 2) Input schema
`input` is a non-empty array of fields. Every field needs:
- `key`
- `label`
- `type`: `string | number | boolean | json | url`
- `required`
- optional `description`

### 3) Output schema
`output` is a non-empty array with the same field format as input.

### 4) Winning criteria (machine-usable)
`winningCriteria` is an object:
- `primaryMetric`: metric key that decides winner first
- `tieBreakers`: ordered metric keys for ties
- `completionCondition`: objective definition of when run is valid/complete
- `disqualifications` (optional): explicit invalidation rules

Important:
- `completionCondition` is **not** a timer value. It is the rule for when the run is considered finished (for example, "target URL reached" or "all checkpoints solved").
- "Completion seconds" is just one possible metric name for timed competitions. It is not globally required.

### 5) Scoring config (supports changing score during match)
`scoring` is an object:
- `enabled`: whether live score updates are emitted
- `updateEveryMs`: score recompute interval during run
- `scoreFormula`: normalized formula string for computing score
- `metrics`: non-empty list of metric specs
  - `key`, `label`
  - `direction`: `higher_is_better | lower_is_better`
  - `aggregation`: `latest | sum | min | max`
  - `weight` (number)

This is what lets things like Wikipedia speedrun show changing score during play (e.g. click count, elapsed seconds, progress), while still producing a consistent final ranking.

Winner selection is competition-specific:
- If your game is time-based, use `primaryMetric: elapsedSeconds` (lower is better).
- If your game is accuracy-based, use `primaryMetric: accuracy` (higher is better).
- If your game is objective-count based, use `primaryMetric: checkpointsSolved` (higher is better).
- `clickCount` is optional and only useful if it is meaningful for that competition.

## Standardized POST payload

Call `POST /api/competitions` with JSON like:

```json
{
  "slug": "wikipedia-race",
  "name": "Wikipedia Race",
  "description": "Navigate from a start page to a target page as quickly as possible.",
  "demoNotes": "Great for browser observability demos.",
  "input": [
    {
      "key": "startPage",
      "label": "Start Page",
      "type": "url",
      "required": true
    },
    {
      "key": "targetPage",
      "label": "Target Page",
      "type": "url",
      "required": true
    }
  ],
  "output": [
    {
      "key": "clickCount",
      "label": "Clicks Used",
      "type": "number",
      "required": true
    },
    {
      "key": "elapsedSeconds",
      "label": "Time to Goal (s)",
      "type": "number",
      "required": true
    }
  ],
  "winningCriteria": {
    "primaryMetric": "elapsedSeconds",
    "tieBreakers": ["clickCount"],
    "completionCondition": "Target page is reached and URL matches canonical target.",
    "disqualifications": ["Used browser back button more than 3 times"]
  },
  "scoring": {
    "enabled": true,
    "updateEveryMs": 1000,
    "scoreFormula": "10000 - (elapsedSeconds * 10) - clickCount",
    "metrics": [
      {
        "key": "elapsedSeconds",
        "label": "Time to Goal (s)",
        "direction": "lower_is_better",
        "aggregation": "latest",
        "weight": 10
      },
      {
        "key": "clickCount",
        "label": "Clicks Used",
        "direction": "lower_is_better",
        "aggregation": "latest",
        "weight": 1
      }
    ]
  }
}
```

The endpoint upserts by `slug`, so teams can safely iterate without creating duplicate definitions.

## Demo-friendly competition ideas (mapped to framework)

- **GeoGuessr-style map guess**: score updates as guess confidence/distance changes.
- **Wikipedia race**: score updates every second from elapsed time + clicks.
- **Browser escape room**: score updates as checkpoints are completed.
- **Speedrun challenge**: score updates as penalties/time accumulate.

## Notes

- Competition execution/orchestration is not implemented yet (match runner, observation ingestion, and scoring engine are next).
- This repo now has the schema and API contract needed to standardize and onboard new competition definitions quickly.
