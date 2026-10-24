import { useState } from 'react'
import { useApp } from '../../context/app-context'
import { useFeedback } from '../feedback-context'
import { DEFAULT_FORMAT, FORMATS, formatForSize } from '../../lib/constants'
import { fmtDate, nearestSunday } from '../../lib/format'
import { formatOf, hasScore } from '../../lib/stats'
import { PageHeader, Segmented } from '../ui'
import { TrashIcon, WhatsAppIcon } from '../icons'
import PitchBuilder from './PitchBuilder'
import TeamBuilder from './TeamBuilder'
import ScoreStepper from './ScoreStepper'
import PasteTeamsSheet from './PasteTeamsSheet'

const FORMAT_OPTIONS = FORMATS.map((f) => ({ value: f, label: `${f}-a-side` }))
const VIEW_OPTIONS = [{ value: 'pitch', label: 'Pitch' }, { value: 'list', label: 'List' }]

// Create or edit a match: date, format, lineup and (optionally) the score.
// `session` is the match being edited, or null for a new one. `onDone` returns to the list.
export default function MatchForm({ session, onDone }) {
  const { sessions, saveMatch, updateSession, removeSession } = useApp()
  const { toast, confirm } = useFeedback()
  const isEdit = !!session

  const [date, setDate] = useState(session?.date ?? nearestSunday())
  const [teamA, setTeamA] = useState(session?.teams?.teamA ?? [])
  const [teamB, setTeamB] = useState(session?.teams?.teamB ?? [])
  const [scoreA, setScoreA] = useState(session?.result ? String(session.result.scoreA) : '')
  const [scoreB, setScoreB] = useState(session?.result ? String(session.result.scoreB) : '')
  const [format, setFormat] = useState(() => (session ? formatOf(session) : DEFAULT_FORMAT))
  const [view, setView] = useState('pitch')
  const [busy, setBusy] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [layoutKey, setLayoutKey] = useState(0) // bump to re-lay the pitch out after a bulk change

  function applyPastedTeams(a, b) {
    setTeamA(a)
    setTeamB(b)
    setFormat(formatForSize(Math.max(a.length, b.length)))
    setLayoutKey((k) => k + 1)
    setPasting(false)
    toast(`Teams filled in · ${a.length} v ${b.length}`)
  }

  const setTeams = (a, b) => { setTeamA(a); setTeamB(b) }
  const canSave = teamA.length > 0 && teamB.length > 0 && !!date && !busy
  const scored = hasScore(scoreA, scoreB)
  const halfScored = !scored && (scoreA !== '' || scoreB !== '')
  const winnerOnly = session?.result?.scoreKnown === false
  const clash = sessions.some((s) => s.date === date && s.id !== session?.id)

  // Keep goals and the "winner only" flag unless the score itself was changed
  function buildResult() {
    if (!scored) return null
    const prev = session?.result
    const a = Number(scoreA), b = Number(scoreB)
    const unchanged = prev && prev.scoreA === a && prev.scoreB === b
    return { ...(prev ?? {}), scoreA: a, scoreB: b, scoreKnown: unchanged ? prev.scoreKnown ?? true : true }
  }

  async function handleSave() {
    if (!canSave) return
    setBusy(true)
    let ok
    if (isEdit) {
      ok = await updateSession(session.id, {
        date,
        playerIds: [...new Set([...teamA, ...teamB])],
        teams: { teamA, teamB, format },
        result: buildResult(),
        // A new date means the stored weather is for the wrong day — clear it so it is re-fetched
        ...(date !== session.date ? { weather: null } : {}),
      })
    } else {
      ok = !!(await saveMatch({ date, teamA, teamB, scoreA, scoreB, format }))
    }
    setBusy(false)
    if (!ok) return toast('Couldn’t save the match. Check your connection and try again.', 'error')
    toast(isEdit ? 'Match updated' : 'Match saved')
    onDone()
  }

  async function handleDelete() {
    const yes = await confirm({
      title: 'Delete this match?',
      body: `${fmtDate(session.date)} will be removed for everyone, along with its result, Man of the Match and report. This can’t be undone.`,
      confirmLabel: 'Delete match',
      danger: true,
    })
    if (!yes) return
    setBusy(true)
    const ok = await removeSession(session.id)
    setBusy(false)
    if (!ok) return toast('Couldn’t delete the match. Try again.', 'error')
    toast('Match deleted')
    onDone()
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader
        back onBack={onDone}
        kicker={isEdit ? 'Editing match' : 'New match'}
        title={isEdit ? 'Edit match' : 'Set lineup'}
      />

      <div className="space-y-4 px-4 pb-40">
        <section className="card space-y-4 p-4">
          <div>
            <label className="field-label" htmlFor="match-date">Match date</label>
            <input id="match-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
            {clash && (
              <p className="mt-2 text-xs text-amber">
                There’s already a match on this date. Save only if this is a second game.
              </p>
            )}
          </div>
          <div>
            <span className="field-label">Format</span>
            <Segmented options={FORMAT_OPTIONS} value={format} onChange={setFormat} green />
          </div>
        </section>

        <button type="button" className="btn btn-whatsapp btn-block" onClick={() => setPasting(true)}>
          <WhatsAppIcon /> Paste teams from WhatsApp
        </button>

        <Segmented options={VIEW_OPTIONS} value={view} onChange={setView} />

        {view === 'pitch'
          ? <PitchBuilder key={`${format}-${layoutKey}`} teamA={teamA} teamB={teamB} format={format} onChange={setTeams} />
          : <TeamBuilder teamA={teamA} teamB={teamB} onChange={setTeams} />}

        <section className="card p-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="eyebrow">Final score <span className="normal-case tracking-normal text-faint">· optional</span></p>
            {(scoreA !== '' || scoreB !== '') && (
              <button type="button" className="text-xs font-semibold text-muted" onClick={() => { setScoreA(''); setScoreB('') }}>
                Clear
              </button>
            )}
          </div>
          <div className="flex items-end justify-center gap-3">
            <ScoreStepper side="A" value={scoreA} onChange={setScoreA} />
            <ScoreStepper side="B" value={scoreB} onChange={setScoreB} />
          </div>
          {winnerOnly && (
            <p className="mt-4 text-center text-xs text-muted">
              Only the winner was recorded for this match. Change the score to record the real one.
            </p>
          )}
          {halfScored && <p className="mt-4 text-center text-xs text-amber">Enter both scores, or clear them to save without a result.</p>}
          {!scored && !halfScored && (
            <p className="mt-4 text-center text-xs text-muted">Leave blank to save this as an upcoming match.</p>
          )}
        </section>

        {isEdit && (
          <button type="button" className="btn btn-danger btn-block" onClick={handleDelete} disabled={busy}>
            <TrashIcon className="w-4 h-4" /> Delete match
          </button>
        )}
      </div>

      {pasting && <PasteTeamsSheet onApply={applyPastedTeams} onClose={() => setPasting(false)} />}

      {/* Sticky save bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-w-lg px-4 pt-6"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          background: 'linear-gradient(to top, #0b0f14 68%, transparent)',
        }}
      >
        {!(teamA.length > 0 && teamB.length > 0) && (
          <p className="mb-2 text-center text-xs text-muted">Put at least one player on each team to save.</p>
        )}
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={handleSave} disabled={!canSave || halfScored}>
          {busy ? 'Saving…' : isEdit ? 'Save changes' : scored ? 'Save result' : 'Save match'}
        </button>
      </div>
    </div>
  )
}
