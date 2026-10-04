import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'

// ─── Admin page ─────────────────────────────────────────────────
export default function Admin() {
  const { isAdmin } = useApp()
  return isAdmin ? <AdminPanel /> : <PinEntry />
}

// ─── PIN entry screen ────────────────────────────────────────────
function PinEntry() {
  const { unlockAdmin } = useApp()
  const navigate = useNavigate()
  const [digits, setDigits] = useState([])
  const [error, setError] = useState(false)

  function handleDigit(d) {
    if (digits.length >= 4) return
    const next = [...digits, d]
    setDigits(next)
    if (next.length === 4) {
      const ok = unlockAdmin(next.join(''))
      if (!ok) {
        setError(true)
        setTimeout(() => { setDigits([]); setError(false) }, 700)
      }
    }
  }

  function handleBackspace() {
    setDigits((prev) => prev.slice(0, -1))
    setError(false)
  }

  const numpad = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'back']

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8" style={{ background: '#0b0f14' }}>
      {/* Header */}
      <div className="mb-10 text-center">
        <p className="text-[#16a34a] text-xs font-semibold tracking-[0.3em] uppercase mb-2">Sunday FC</p>
        <h1
          className="text-4xl font-bold uppercase text-[#f1f5f9]"
          style={{ fontFamily: "'Oswald', sans-serif" }}
        >
          Admin
        </h1>
        <div className="mt-3 h-0.5 w-12 rounded-full mx-auto" style={{ background: '#16a34a', boxShadow: '0 0 10px #16a34a' }} />
      </div>

      {/* PIN dots */}
      <div className="flex gap-4 mb-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-4 h-4 rounded-full transition-all duration-150"
            style={{
              background: i < digits.length ? (error ? '#ef4444' : '#16a34a') : '#252d3a',
              boxShadow: i < digits.length && !error ? '0 0 8px #16a34a88' : 'none',
            }}
          />
        ))}
      </div>
      <p
        className="text-xs mb-8 h-4 transition-opacity"
        style={{ color: '#ef4444', opacity: error ? 1 : 0 }}
      >
        Incorrect PIN
      </p>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {numpad.map((key, i) => {
          if (key === null) return <div key={i} />
          if (key === 'back') {
            return (
              <button
                key="back"
                onClick={handleBackspace}
                className="flex items-center justify-center rounded-2xl h-16 transition-colors active:scale-95"
                style={{ background: '#141920', border: '1px solid #252d3a' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M21 12H7M7 12l5-5M7 12l5 5" />
                </svg>
              </button>
            )
          }
          return (
            <button
              key={key}
              onClick={() => handleDigit(String(key))}
              className="flex items-center justify-center rounded-2xl h-16 text-2xl font-bold text-[#f1f5f9] transition-colors active:scale-95"
              style={{
                fontFamily: "'Oswald', sans-serif",
                background: '#141920',
                border: '1px solid #252d3a',
              }}
            >
              {key}
            </button>
          )
        })}
      </div>

      {/* Back link */}
      <button
        onClick={() => navigate('/')}
        className="mt-10 text-xs text-[#334155] hover:text-[#64748b] transition-colors"
      >
        ← Back to app
      </button>
    </div>
  )
}

// ─── Admin panel ─────────────────────────────────────────────────
function AdminPanel() {
  const { players, updatePlayer, lockAdmin, changePin, importHistoricalSessions, sessions } = useApp()
  const navigate = useNavigate()

  function handleLock() {
    lockAdmin()
    navigate('/')
  }

  return (
    <div className="flex flex-col">
      <header
        className="px-5 pt-10 pb-5 flex items-end justify-between"
        style={{ background: 'linear-gradient(to bottom, #0f1a12, #0b0f14)' }}
      >
        <div>
          <p className="text-[#16a34a] text-xs font-semibold tracking-[0.25em] uppercase mb-1">Admin</p>
          <h1
            className="text-3xl font-bold uppercase text-[#f1f5f9] leading-none"
            style={{ fontFamily: "'Oswald', sans-serif" }}
          >
            Panel
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/players"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
            style={{ background: '#14532d', border: '1px solid #16a34a55', color: '#22c55e' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20v-1a8 8 0 0 1 16 0v1" />
            </svg>
            Players
          </Link>
          <button
            onClick={handleLock}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
            style={{ background: '#1c2330', border: '1px solid #252d3a', color: '#64748b' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Lock
          </button>
        </div>
      </header>

      <div className="px-4 space-y-4 pb-8 pt-3">
        {/* Import historical matches */}
        <Section title="Import Historical Matches" titleColor="#16a34a" icon="📥">
          <ImportHistoricalSection importHistoricalSessions={importHistoricalSessions} sessionCount={sessions.length} />
        </Section>

        {/* Player stats editor */}
        <Section title="Edit Legacy Stats">
          <div className="divide-y" style={{ borderColor: '#252d3a' }}>
            {[...players].sort((a, b) => a.name.localeCompare(b.name)).map((player) => (
              <PlayerEditor key={player.id} player={player} updatePlayer={updatePlayer} />
            ))}
          </div>
        </Section>

        {/* Change PIN */}
        <Section title="Change PIN" titleColor="#a16207" icon="🔐">
          <ChangePinForm changePin={changePin} />
        </Section>
      </div>
    </div>
  )
}

// ─── Player editor (accordion) ───────────────────────────────────
function fromPlayer(p) {
  return {
    legacyPlayed:     p.legacyPlayed     ?? 0,
    legacyWins:       p.legacyWins       ?? 0,
    legacyLosses:     p.legacyLosses     ?? 0,
    legacyMotm:       p.legacyMotm       ?? 0,
    legacyPlayed2024: p.legacyPlayed2024 ?? 0,
    legacyWins2024:   p.legacyWins2024   ?? 0,
    legacyLosses2024: p.legacyLosses2024 ?? 0,
    legacyMotm2024:   p.legacyMotm2024   ?? 0,
    legacyPlayed2025: p.legacyPlayed2025 ?? 0,
    legacyWins2025:   p.legacyWins2025   ?? 0,
    legacyLosses2025: p.legacyLosses2025 ?? 0,
    legacyMotm2025:   p.legacyMotm2025   ?? 0,
    legacyPlayed2026: p.legacyPlayed2026 ?? 0,
    legacyWins2026:   p.legacyWins2026   ?? 0,
    legacyLosses2026: p.legacyLosses2026 ?? 0,
    legacyMotm2026:   p.legacyMotm2026   ?? 0,
  }
}

function PlayerEditor({ player, updatePlayer }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => fromPlayer(player))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) setDraft(fromPlayer(player))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function set(key) {
    return (e) => setDraft((prev) => ({ ...prev, [key]: Math.max(0, Number(e.target.value) || 0) }))
  }

  function handleSave() {
    updatePlayer(player.id, draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div>
      {/* Row header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
        style={{ background: open ? '#1a2230' : 'transparent' }}
      >
        <span className="text-sm font-medium text-[#f1f5f9]">{player.name}</span>
        <svg
          viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="w-4 h-4 transition-transform shrink-0"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Expanded editor */}
      {open && (
        <div className="px-4 pb-4 space-y-4" style={{ background: '#111820' }}>

          {/* All-time */}
          <FieldGroup label="All-Time">
            <NumField label="P"    value={draft.legacyPlayed}  onChange={set('legacyPlayed')} />
            <NumField label="W"    value={draft.legacyWins}    onChange={set('legacyWins')} />
            <NumField label="L"    value={draft.legacyLosses}  onChange={set('legacyLosses')} />
            <NumField label="MOTM" value={draft.legacyMotm}    onChange={set('legacyMotm')} />
          </FieldGroup>

          {/* Per-year */}
          {['2024', '2025', '2026'].map((yr) => (
            <FieldGroup key={yr} label={yr}>
              <NumField label="P"    value={draft[`legacyPlayed${yr}`]}  onChange={set(`legacyPlayed${yr}`)} />
              <NumField label="W"    value={draft[`legacyWins${yr}`]}    onChange={set(`legacyWins${yr}`)} />
              <NumField label="L"    value={draft[`legacyLosses${yr}`]}  onChange={set(`legacyLosses${yr}`)} />
              <NumField label="MOTM" value={draft[`legacyMotm${yr}`]}    onChange={set(`legacyMotm${yr}`)} />
            </FieldGroup>
          ))}

          {/* Save button */}
          <button
            onClick={handleSave}
            className="w-full py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all"
            style={{
              background: saved ? '#14532d' : '#16a34a',
              color: '#fff',
              boxShadow: saved ? 'none' : '0 0 12px #16a34a44',
            }}
          >
            {saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Import historical matches ───────────────────────────────────
function ImportHistoricalSection({ importHistoricalSessions, sessionCount }) {
  const [done, setDone] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [importing, setImporting] = useState(false)

  async function handleImport() {
    if (!confirmed) { setConfirmed(true); return }
    setImporting(true)
    await importHistoricalSessions()
    setDone(true)
    setConfirmed(false)
    setImporting(false)
  }

  return (
    <div className="px-4 pb-4 pt-3 space-y-3">
      <p className="text-xs" style={{ color: '#94a3b8' }}>
        Loads <strong style={{ color: '#f1f5f9' }}>67 matches</strong> (Oct 2024 – Feb 2026) from the WhatsApp match log.
        Already-imported dates are skipped. Legacy W/L stats will be zeroed out to avoid double-counting.
      </p>
      {sessionCount > 0 && (
        <p className="text-xs" style={{ color: '#64748b' }}>
          {sessionCount} session{sessionCount !== 1 ? 's' : ''} currently in app.
        </p>
      )}
      {confirmed && (
        <p className="text-xs font-bold" style={{ color: '#f59e0b' }}>
          Tap again to confirm — this will also reset all legacy W/L stats.
        </p>
      )}
      <button
        onClick={handleImport}
        disabled={importing}
        className="w-full py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-50"
        style={{
          background: done ? '#14532d' : confirmed ? '#b45309' : '#16a34a',
          color: '#fff',
          boxShadow: done || confirmed ? 'none' : '0 0 12px #16a34a44',
        }}
      >
        {importing ? 'Importing…' : done ? '✓ Imported' : confirmed ? 'Confirm Import' : 'Import Historical Matches'}
      </button>
    </div>
  )
}

// ─── Change PIN form ─────────────────────────────────────────────
function ChangePinForm({ changePin }) {
  const [newPin, setNewPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState(null)

  function handleSubmit(e) {
    e.preventDefault()
    if (!/^\d{4}$/.test(newPin)) {
      setMsg({ ok: false, text: 'PIN must be exactly 4 digits.' })
      return
    }
    if (newPin !== confirm) {
      setMsg({ ok: false, text: 'PINs do not match.' })
      return
    }
    changePin(newPin)
    setNewPin('')
    setConfirm('')
    setMsg({ ok: true, text: 'PIN changed.' })
    setTimeout(() => setMsg(null), 2500)
  }

  const inputStyle = {
    background: '#1c2330',
    border: '1px solid #252d3a',
    color: '#f1f5f9',
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 pb-4 pt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] block mb-1">New PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={newPin}
            onChange={(e) => { setNewPin(e.target.value.replace(/\D/g, '')); setMsg(null) }}
            placeholder="····"
            className="w-full rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] block mb-1">Confirm</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value.replace(/\D/g, '')); setMsg(null) }}
            placeholder="····"
            className="w-full rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
            style={inputStyle}
          />
        </div>
      </div>
      {msg && (
        <p className="text-xs" style={{ color: msg.ok ? '#16a34a' : '#ef4444' }}>{msg.text}</p>
      )}
      <button
        type="submit"
        className="w-full py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider"
        style={{ background: '#141920', border: '1px solid #252d3a', color: '#64748b' }}
      >
        Update PIN
      </button>
    </form>
  )
}

// ─── Shared sub-components ───────────────────────────────────────
function Section({ title, titleColor = '#64748b', icon, children }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#141920', border: '1px solid #252d3a' }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid #252d3a' }}>
        {icon && <span className="text-base leading-none">{icon}</span>}
        <h2
          className="text-xs font-bold uppercase tracking-[0.2em]"
          style={{ fontFamily: "'Oswald', sans-serif", color: titleColor }}
        >
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}

function FieldGroup({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#334155] mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {children}
      </div>
    </div>
  )
}

function NumField({ label, value, onChange }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <label className="text-[9px] font-bold uppercase tracking-wider text-[#64748b]">{label}</label>
      <input
        type="number"
        min="0"
        value={value}
        onChange={onChange}
        className="w-14 rounded-lg px-1 py-2 text-sm text-center text-[#f1f5f9] focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
        style={{ background: '#1c2330', border: '1px solid #252d3a', fontFamily: "'Oswald', sans-serif" }}
      />
    </div>
  )
}
