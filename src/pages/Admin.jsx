import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/app-context'
import { useFeedback } from '../components/feedback-context'
import { plural } from '../lib/format'
import { PageHeader, Section } from '../components/ui'
import { ArrowLeftIcon, BackspaceIcon, ChevronDownIcon, LockIcon, SquadIcon } from '../components/icons'
import PlayerAvatar from '../components/PlayerAvatar'

const PIN_LENGTH = 4
const LEGACY_GROUPS = [['', 'All-time'], ['2024', '2024'], ['2025', '2025'], ['2026', '2026']]
const LEGACY_FIELDS = [['legacyPlayed', 'P'], ['legacyWins', 'W'], ['legacyLosses', 'L'], ['legacyMotm', 'MOTM']]

export default function Admin() {
  const { isAdmin } = useApp()
  return isAdmin ? <AdminPanel /> : <PinEntry />
}

// ─── PIN pad ─────────────────────────────────────────────────────
function PinEntry() {
  const { unlockAdmin, adminReady } = useApp()
  const navigate = useNavigate()
  const [digits, setDigits] = useState('')
  const [wrong, setWrong] = useState(false)

  function press(d) {
    if (digits.length >= PIN_LENGTH || wrong) return
    const next = digits + d
    setDigits(next)
    if (next.length === PIN_LENGTH && !unlockAdmin(next)) {
      setWrong(true)
      setTimeout(() => { setDigits(''); setWrong(false) }, 700)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-8 py-10">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-surface text-green-bright">
        <LockIcon className="w-6 h-6" />
      </span>
      <p className="kicker mt-5">Sunday FC</p>
      <h1 className="display mt-2 text-4xl text-ink">Admin</h1>

      <div className={`mt-9 flex gap-4 ${wrong ? 'shake' : ''}`} aria-label={`${digits.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className="h-4 w-4 rounded-full transition-all duration-150"
            style={{
              background: i < digits.length ? (wrong ? '#ef4444' : '#22c55e') : '#252d3a',
              boxShadow: i < digits.length && !wrong ? '0 0 12px rgba(34,197,94,0.7)' : 'none',
            }}
          />
        ))}
      </div>
      <p role="status" className="mt-3 h-5 text-sm text-red-bright">
        {wrong ? (adminReady ? 'Incorrect PIN' : 'Couldn’t check the PIN. Are you online?') : ''}
      </p>

      <div className="mt-5 grid w-full max-w-[280px] grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <PadKey key={d} onClick={() => press(d)}>{d}</PadKey>)}
        <span />
        <PadKey onClick={() => press('0')}>0</PadKey>
        <PadKey onClick={() => setDigits((prev) => prev.slice(0, -1))} label="Delete"><BackspaceIcon className="w-6 h-6 text-mist" /></PadKey>
      </div>

      <button type="button" onClick={() => navigate('/')} className="btn btn-ghost mt-8">
        <ArrowLeftIcon className="w-4 h-4" /> Back to the app
      </button>
    </div>
  )
}

function PadKey({ children, onClick, label }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="num flex h-[68px] items-center justify-center rounded-2xl border border-line bg-surface pt-1.5 text-4xl text-ink transition-transform active:scale-95 active:bg-raised">
      {children}
    </button>
  )
}

// ─── Admin panel ─────────────────────────────────────────────────
function AdminPanel() {
  const { players, sessions, lockAdmin } = useApp()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col pb-12">
      <PageHeader
        back onBack={() => navigate('/')}
        kicker="Admin"
        title="Control room"
        action={
          <button type="button" className="btn btn-quiet" onClick={() => { lockAdmin(); navigate('/') }}>
            <LockIcon className="w-4 h-4" /> Lock
          </button>
        }
      />

      <div className="stagger space-y-4 px-4">
        <Link to="/players" className="card press flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-green-dim text-green-bright"><SquadIcon /></span>
          <span className="flex-1">
            <span className="display block text-base text-ink">Manage the squad</span>
            <span className="block text-xs text-muted">Add, edit, injure or remove players · reset photo PINs</span>
          </span>
        </Link>

        <Section title="Legacy stats" subtitle="Numbers from before matches were tracked here. Added on top of recorded games.">
          <div className="divide-y divide-line">
            {[...players].sort((a, b) => a.name.localeCompare(b.name)).map((p) => <LegacyEditor key={p.id} player={p} />)}
          </div>
        </Section>

        <Section title="Import historical matches" icon="📥" tone="green">
          <ImportHistorical sessionCount={sessions.length} />
        </Section>

        <Section title="Change admin PIN" icon="🔐" tone="gold">
          <ChangePinForm />
        </Section>
      </div>
    </div>
  )
}

// ─── Legacy stats editor (accordion row) ─────────────────────────
const legacyDraft = (p) =>
  Object.fromEntries(LEGACY_GROUPS.flatMap(([suffix]) => LEGACY_FIELDS.map(([field]) => [`${field}${suffix}`, p[`${field}${suffix}`] ?? 0])))

function LegacyEditor({ player }) {
  const { updatePlayer } = useApp()
  const { toast } = useFeedback()
  const [draft, setDraft] = useState(null) // null = collapsed
  const [busy, setBusy] = useState(false)
  const open = draft !== null

  async function save() {
    setBusy(true)
    const ok = await updatePlayer(player.id, draft)
    setBusy(false)
    toast(ok ? `${player.name}’s legacy stats saved` : 'Couldn’t save. Try again.', ok ? 'ok' : 'error')
    if (ok) setDraft(null)
  }

  return (
    <div className={open ? 'bg-pitch/50' : ''}>
      <button type="button" aria-expanded={open} onClick={() => setDraft(open ? null : legacyDraft(player))}
        className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <PlayerAvatar player={player} size={26} />
        <span className="flex-1 text-sm font-medium text-ink">{player.name}</span>
        <ChevronDownIcon className={`w-4 h-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-4 px-4 pb-4">
          {LEGACY_GROUPS.map(([suffix, label]) => (
            <div key={label}>
              <p className="eyebrow mb-2">{label}</p>
              <div className="grid grid-cols-4 gap-2">
                {LEGACY_FIELDS.map(([field, short]) => {
                  const key = `${field}${suffix}`
                  return (
                    <label key={key} className="block text-center">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">{short}</span>
                      {/* Negative values are allowed: some seasons carry a correction offset */}
                      <input
                        type="number" inputMode="numeric" value={draft[key]}
                        onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value === '' ? '' : Math.trunc(Number(e.target.value)) || 0 }))}
                        onBlur={() => setDraft((prev) => (prev && prev[key] === '' ? { ...prev, [key]: 0 } : prev))}
                        className="field font-display px-1 text-center"
                      />
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-primary btn-block" disabled={busy}
            onClick={save}>
            {busy ? 'Saving…' : 'Save legacy stats'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Historical import ───────────────────────────────────────────
function ImportHistorical({ sessionCount }) {
  const { importHistoricalSessions } = useApp()
  const { toast, confirm } = useFeedback()
  const [state, setState] = useState('idle') // idle | importing | done

  async function run() {
    const yes = await confirm({
      title: 'Import historical matches?',
      body: 'This adds any missing matches from the WhatsApp log and resets every player’s legacy played / won / lost numbers to zero so games aren’t counted twice. Legacy MOTM counts are kept.',
      confirmLabel: 'Import',
      danger: true,
    })
    if (!yes) return
    setState('importing')
    const ok = await importHistoricalSessions()
    setState(ok ? 'done' : 'idle')
    toast(ok ? 'Historical matches imported' : 'Import failed. Nothing was changed.', ok ? 'ok' : 'error')
  }

  return (
    <div className="space-y-3 p-4">
      <p className="text-sm leading-relaxed text-mist">
        Loads <strong className="text-ink">67 matches</strong> (Oct 2024 – Feb 2026) from the WhatsApp match log. Dates already in the app are skipped.
      </p>
      <p className="text-xs text-muted">{plural(sessionCount, 'match')} currently in the app.</p>
      <button type="button" className="btn btn-quiet btn-block" disabled={state !== 'idle'} onClick={run}>
        {state === 'importing' ? 'Importing…' : state === 'done' ? 'Imported' : 'Import historical matches'}
      </button>
    </div>
  )
}

// ─── Change PIN ──────────────────────────────────────────────────
function ChangePinForm() {
  const { changePin } = useApp()
  const { toast } = useFeedback()
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!/^\d{4}$/.test(pin)) return setError('The PIN must be exactly 4 digits.')
    if (pin !== again) return setError('Those PINs don’t match.')
    setBusy(true)
    const ok = await changePin(pin)
    setBusy(false)
    if (!ok) return setError('Couldn’t change the PIN. Try again.')
    setPin('')
    setAgain('')
    toast('Admin PIN changed')
  }

  const field = (id, label, value, set) => (
    <div>
      <label className="field-label" htmlFor={id}>{label}</label>
      <input id={id} type="password" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="••••" value={value}
        onChange={(e) => { set(e.target.value.replace(/\D/g, '')); setError('') }}
        className="field font-display text-center text-xl tracking-[0.4em]" />
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3">
        {field('admin-pin', 'New PIN', pin, setPin)}
        {field('admin-pin-again', 'Type it again', again, setAgain)}
      </div>
      {error && <p role="alert" className="text-sm text-red-bright">{error}</p>}
      <button type="submit" className="btn btn-quiet btn-block" disabled={busy}>{busy ? 'Saving…' : 'Update PIN'}</button>
    </form>
  )
}
