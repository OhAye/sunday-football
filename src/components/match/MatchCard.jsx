import { useEffect, useState } from 'react'
import { useApp } from '../../context/app-context'
import { useFeedback } from '../feedback-context'
import { DEFAULT_REPORT_AUTHOR } from '../../lib/constants'
import { fmtDate, plural, todayYMD, weatherEmoji } from '../../lib/format'
import { formatOf, hasScore, motmIdsOf, winnerOf } from '../../lib/stats'
import { lineupText, motmResultText, openWhatsApp, openWhatsAppAfter, voteText } from '../../lib/share'
import { ChevronDownIcon, EditIcon, NoteIcon, StarIcon, WhatsAppIcon } from '../icons'
import MatchFace from '../MatchFace'
import PlayerAvatar from '../PlayerAvatar'
import ScoreStepper from './ScoreStepper'

const COLLAPSED_ROWS = 5
const VERDICT = { A: ['Team A win', 'chip-green'], B: ['Team B win', 'chip-blue'], D: ['Draw', 'chip-amber'] }

// One match in the Games list. Everyday jobs (score, MOTM, report, sharing) happen inline;
// lineup changes and deletion live behind the edit button.
export default function MatchCard({ session, onEdit }) {
  const { playerById, updateSession, publishVote, fetchWeatherForDate } = useApp()
  const { toast } = useFeedback()
  const [panel, setPanel] = useState(null) // null | 'score' | 'motm' | 'report'
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)

  const nameOf = (id) => playerById.get(id)?.name ?? 'Unknown'
  const hasResult = !!session.result
  const hasTeams = !!session.teams
  const upcoming = !hasResult && session.date >= todayYMD()
  const winner = winnerOf(session)
  const motmPlayers = motmIdsOf(session).map((id) => playerById.get(id)).filter(Boolean)
  const longReport = (session.report?.length ?? 0) > 220
  const biggestTeam = Math.max(session.teams?.teamA.length ?? 0, session.teams?.teamB.length ?? 0)

  async function save(updates, successMessage) {
    setBusy(true)
    const ok = await updateSession(session.id, updates)
    setBusy(false)
    toast(ok ? successMessage : 'Couldn’t save. Check your connection and try again.', ok ? 'ok' : 'error')
    return ok
  }

  async function addWeather() {
    setBusy(true)
    const weather = await fetchWeatherForDate(session.date)
    setBusy(false)
    if (!weather) return toast('No weather data for that date yet.', 'error')
    save({ weather }, 'Weather added')
  }

  function shareVote() {
    openWhatsAppAfter(async () => {
      if (await publishVote(session)) return voteText(session)
      toast('Couldn’t set up the vote. Try again.', 'error')
      return null
    }).catch(() => toast('Couldn’t set up the vote. Try again.', 'error'))
  }

  return (
    <article className="card overflow-hidden" style={upcoming ? { borderColor: 'rgba(245,158,11,0.35)' } : undefined}>
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <h3 className="display text-lg text-ink">{fmtDate(session.date)}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {winner && <span className={`chip ${VERDICT[winner][1]}`}>{VERDICT[winner][0]}</span>}
            {!hasResult && <span className="chip chip-amber">{upcoming ? 'Upcoming' : 'No result'}</span>}
            {hasTeams && <span className="chip chip-neutral">{formatOf(session)}-a-side</span>}
            {session.weather && (
              <span className="text-xs text-muted">{weatherEmoji(session.weather.code)} {session.weather.tempC}°C</span>
            )}
          </div>
        </div>
        <button type="button" onClick={onEdit} aria-label="Edit match"
          className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-raised text-mist active:scale-90">
          <EditIcon className="w-4 h-4" />
        </button>
      </div>

      {/* ── Teams + score ── */}
      <div className="px-4 py-4">
        {hasTeams ? (
          <MatchFace session={session} max={expanded ? Infinity : COLLAPSED_ROWS} />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {session.playerIds.length === 0 && <p className="text-sm text-muted">No lineup recorded.</p>}
            {session.playerIds.map((id) => <span key={id} className="chip chip-neutral normal-case tracking-normal">{nameOf(id)}</span>)}
          </div>
        )}
        {biggestTeam > COLLAPSED_ROWS && (
          <button type="button" onClick={() => setExpanded((v) => !v)}
            className="mx-auto mt-3 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-muted">
            {expanded ? 'Show less' : `All ${session.playerIds.length} players`}
            <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* ── Score entry (matches without a result) ── */}
      {!hasResult && hasTeams && panel !== 'score' && (
        <div className="flex gap-2 px-4 pb-4">
          <button type="button" className="btn btn-primary flex-1" onClick={() => setPanel('score')}>Enter score</button>
          <button type="button" className="btn btn-whatsapp" onClick={() => openWhatsApp(lineupText(session, nameOf))}>
            <WhatsAppIcon /> Teams
          </button>
        </div>
      )}
      {panel === 'score' && (
        <ScorePanel
          busy={busy}
          onCancel={() => setPanel(null)}
          onSave={async (a, b) => {
            if (await save({ result: { scoreA: a, scoreB: b, scoreKnown: true } }, 'Result saved')) setPanel(null)
          }}
        />
      )}

      {/* ── Man of the Match ── */}
      {!upcoming && session.playerIds.length > 0 && (
        panel === 'motm' ? (
          <MotmPanel
            session={session}
            onChange={(ids) => save({ motm: ids.length ? ids : null }, ids.length ? 'Man of the Match updated' : 'Man of the Match cleared')}
            onClose={() => setPanel(null)}
          />
        ) : motmPlayers.length > 0 ? (
          <div className="mx-4 mb-4 flex items-center gap-3 rounded-2xl border border-gold-mid/70 px-3 py-2.5"
            style={{ background: 'linear-gradient(90deg, #2d1f00, #1a1300)' }}>
            <div className="flex shrink-0 -space-x-1.5">
              {motmPlayers.map((p) => <PlayerAvatar key={p.id} player={p} size={30} ring="#fbbf24" />)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-mid">
                {motmPlayers.length > 1 ? 'Joint ' : ''}Man of the Match
              </p>
              <p className="display truncate text-base leading-tight text-gold">{motmPlayers.map((p) => p.name).join(' & ')}</p>
            </div>
            <button type="button" aria-label="Share Man of the Match on WhatsApp"
              onClick={() => openWhatsApp(motmResultText(session, nameOf))}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#25d366]">
              <WhatsAppIcon />
            </button>
            <button type="button" onClick={() => setPanel('motm')} className="shrink-0 text-xs font-semibold text-gold-mid">Change</button>
          </div>
        ) : (
          <div className="flex gap-2 px-4 pb-4">
            <button type="button" className="btn btn-quiet flex-1" onClick={() => setPanel('motm')}>
              <StarIcon className="w-4 h-4 text-gold" /> Award MOTM
            </button>
            <button type="button" className="btn btn-whatsapp" onClick={shareVote}>
              <WhatsAppIcon /> Vote link
            </button>
          </div>
        )
      )}

      {/* ── Match report ── */}
      {hasResult && (
        panel === 'report' ? (
          <ReportPanel
            session={session}
            busy={busy}
            onCancel={() => setPanel(null)}
            onSave={async (report, writtenBy) => {
              if (await save({ report: report || null, writtenBy: report ? writtenBy || null : null }, report ? 'Report saved' : 'Report removed')) setPanel(null)
            }}
          />
        ) : session.report ? (
          <div className="inset mx-4 mb-4 px-3.5 py-3">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="eyebrow">Match report</p>
              <button type="button" onClick={() => setPanel('report')} className="text-xs font-semibold text-muted">Edit</button>
            </div>
            <p className={`whitespace-pre-wrap text-sm leading-relaxed text-soft ${expanded || !longReport ? '' : 'line-clamp-4'}`}>{session.report}</p>
            {longReport && !expanded && (
              <button type="button" onClick={() => setExpanded(true)} className="mt-1 text-xs font-semibold text-green-bright">Read more</button>
            )}
            {session.writtenBy && <p className="mt-2 text-xs italic text-muted">— {nameOf(session.writtenBy)}</p>}
          </div>
        ) : null
      )}

      {/* ── Quiet footer actions ── */}
      {hasResult && panel === null && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-xs font-semibold text-muted">
          {hasTeams && (
            <button type="button" className="flex min-h-8 items-center gap-1.5" onClick={() => openWhatsApp(lineupText(session, nameOf))}>
              <WhatsAppIcon className="w-3.5 h-3.5" /> Share teams
            </button>
          )}
          {!session.report && (
            <button type="button" className="flex min-h-8 items-center gap-1.5" onClick={() => setPanel('report')}>
              <NoteIcon className="w-3.5 h-3.5" /> Add report
            </button>
          )}
          {!session.weather && (
            <button type="button" className="min-h-8" disabled={busy} onClick={addWeather}>
              {busy ? 'Fetching…' : '+ Weather'}
            </button>
          )}
        </div>
      )}
    </article>
  )
}

// ─── Inline score entry ────────────────────────────────────────
function ScorePanel({ busy, onSave, onCancel }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  return (
    <div className="inset mx-4 mb-4 p-4">
      <p className="eyebrow mb-4 text-center">Final score</p>
      <div className="flex items-end justify-center gap-3">
        <ScoreStepper side="A" value={a} onChange={setA} />
        <ScoreStepper side="B" value={b} onChange={setB} />
      </div>
      <div className="mt-5 flex gap-2">
        <button type="button" className="btn btn-quiet flex-1" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary flex-1" disabled={busy || !hasScore(a, b)} onClick={() => onSave(Number(a), Number(b))}>
          {busy ? 'Saving…' : 'Save result'}
        </button>
      </div>
    </div>
  )
}

// ─── MOTM picker (multi-select for ties, shows the vote tally) ──
function MotmPanel({ session, onChange, onClose }) {
  const { playerById, getVoteCounts } = useApp()
  const [counts, setCounts] = useState(undefined) // undefined = loading, null = unavailable
  const motmIds = motmIdsOf(session)

  useEffect(() => {
    let cancelled = false
    getVoteCounts(session.id).then((c) => { if (!cancelled) setCounts(c) })
    return () => { cancelled = true }
  }, [session.id, getVoteCounts])

  const totalVotes = counts ? Object.values(counts).reduce((sum, n) => sum + n, 0) : 0
  const topVotes = counts ? Math.max(0, ...Object.values(counts)) : 0
  const voteWinners = topVotes > 0 ? session.playerIds.filter((id) => counts[id] === topVotes) : []
  const winnersApplied = voteWinners.length > 0 && voteWinners.length === motmIds.length && voteWinners.every((id) => motmIds.includes(id))

  const attending = session.playerIds
    .map((id) => playerById.get(id))
    .filter(Boolean)
    .sort((x, y) => (counts?.[y.id] ?? 0) - (counts?.[x.id] ?? 0) || x.name.localeCompare(y.name))

  return (
    <div className="mx-4 mb-4 overflow-hidden rounded-2xl border border-gold-mid/70 bg-[#1a1300]">
      <div className="flex items-center justify-between border-b border-gold-dim px-3.5 py-2.5">
        <p className="eyebrow flex items-center gap-1.5 text-gold"><StarIcon className="w-3.5 h-3.5" /> Man of the Match</p>
        <button type="button" onClick={onClose} className="btn btn-sm btn-ghost -mr-2 text-gold">Done</button>
      </div>

      {totalVotes > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-gold-dim px-3.5 py-2.5">
          <p className="text-xs text-mist">
            <span className="font-semibold text-ink">{plural(totalVotes, 'vote')}</span> cast
            {voteWinners.length > 0 && <> · leading: <span className="text-gold">{voteWinners.map((id) => playerById.get(id)?.name).join(' & ')}</span></>}
          </p>
          {!winnersApplied && (
            <button type="button" className="btn btn-sm btn-quiet shrink-0 border-gold-mid/70 text-gold" onClick={() => onChange(voteWinners)}>
              Use vote
            </button>
          )}
        </div>
      )}

      <p className="px-3.5 pt-3 text-xs text-muted">Tap to award. Pick more than one for a tie.</p>
      <div className="flex flex-wrap gap-2 p-3.5">
        {attending.map((p) => {
          const on = motmIds.includes(p.id)
          const votes = counts?.[p.id] ?? 0
          return (
            <button
              key={p.id} type="button" aria-pressed={on}
              onClick={() => onChange(on ? motmIds.filter((id) => id !== p.id) : [...motmIds, p.id])}
              className={`flex min-h-10 items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 text-sm font-medium transition-colors ${
                on ? 'border-gold-mid bg-amber-dim text-gold' : 'border-line bg-raised text-soft'
              }`}
            >
              <PlayerAvatar player={p} size={26} ring={on ? '#fbbf24' : null} />
              {p.name}
              {votes > 0 && <span className="rounded-full bg-black/40 px-1.5 text-[11px] font-bold tabular-nums text-gold">{votes}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Match report editor ───────────────────────────────────────
function ReportPanel({ session, busy, onSave, onCancel }) {
  const { playerById } = useApp()
  const attending = session.playerIds.map((id) => playerById.get(id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
  const defaultAuthor = attending.some((p) => p.id === DEFAULT_REPORT_AUTHOR) ? DEFAULT_REPORT_AUTHOR : ''
  const [text, setText] = useState(session.report ?? '')
  const [author, setAuthor] = useState(session.writtenBy ?? defaultAuthor)

  return (
    <div className="inset mx-4 mb-4 space-y-3 p-3.5">
      <p className="eyebrow">Match report</p>
      <textarea
        value={text} onChange={(e) => setText(e.target.value)} rows={5} autoFocus
        placeholder="How did it go? Goals, howlers, heroics…" aria-label="Match report"
        className="field resize-none leading-relaxed"
      />
      <div>
        <label className="field-label" htmlFor={`author-${session.id}`}>Written by</label>
        <select id={`author-${session.id}`} value={author} onChange={(e) => setAuthor(e.target.value)} className="field">
          <option value="">Nobody in particular</option>
          {attending.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-quiet flex-1" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => onSave(text.trim(), author)}>
          {busy ? 'Saving…' : 'Save report'}
        </button>
      </div>
    </div>
  )
}
