import { TEAM } from '../../lib/constants'
import { MinusIcon, PlusIcon } from '../icons'

// − [ n ] + score entry. `value` is '' (not set) or a non-negative integer string.
export default function ScoreStepper({ side, value, onChange }) {
  const team = TEAM[side]
  const set = (n) => onChange(String(Math.max(0, Math.min(99, n))))
  const current = Number(value) || 0
  const filled = value !== '' && value != null

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="eyebrow" style={{ color: team.text }}>{team.label}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label={`${team.label} minus one`} onClick={() => set(current - 1)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-raised text-mist active:scale-90">
          <MinusIcon className="w-4 h-4" />
        </button>
        <input
          type="number" inputMode="numeric" min="0" max="99" placeholder="–"
          aria-label={`${team.label} score`}
          value={value}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '') onChange('')
            else if (/^\d+$/.test(raw)) set(Number(raw))
          }}
          className="scorebox h-16 w-14 text-center text-[46px] placeholder:text-ghost focus:outline-none"
          style={{ color: filled ? team.text : '#475569', borderColor: filled ? `${team.color}88` : undefined }}
        />
        <button type="button" aria-label={`${team.label} plus one`} onClick={() => set(current + 1)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-raised text-mist active:scale-90">
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
