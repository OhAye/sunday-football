import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PlayerAvatar from '../components/PlayerAvatar'

function getDeviceId() {
  let id = localStorage.getItem('sf_device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('sf_device_id', id)
  }
  return id
}

export default function Vote() {
  const { sessionId } = useParams()
  const [voteSession, setVoteSession] = useState(null)
  const [votes, setVotes] = useState({})
  const [myVote, setMyVote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const deviceId = getDeviceId()

  const loadVotes = useCallback(async () => {
    const { data } = await supabase
      .from('motm_votes')
      .select('voted_for')
      .eq('session_id', sessionId)
    if (data) {
      const counts = {}
      data.forEach(({ voted_for }) => {
        counts[voted_for] = (counts[voted_for] || 0) + 1
      })
      setVotes(counts)
    }
  }, [sessionId])

  useEffect(() => {
    async function load() {
      const { data: vs, error: vsErr } = await supabase
        .from('vote_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single()

      if (vsErr || !vs) {
        setError('Vote not found. Ask the match organiser to share the link again.')
        setLoading(false)
        return
      }

      setVoteSession(vs)
      await loadVotes()

      const { data: existing } = await supabase
        .from('motm_votes')
        .select('voted_for')
        .eq('session_id', sessionId)
        .eq('device_id', deviceId)
        .maybeSingle()

      if (existing) setMyVote(existing.voted_for)
      setLoading(false)
    }
    load()
  }, [sessionId, deviceId, loadVotes])

  async function handleVote(playerId) {
    if (myVote || submitting) return
    setSubmitting(true)
    const { error: insertErr } = await supabase
      .from('motm_votes')
      .insert({ session_id: sessionId, voted_for: playerId, device_id: deviceId })
    if (!insertErr) {
      setMyVote(playerId)
      await loadVotes()
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f14] flex items-center justify-center">
        <p className="text-[#64748b] text-sm">Loading vote...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0b0f14] flex items-center justify-center px-6">
        <p className="text-red-400 text-sm text-center">{error}</p>
      </div>
    )
  }

  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0)
  const maxVotes = myVote ? Math.max(...Object.values(votes), 0) : 0
  const winners = myVote && maxVotes > 0
    ? voteSession.players.filter((p) => (votes[p.id] || 0) === maxVotes)
    : []
  const sortedPlayers = myVote
    ? [...voteSession.players].sort((a, b) => (votes[b.id] || 0) - (votes[a.id] || 0))
    : voteSession.players

  return (
    <div className="min-h-screen bg-[#0b0f14] flex flex-col max-w-lg mx-auto px-4 pb-10">
      {/* Header */}
      <div className="pt-10 pb-6 text-center">
        <p className="text-3xl mb-2">⭐</p>
        <h1
          className="text-2xl font-bold text-[#f1f5f9] uppercase tracking-wide"
          style={{ fontFamily: "'Oswald', sans-serif" }}
        >
          Man of the Match
        </h1>
        <p className="text-sm text-[#64748b] mt-1">{voteSession.date}</p>
        {voteSession.score_label && (
          <p className="text-base font-bold text-[#94a3b8] mt-1" style={{ fontFamily: "'Oswald', sans-serif" }}>
            {voteSession.score_label}
          </p>
        )}
        <div className="mt-3">
          {myVote ? (
            <>
              <p className="text-xs font-semibold text-[#22c55e]">
                Vote cast · {totalVotes} vote{totalVotes !== 1 ? 's' : ''} total
              </p>
              {winners.length > 0 && (
                <p className="text-sm font-bold text-[#fbbf24] mt-1" style={{ fontFamily: "'Oswald', sans-serif" }}>
                  {winners.length > 1 ? '🤝 Joint MOTM: ' : '🏆 Leading: '}
                  {winners.map((p) => p.name).join(' & ')}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-[#475569]">Tap a player to cast your vote</p>
          )}
        </div>
      </div>

      {/* Player list */}
      <div className="space-y-2">
        {sortedPlayers.map((player) => {
          const count = votes[player.id] || 0
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
          const isMyVote = myVote === player.id
          const isLeader = myVote && count > 0 && count === maxVotes

          return (
            <button
              key={player.id}
              onClick={() => handleVote(player.id)}
              disabled={!!myVote || submitting}
              className="w-full rounded-2xl overflow-hidden relative text-left transition-transform active:scale-[0.98]"
              style={{
                background: isMyVote ? '#2d1f00' : '#141920',
                border: `1px solid ${isMyVote ? '#a16207' : isLeader ? '#22c55e33' : '#252d3a'}`,
              }}
            >
              {/* Progress bar fill */}
              {myVote && pct > 0 && (
                <div
                  className="absolute inset-y-0 left-0 rounded-2xl transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: isMyVote ? '#a1620715' : '#1e293b88',
                  }}
                />
              )}

              <div className="relative flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-2.5">
                  <PlayerAvatar player={player} size={36} />
                  {isMyVote && <span className="text-sm leading-none">⭐</span>}
                  <span
                    className="text-sm font-semibold"
                    style={{
                      color: isMyVote ? '#fbbf24' : '#f1f5f9',
                      fontFamily: isMyVote ? "'Oswald', sans-serif" : 'inherit',
                    }}
                  >
                    {player.name}
                  </span>
                </div>
                {myVote && (
                  <div className="flex items-center gap-2 shrink-0">
                    {count > 0 && (
                      <>
                        <span
                          className="text-sm font-bold"
                          style={{ color: isMyVote ? '#fbbf24' : isLeader ? '#22c55e' : '#64748b' }}
                        >
                          {pct}%
                        </span>
                        <span className="text-xs text-[#475569]">
                          {count} vote{count !== 1 ? 's' : ''}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <p className="text-center text-[10px] text-[#252d3a] mt-10">Sunday Football ⚽</p>
    </div>
  )
}
