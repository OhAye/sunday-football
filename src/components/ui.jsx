// Shared building blocks. Styling lives in index.css (.card, .btn, .chip …); these add structure.
import { Link, useNavigate } from 'react-router-dom'
import { POSITION_META, RESULT_COLOR, positionOf, winBg, winColor } from '../lib/constants'
import { ArrowLeftIcon } from './icons'

// ── Page chrome ────────────────────────────────────────────────

// Faint pitch markings behind page headers
function PitchArt() {
  return (
    <svg
      viewBox="0 0 240 240" fill="none" stroke="#22c55e" strokeWidth="1.5" aria-hidden="true"
      className="pointer-events-none absolute -right-20 -top-16 h-72 w-72 opacity-[0.11]"
    >
      <circle cx="120" cy="120" r="62" />
      <circle cx="120" cy="120" r="4" fill="#22c55e" />
      <path d="M0 120h240" />
      <rect x="56" y="-20" width="128" height="62" />
      <rect x="56" y="198" width="128" height="62" />
    </svg>
  )
}

export function PageHeader({ kicker, title, sub, action, back = false, onBack, children, tint }) {
  const navigate = useNavigate()
  function goBack() {
    if (onBack) return onBack()
    // Opened from a shared link? There's no history to go back to.
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }
  return (
    <header
      className="grain hero-enter relative overflow-hidden px-5 pb-5"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 30px)',
        background: tint ? `linear-gradient(180deg, ${tint} 0%, transparent 100%)` : undefined,
      }}
    >
      <PitchArt />
      <div className="relative z-10">
        {back && (
          <button
            type="button" onClick={goBack}
            className="-ml-1 mb-4 inline-flex min-h-9 items-center gap-1.5 rounded-full pr-3 text-xs font-semibold uppercase tracking-widest text-muted"
          >
            <ArrowLeftIcon className="w-4 h-4" /> Back
          </button>
        )}
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {kicker && <p className="kicker mb-2">{kicker}</p>}
            <h1 className="display text-[40px] text-ink">{title}</h1>
            {sub && <p className="mt-2 text-sm text-mist">{sub}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        {children}
      </div>
    </header>
  )
}

export function Loading({ label = 'Loading' }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4" role="status">
      <span className="spin block h-9 w-9 rounded-full border-[3px] border-line border-t-green-bright" />
      <span className="eyebrow">{label}</span>
    </div>
  )
}

// ── Cards ──────────────────────────────────────────────────────

// Card with a titled header row
export function Section({ title, subtitle, icon, tone = 'muted', action, children, className = '' }) {
  const toneClass = { muted: 'text-mist', green: 'text-green-bright', gold: 'text-gold', blue: 'text-blue-bright' }[tone]
  return (
    <section className={`card overflow-hidden ${className}`}>
      <div className="card-head">
        {icon && <span className="text-base leading-none">{icon}</span>}
        <div className="min-w-0 flex-1">
          <h2 className={`eyebrow ${toneClass}`}>{title}</h2>
          {subtitle && <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function EmptyState({ icon = '⚽', title, body, action }) {
  return (
    <div className="card px-6 py-9 text-center">
      <p className="text-4xl">{icon}</p>
      <p className="display mt-3 text-lg text-soft">{title}</p>
      {body && <p className="mx-auto mt-1.5 max-w-64 text-sm text-muted">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

export function StatTile({ value, label, color = '#f1f5f9' }) {
  return (
    <div className="card px-2 pb-3 pt-4 text-center">
      <p className="num text-[42px]" style={{ color }}>{value}</p>
      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
    </div>
  )
}

// ── Controls ───────────────────────────────────────────────────

// options: [{ value, label }]
export function Segmented({ options, value, onChange, green = false, className = '' }) {
  return (
    <div className={`seg ${green ? 'seg-green' : ''} ${className}`} role="group">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Horizontally scrolling filter pills. options: [{ value, label }]
export function Pills({ options, value, onChange, className = '' }) {
  return (
    <div className={`no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 ${className}`} role="group">
      {options.map((o) => (
        <button key={o.value} type="button" className="pill" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Small stat marks ───────────────────────────────────────────

export function PositionTag({ player, className = '' }) {
  const pos = positionOf(player)
  const meta = POSITION_META[pos]
  return (
    <span className={`chip ${className}`} style={{ background: meta.bg, color: meta.color, borderColor: `${meta.color}44` }}>
      {pos}
    </span>
  )
}

export function WinPill({ pct, className = '' }) {
  if (pct === null || pct === undefined) return <span className={`text-xs text-faint ${className}`}>—</span>
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${className}`}
      style={{ background: winBg(pct), color: winColor(pct) }}
    >
      {pct}%
    </span>
  )
}

// Recent results, oldest → newest. items: [{ played, result }] (newest first, as getAttendance returns)
export function FormDots({ items, size = 12, animate = false }) {
  return (
    <div className="flex items-center" style={{ gap: Math.max(3, size / 2) }}>
      {[...items].reverse().map((s, i) => {
        const style = { width: size, height: size, animationDelay: animate ? `${200 + i * 50}ms` : undefined }
        if (!s.played) {
          return (
            <span
              key={i} title="Didn't play"
              className={`rounded-full border border-dashed border-ghost ${animate ? 'pop-in' : ''}`}
              style={style}
            />
          )
        }
        return (
          <span
            key={i} title={s.result ?? 'Played'}
            className={`rounded-full ${animate ? 'pop-in' : ''}`}
            style={{ ...style, background: RESULT_COLOR[s.result] ?? '#334155' }}
          />
        )
      })}
    </div>
  )
}

// W / D / L split as one proportional bar
export function RecordBar({ wins, draws, losses }) {
  const total = wins + draws + losses
  if (!total) return null
  return (
    <div className="bar-grow flex h-1.5 overflow-hidden rounded-full bg-raised">
      <div style={{ width: `${(wins / total) * 100}%`, background: RESULT_COLOR.W }} />
      <div style={{ width: `${(draws / total) * 100}%`, background: RESULT_COLOR.D }} />
      <div style={{ width: `${(losses / total) * 100}%`, background: RESULT_COLOR.L }} />
    </div>
  )
}

export function RecordChips({ wins, draws, losses }) {
  return (
    <div className="flex gap-1.5">
      <span className="chip chip-green">{wins}W</span>
      <span className="chip chip-neutral">{draws}D</span>
      <span className="chip chip-red">{losses}L</span>
    </div>
  )
}

// Text link styled as a quiet inline action
export function TextLink({ to, children, className = '' }) {
  return (
    <Link to={to} className={`text-xs font-semibold uppercase tracking-widest text-green-bright ${className}`}>
      {children}
    </Link>
  )
}
