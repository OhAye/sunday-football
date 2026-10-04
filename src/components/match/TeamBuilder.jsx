import { useState } from 'react'
import { useApp } from '../../context/app-context'
import { POSITION_ORDER, TEAM } from '../../lib/constants'
import { CloseIcon, SearchIcon, SwapIcon } from '../icons'
import { PositionTag } from '../ui'
import PlayerAvatar from '../PlayerAvatar'

// List view of the lineup: two team columns and the unassigned squad below.
export default function TeamBuilder({ teamA, teamB, onChange }) {
  const { players, playerById } = useApp()
  const [query, setQuery] = useState('')

  const without = (list, id) => list.filter((x) => x !== id)
  const assign = (id, side) =>
    side === 'A' ? onChange([...without(teamA, id), id], without(teamB, id)) : onChange(without(teamA, id), [...without(teamB, id), id])
  const unassign = (id) => onChange(without(teamA, id), without(teamB, id))

  const assigned = new Set([...teamA, ...teamB])
  const q = query.trim().toLowerCase()
  const pool = players
    .filter((p) => !assigned.has(p.id) && (!q || p.name.toLowerCase().includes(q)))
    .sort((a, b) =>
      Number(!!a.injured) - Number(!!b.injured) ||
      (POSITION_ORDER[a.position] ?? 2) - (POSITION_ORDER[b.position] ?? 2) ||
      a.name.localeCompare(b.name))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        {[['A', teamA], ['B', teamB]].map(([side, list]) => {
          const team = TEAM[side]
          const other = side === 'A' ? 'B' : 'A'
          return (
            <div key={side} className="card min-h-28 p-2.5" style={{ borderColor: `${team.color}44` }}>
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="eyebrow" style={{ color: team.text }}>{team.label}</p>
                <span className="num pt-1 text-xl" style={{ color: team.text }}>{list.length}</span>
              </div>
              {list.length === 0 ? (
                <p className="px-1 py-3 text-xs text-muted">Add players from the squad below.</p>
              ) : (
                <ul className="space-y-1.5">
                  {list.map((id) => {
                    const p = playerById.get(id)
                    if (!p) return null
                    return (
                      <li key={id} className="flex items-center gap-1.5 rounded-xl py-1 pl-2 pr-1" style={{ background: team.dim }}>
                        <PlayerAvatar player={p} size={20} />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{p.name}</span>
                        <button type="button" aria-label={`Move ${p.name} to ${TEAM[other].label}`} onClick={() => assign(id, other)}
                          className="flex h-8 w-7 items-center justify-center text-soft/80">
                          <SwapIcon className="w-3.5 h-3.5 rotate-90" />
                        </button>
                        <button type="button" aria-label={`Remove ${p.name}`} onClick={() => unassign(id)}
                          className="flex h-8 w-7 items-center justify-center text-soft/60">
                          <CloseIcon className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <div className="card p-3">
        <div className="mb-3 flex items-center gap-3">
          <p className="eyebrow shrink-0">Squad · {players.length - assigned.size}</p>
          <label className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a player" aria-label="Find a player" className="field min-h-10 py-1.5 pl-9" />
          </label>
        </div>
        {pool.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted">
            {players.length === assigned.size ? 'Everyone is in a team.' : 'No one matches that search.'}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {pool.map((p) => (
              <li key={p.id} className={`flex items-center gap-2.5 rounded-xl border border-line bg-raised py-1.5 pl-2.5 pr-1.5 ${p.injured ? 'opacity-50' : ''}`}>
                <PlayerAvatar player={p} size={26} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{p.injured ? '🩹 ' : ''}{p.name}</span>
                <PositionTag player={p} />
                {['A', 'B'].map((side) => (
                  <button key={side} type="button" aria-label={`Add ${p.name} to ${TEAM[side].label}`} onClick={() => assign(p.id, side)}
                    className="font-display h-9 w-10 rounded-lg text-sm font-semibold active:scale-90"
                    style={{ background: TEAM[side].dim, color: TEAM[side].text, border: `1px solid ${TEAM[side].color}55` }}>
                    {side}
                  </button>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
