import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { plural } from '../lib/format'
import { Loading } from '../components/ui'
import { CheckIcon, StarIcon } from '../components/icons'
import PlayerAvatar from '../components/PlayerAvatar'

// Public MOTM ballot, opened from a WhatsApp link. No accounts: one vote per device,
// keyed by a random ID kept in localStorage. Results are revealed after voting.
function getDeviceId() {
  try {
    let id = localStorage.getItem('sf_device_id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('sf_device_id', id)
    }
    return id
  } catch {
    return null // storage blocked (private mode) — voting is disabled
  }
}

export default function Vote() {
  const { sessionId } = useParams()
  const [deviceId] = useState(getDeviceId)
  const [ballot, setBallot] = useState(null)
  const [votes, setVotes] = useState({})
  const [myVote, setMyVote] = useState(null)
  const [choice, setChoice] = useState(null) // tapped but not yet confirmed
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const loadVotes = useCallback(async () => {
    const { data } = await supabase.from('motm_votes').select('voted_for').eq('session_id', sessionId)
    if (!data) return
    const counts = {}
    for (const { voted_for } of data) counts[voted_for] = (counts[voted_for] || 0) + 1
    setVotes(counts)
  }, [sessionId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: vs, error: vsErr } = await supabase.from('vote_sessions').select('*').eq('session_id', sessionId).single()
      if (cancelled) return
      if (vsErr || !vs) {
        setError('This vote couldn’t be found. Ask whoever shared it to send the link again.')
        setLoading(false)
        return
      }
      setBallot(vs)
      await loadVotes()
      if (deviceId) {
        const { data: existing } = await supabase
          .from('motm_votes').select('voted_for').eq('session_id', sessionId).eq('device_id', deviceId).maybeSingle()
        if (!cancelled && existing) setMyVote(existing.voted_for)
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [sessionId, deviceId, loadVotes])

  async function castVote() {
    if (!choice || myVote || submitting) return
    setSubmitting(true)
    setError(null)
    const { error: insertErr } = await supabase
      .from('motm_votes').insert({ session_id: sessionId, voted_for: choice, device_id: deviceId })
    if (insertErr) {
      setError('Your vote didn’t go through. Check your connection and try again.')
    } else {
      setMyVote(choice)
      await loadVotes()
    }
    setSubmitting(false)
  }

  if (loading) return <Loading label="Loading vote" />

  if (!ballot) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-8 text-center">
        <p className="text-sm text-red-bright">{error}</p>
      </div>
    )
  }

  const voted = !!myVote
  const totalVotes = Object.values(votes).reduce((sum, n) => sum + n, 0)
  const topVotes = voted ? Math.max(0, ...Object.values(votes)) : 0
  const leaders = topVotes > 0 ? ballot.players.filter((p) => votes[p.id] === topVotes) : []
  const list = voted ? [...ballot.players].sort((a, b) => (votes[b.id] || 0) - (votes[a.id] || 0)) : ballot.players
  const chosen = ballot.players.find((p) => p.id === choice)

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4" style={{ paddingBottom: voted ? 40 : 150 }}>
      <header className="hero-enter pb-6 text-center" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 40px)' }}>
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold-mid bg-gold-dim text-gold shadow-[0_0_30px_rgba(251,191,36,0.25)]">
          <StarIcon className="w-7 h-7" />
        </span>
        <p className="kicker mt-5 justify-center" style={{ color: '#fbbf24' }}>Sunday FC</p>
        <h1 className="display mt-2 text-4xl text-ink">Man of the Match</h1>
        <p className="mt-3 text-sm text-mist">{ballot.date}</p>
        {ballot.score_label && <p className="display mt-1 text-base text-soft">{ballot.score_label}</p>}

        <div className="mt-5">
          {voted ? (
            <>
              <span className="chip chip-green"><CheckIcon className="w-3 h-3" strokeWidth={3} /> Vote in · {plural(totalVotes, 'vote')} so far</span>
              {leaders.length > 0 && (
                <p className="display mt-3 text-lg text-gold">
                  {leaders.length > 1 ? 'Tied: ' : 'Leading: '}{leaders.map((p) => p.name).join(' & ')}
                </p>
              )}
            </>
          ) : !deviceId ? (
            <p className="text-sm text-amber">Voting needs browser storage. Open this link outside private browsing.</p>
          ) : (
            <p className="text-sm text-muted">Pick your player, then confirm. One vote per phone.</p>
          )}
        </div>
      </header>

      <ul className="stagger space-y-2">
        {list.map((player) => {
          const count = votes[player.id] || 0
          const share = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
          const mine = myVote === player.id
          const picked = choice === player.id
          const leading = voted && count > 0 && count === topVotes
          return (
            <li key={player.id}>
              <button
                type="button"
                onClick={() => setChoice(picked ? null : player.id)}
                disabled={voted || !deviceId}
                aria-pressed={voted ? mine : picked}
                className="card press relative flex w-full items-center gap-3 overflow-hidden px-4 py-3 text-left disabled:cursor-default"
                style={{
                  borderColor: mine || picked ? '#a16207' : leading ? 'rgba(34,197,94,0.35)' : undefined,
                  background: mine || picked ? '#2d1f00' : undefined,
                }}
              >
                {voted && share > 0 && (
                  <span aria-hidden="true" className="bar-grow absolute inset-y-0 left-0"
                    style={{ width: `${share}%`, background: mine ? 'rgba(251,191,36,0.12)' : 'rgba(148,163,184,0.09)' }} />
                )}
                <PlayerAvatar player={player} size={40} ring={mine || picked ? '#fbbf24' : null} className="relative" />
                <span className={`relative min-w-0 flex-1 truncate ${mine || picked ? 'display text-lg text-gold' : 'text-base font-medium text-ink'}`}>
                  {player.name}
                </span>
                {voted ? (
                  count > 0 && (
                    <span className="relative shrink-0 text-right">
                      <span className="num block text-2xl" style={{ color: mine ? '#fbbf24' : leading ? '#22c55e' : '#94a3b8' }}>{share}%</span>
                      <span className="text-[11px] text-muted">{plural(count, 'vote')}</span>
                    </span>
                  )
                ) : (
                  <span className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${picked ? 'border-gold bg-gold text-pitch' : 'border-ghost'}`}>
                    {picked && <CheckIcon className="w-3.5 h-3.5" strokeWidth={3.5} />}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {voted && <p className="mt-10 text-center text-xs text-faint">Sunday FC ⚽ Thanks for voting</p>}

      {/* Confirm bar — a deliberate second tap, because a vote can't be changed */}
      {!voted && deviceId && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg px-4 pt-8"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)', background: 'linear-gradient(to top, #0b0f14 70%, transparent)' }}
        >
          {error && <p role="alert" className="mb-2 text-center text-sm text-red-bright">{error}</p>}
          <button type="button" className="btn btn-lg btn-block" disabled={!choice || submitting} onClick={castVote}
            style={{ background: '#fbbf24', color: '#0b0f14' }}>
            {submitting ? 'Sending…' : chosen ? `Vote for ${chosen.name}` : 'Choose a player'}
          </button>
          <p className="mt-2 text-center text-[11px] text-muted">You can’t change your vote afterwards.</p>
        </div>
      )}
    </div>
  )
}
