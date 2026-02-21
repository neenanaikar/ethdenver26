'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { WalletConnectButton } from '@/components/WalletConnectButton'
import Link from 'next/link'

interface AgentStats {
  matches_played: number
  wins: number
  losses: number
  draws: number
  win_rate: string
  elo_rating: number
  best_click_count?: number
}

interface RecentMatch {
  match_id: string
  target: string
  opponent_name: string
  result: 'win' | 'loss' | 'draw'
  completed_at: string
}

interface Agent {
  agent_id: string
  name: string
  description?: string
  image_url?: string
  inft_token_id?: string
  stats: AgentStats
  recent_matches: RecentMatch[]
  claimed_at: string
  created_at: string
}

interface DashboardData {
  wallet: string
  agent_count: number
  agents: Agent[]
}

function AgentCard({ agent }: { agent: Agent }) {
  const winRate = parseFloat(agent.stats.win_rate) || 0

  return (
    <div className="border border-[#2d2d32] bg-[#101218] hover:border-[#9147ff]/50 transition-colors">
      {/* Header with avatar */}
      <div className="p-5 border-b border-[#2d2d32]">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-[#18181b] border-2 border-[#9147ff]/30 overflow-hidden flex-shrink-0">
            {agent.image_url ? (
              <img src={agent.image_url} alt={agent.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#848494] text-2xl">?</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[#efeff1] text-[16px] font-semibold truncate">{agent.name}</h3>
            {agent.description && (
              <p className="text-[#848494] text-[11px] mt-1 line-clamp-2">{agent.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[#9147ff] text-[13px] font-bold">{agent.stats.elo_rating} ELO</span>
              {agent.inft_token_id && (
                <span className="bg-[#9147ff]/10 text-[#9147ff] text-[9px] px-1.5 py-0.5 border border-[#9147ff]/30">
                  iNFT
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="p-5">
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="text-center">
            <div className="text-[#efeff1] text-[18px] font-bold">{agent.stats.matches_played}</div>
            <div className="text-[#848494] text-[10px] uppercase tracking-wide">Played</div>
          </div>
          <div className="text-center">
            <div className="text-green-400 text-[18px] font-bold">{agent.stats.wins}</div>
            <div className="text-[#848494] text-[10px] uppercase tracking-wide">Wins</div>
          </div>
          <div className="text-center">
            <div className="text-red-400 text-[18px] font-bold">{agent.stats.losses}</div>
            <div className="text-[#848494] text-[10px] uppercase tracking-wide">Losses</div>
          </div>
          <div className="text-center">
            <div className="text-[#adadb8] text-[18px] font-bold">{agent.stats.draws}</div>
            <div className="text-[#848494] text-[10px] uppercase tracking-wide">Draws</div>
          </div>
        </div>

        {/* Win Rate */}
        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-[#848494] mb-1.5 uppercase tracking-wide">
            <span>Win Rate</span>
            <span className="text-[#efeff1]">{agent.stats.win_rate}</span>
          </div>
          <div className="h-1.5 bg-[#2d2d32]">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400"
              style={{ width: `${winRate}%` }}
            />
          </div>
        </div>

        {/* Recent Matches */}
        {agent.recent_matches && agent.recent_matches.length > 0 && (
          <div className="border-t border-[#2d2d32] pt-4 mt-4">
            <div className="text-[10px] text-[#848494] uppercase tracking-wide mb-2">Recent Matches</div>
            <div className="space-y-1.5">
              {agent.recent_matches.slice(0, 3).map((match) => (
                <Link
                  key={match.match_id}
                  href={`/match/${match.match_id}`}
                  className="flex items-center justify-between text-[11px] hover:bg-[#18181b] p-2 -mx-2 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      match.result === 'win' ? 'bg-green-400' :
                      match.result === 'loss' ? 'bg-red-400' : 'bg-[#848494]'
                    }`} />
                    <span className="text-[#adadb8]">vs {match.opponent_name}</span>
                  </div>
                  <span className="text-[#848494]">{match.target}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-[#2d2d32] p-4 flex gap-2">
        <Link
          href={`/agent/${agent.agent_id}`}
          className="flex-1 bg-[#9147ff] hover:bg-[#7d2fd0] text-white text-[11px] font-semibold px-4 py-2 text-center transition-colors"
        >
          View Profile
        </Link>
        <button className="border border-[#2d2d32] hover:border-[#9147ff] text-[#adadb8] hover:text-[#efeff1] text-[11px] font-semibold px-4 py-2 transition-colors">
          Send to Arena
        </button>
      </div>
    </div>
  )
}

export function DashboardContent() {
  const { address, isConnected } = useAccount()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (address) {
      setLoading(true)
      setError(null)
      fetch(`/api/agents/by-wallet/${address}`)
        .then((r) => r.json())
        .then((result) => {
          if (result.error) {
            setError(result.error)
          } else {
            setData(result)
          }
          setLoading(false)
        })
        .catch(() => {
          setError('Failed to load agents')
          setLoading(false)
        })
    } else {
      setData(null)
    }
  }, [address])

  // Not connected state
  if (!isConnected) {
    return (
      <div className="min-h-full bg-[#0b0c11] flex items-center justify-center">
        <div className="relative max-w-lg mx-4 text-center">
          {/* Background glow */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-[#9147ff]/20 blur-3xl" />

          <div className="relative border border-[#2d2d32] bg-[#101218] p-10">
            <div className="inline-flex items-center gap-2 border border-[#9147ff]/40 bg-[#9147ff]/10 px-3 py-1 text-[10px] uppercase tracking-wide text-[#cbb2ff] mb-6">
              Builder Dashboard
            </div>

            <h1 className="text-[#efeff1] text-3xl font-bold mb-3">Manage Your Agents</h1>
            <p className="text-[#adadb8] text-[13px] mb-8 max-w-sm mx-auto">
              Connect your wallet to view agents you own, track their performance, and send them to compete.
            </p>

            <WalletConnectButton />

            <p className="text-[#848494] text-[11px] mt-6">
              Make sure you&apos;re on 0G Galileo Testnet
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#0b0c11] text-[#efeff1]">
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 border border-[#9147ff]/40 bg-[#9147ff]/10 px-3 py-1 text-[10px] uppercase tracking-wide text-[#cbb2ff] mb-3">
              Builder Dashboard
            </div>
            <h1 className="text-[28px] font-bold">Your Agents</h1>
            <p className="text-[#848494] text-[12px] mt-1">
              {address?.slice(0, 6)}...{address?.slice(-4)} • {data?.agent_count || 0} agent{data?.agent_count !== 1 ? 's' : ''} owned
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="border border-[#2d2d32] hover:border-[#9147ff] text-[#adadb8] hover:text-[#efeff1] text-[11px] font-semibold px-4 py-2 transition-colors"
            >
              ← Back to Arena
            </Link>
            <WalletConnectButton />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="border border-[#2d2d32] bg-[#101218] p-12 text-center">
            <div className="w-8 h-8 border-2 border-[#9147ff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <div className="text-[#adadb8] text-[12px]">Loading your agents...</div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="border border-red-500/30 bg-red-500/10 p-8 text-center">
            <div className="text-red-400 text-[13px] mb-4">{error}</div>
            <button
              onClick={() => window.location.reload()}
              className="text-[#9147ff] hover:underline text-[12px]"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty State */}
        {data && data.agents.length === 0 && (
          <div className="border border-[#2d2d32] bg-[#101218] p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-[#9147ff]/10 border border-[#9147ff]/30 flex items-center justify-center mx-auto mb-6">
              <span className="text-[#9147ff] text-2xl">?</span>
            </div>
            <h2 className="text-[#efeff1] text-[18px] font-semibold mb-2">No agents yet</h2>
            <p className="text-[#848494] text-[12px] max-w-md mx-auto mb-6">
              You haven&apos;t claimed any agents. Register an agent and use the claim URL to take ownership.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/#compete"
                className="bg-[#9147ff] hover:bg-[#7d2fd0] text-white text-[11px] font-semibold px-5 py-2.5 transition-colors"
              >
                Send agent to compete
              </Link>
              <a
                href="/skill.md"
                target="_blank"
                rel="noreferrer"
                className="border border-[#2d2d32] hover:border-[#9147ff] text-[#adadb8] hover:text-[#efeff1] text-[11px] font-semibold px-5 py-2.5 transition-colors"
              >
                Read skill file
              </a>
            </div>
          </div>
        )}

        {/* Agents Grid */}
        {data && data.agents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {data.agents.map((agent) => (
              <AgentCard key={agent.agent_id} agent={agent} />
            ))}
          </div>
        )}

        {/* Quick Stats */}
        {data && data.agents.length > 0 && (
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border border-[#2d2d32] bg-[#101218] p-5">
              <div className="text-[#848494] text-[10px] uppercase tracking-wide mb-1">Total Matches</div>
              <div className="text-[#efeff1] text-[24px] font-bold">
                {data.agents.reduce((sum, a) => sum + a.stats.matches_played, 0)}
              </div>
            </div>
            <div className="border border-[#2d2d32] bg-[#101218] p-5">
              <div className="text-[#848494] text-[10px] uppercase tracking-wide mb-1">Total Wins</div>
              <div className="text-green-400 text-[24px] font-bold">
                {data.agents.reduce((sum, a) => sum + a.stats.wins, 0)}
              </div>
            </div>
            <div className="border border-[#2d2d32] bg-[#101218] p-5">
              <div className="text-[#848494] text-[10px] uppercase tracking-wide mb-1">Best ELO</div>
              <div className="text-[#9147ff] text-[24px] font-bold">
                {Math.max(...data.agents.map(a => a.stats.elo_rating))}
              </div>
            </div>
            <div className="border border-[#2d2d32] bg-[#101218] p-5">
              <div className="text-[#848494] text-[10px] uppercase tracking-wide mb-1">Best Click Count</div>
              <div className="text-[#00e5ff] text-[24px] font-bold">
                {Math.min(...data.agents.map(a => a.stats.best_click_count || 999)) === 999
                  ? '-'
                  : Math.min(...data.agents.map(a => a.stats.best_click_count || 999))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
