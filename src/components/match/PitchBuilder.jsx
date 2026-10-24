import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useApp } from '../../context/app-context'
import { TEAM } from '../../lib/constants'
import { firstName, initialOf } from '../../lib/format'
import { CloseIcon, SearchIcon } from '../icons'
import PlayerAvatar from '../PlayerAvatar'
import { layOutTeam } from './formations'

const DRAG_THRESHOLD = 8 // px of movement before a press becomes a drag
const ids = (placed) => placed.map((p) => p.playerId)

// Free-form pitch. Tap a player then tap the pitch, or drag. Whichever half a player lands in
// decides their team: top = Team A, bottom = Team B. Drag off the pitch to send them back.
//
// Mount with key={format} so switching format (7 / 9 / 10-a-side) re-lays the teams out.
export default function PitchBuilder({ teamA, teamB, format, onChange }) {
  const { players, playerById } = useApp()
  const [placedA, setPlacedA] = useState(() => layOutTeam(teamA, playerById, 'A', format))
  const [placedB, setPlacedB] = useState(() => layOutTeam(teamB, playerById, 'B', format))
  const [selected, setSelected] = useState(null) // playerId | null
  const [ghost, setGhost] = useState(null)       // { x, y, playerId } while dragging
  const [query, setQuery] = useState('')

  const pitchRef = useRef(null)
  // Latest values for the window-level pointer listeners (avoids stale closures)
  const live = useRef({ placedA, placedB, onChange, pending: null, drag: null, wasDrag: false })
  useLayoutEffect(() => {
    live.current.placedA = placedA
    live.current.placedB = placedB
    live.current.onChange = onChange
  })

  const commit = useCallback((nextA, nextB) => {
    live.current.placedA = nextA
    live.current.placedB = nextB
    setPlacedA(nextA)
    setPlacedB(nextB)
    live.current.onChange(ids(nextA), ids(nextB))
  }, [])

  const place = useCallback((playerId, rawX, rawY) => {
    const x = Math.max(6, Math.min(94, rawX))
    const y = Math.max(4, Math.min(96, rawY))
    const nextA = live.current.placedA.filter((p) => p.playerId !== playerId)
    const nextB = live.current.placedB.filter((p) => p.playerId !== playerId)
    ;(y < 50 ? nextA : nextB).push({ playerId, x, y })
    commit(nextA, nextB)
  }, [commit])

  const remove = useCallback((playerId) => {
    commit(
      live.current.placedA.filter((p) => p.playerId !== playerId),
      live.current.placedB.filter((p) => p.playerId !== playerId),
    )
  }, [commit])

  const toPitchPercent = (clientX, clientY) => {
    const rect = pitchRef.current.getBoundingClientRect()
    return [((clientX - rect.left) / rect.width) * 100, ((clientY - rect.top) / rect.height) * 100]
  }

  // A click that ends a drag must not also count as a tap
  const swallowIfDrag = () => {
    if (!live.current.wasDrag) return false
    live.current.wasDrag = false
    return true
  }

  function handlePitchClick(e) {
    if (swallowIfDrag() || !selected) return
    place(selected, ...toPitchPercent(e.clientX, e.clientY))
    setSelected(null)
  }

  function handleTokenTap(e, playerId) {
    e.stopPropagation()
    if (swallowIfDrag()) return
    setSelected((prev) => (prev === playerId ? null : playerId))
  }

  function handlePointerDown(e, playerId) {
    live.current.wasDrag = false
    live.current.pending = { playerId, startX: e.clientX, startY: e.clientY, pointerId: e.pointerId }
  }

  // Window-level pointer tracking so a drag keeps working outside the pitch
  useEffect(() => {
    function onMove(e) {
      const { pending, drag } = live.current
      if (drag) {
        if (drag.pointerId === e.pointerId) setGhost({ x: e.clientX, y: e.clientY, playerId: drag.playerId })
        return
      }
      if (!pending || pending.pointerId !== e.pointerId) return
      if (Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY) > DRAG_THRESHOLD) {
        live.current.drag = pending
        live.current.pending = null
        live.current.wasDrag = true
        setSelected(null)
        setGhost({ x: e.clientX, y: e.clientY, playerId: pending.playerId })
      }
    }
    function onUp(e) {
      live.current.pending = null
      const drag = live.current.drag
      if (!drag || drag.pointerId !== e.pointerId) return
      live.current.drag = null
      setGhost(null)
      if (!pitchRef.current) return
      const rect = pitchRef.current.getBoundingClientRect()
      const px = ((e.clientX - rect.left) / rect.width) * 100
      const py = ((e.clientY - rect.top) / rect.height) * 100
      const onPitch = px >= -5 && px <= 105 && py >= -5 && py <= 105
      if (onPitch) place(drag.playerId, px, py)
      else remove(drag.playerId)
    }
    // The browser took over the gesture (e.g. scrolling the bench) — abandon any drag
    function onCancel() {
      live.current.pending = null
      live.current.drag = null
      setGhost(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [place, remove])

  const onPitch = new Set([...ids(placedA), ...ids(placedB)])
  const q = query.trim().toLowerCase()
  const bench = players
    .filter((p) => !onPitch.has(p.id) && (!q || p.name.toLowerCase().includes(q)))
    .sort((a, b) => Number(!!a.injured) - Number(!!b.injured) || a.name.localeCompare(b.name))
  const benchTotal = players.length - onPitch.size

  const selectedPlayer = selected ? playerById.get(selected) : null
  const ghostPlayer = ghost ? playerById.get(ghost.playerId) : null
  const dragging = !!ghost

  return (
    <div className="space-y-3">
      {/* Follows the pointer during a drag */}
      {ghostPlayer && (
        <div className="pointer-events-none fixed z-[200] -translate-x-1/2 -translate-y-1/2" style={{ left: ghost.x, top: ghost.y }}>
          <PlayerAvatar player={ghostPlayer} size={48} ring="#ffffff" className="opacity-90 shadow-[0_8px_20px_rgba(0,0,0,0.7)]" />
        </div>
      )}

      {/* Pitch */}
      <div
        ref={pitchRef}
        onClick={handlePitchClick}
        className="relative w-full select-none overflow-hidden rounded-[20px] border border-line"
        style={{
          aspectRatio: '3 / 4',
          background: 'repeating-linear-gradient(180deg, #17642a 0 12.5%, #1a6f2f 12.5% 25%)',
          cursor: selected && !dragging ? 'crosshair' : 'default',
          boxShadow: selected ? '0 0 0 2px rgba(255,255,255,0.35)' : 'inset 0 0 60px rgba(0,0,0,0.35)',
        }}
      >
        <PitchLines />
        <HalfLabel side="A" count={placedA.length} />
        <HalfLabel side="B" count={placedB.length} />

        {[['A', placedA], ['B', placedB]].flatMap(([side, list]) =>
          list.map((entry) => {
            const player = playerById.get(entry.playerId)
            if (!player) return null
            return (
              <PitchToken
                key={entry.playerId}
                player={player}
                entry={entry}
                side={side}
                selected={selected === entry.playerId}
                hidden={dragging && ghost.playerId === entry.playerId}
                onClick={(e) => handleTokenTap(e, entry.playerId)}
                onPointerDown={(e) => handlePointerDown(e, entry.playerId)}
              />
            )
          }),
        )}
      </div>

      {/* Hint / selection bar */}
      <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2">
        {selectedPlayer ? (
          <>
            <PlayerAvatar player={selectedPlayer} size={26} />
            <p className="min-w-0 flex-1 truncate text-sm text-ink">
              <span className="font-semibold">{selectedPlayer.name}</span>
              <span className="text-muted"> · tap the pitch to place</span>
            </p>
            {onPitch.has(selected) && (
              <button type="button" className="btn btn-sm btn-danger" onClick={() => { remove(selected); setSelected(null) }}>
                Bench
              </button>
            )}
            <button type="button" aria-label="Cancel selection" className="p-1.5 text-muted" onClick={() => setSelected(null)}>
              <CloseIcon className="w-4 h-4" />
            </button>
          </>
        ) : (
          <p className="text-xs text-muted">
            Tap a player, then tap the pitch. <span className="text-green-bright">Top half = Team A</span>,{' '}
            <span className="text-blue-bright">bottom = Team B</span>. Drag to fine-tune.
          </p>
        )}
      </div>

      {/* Bench */}
      <div className="card p-3">
        <div className="mb-3 flex items-center gap-3">
          <p className="eyebrow shrink-0">Bench · {benchTotal}</p>
          <label className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a player" aria-label="Find a player"
              className="field min-h-10 py-1.5 pl-9"
            />
          </label>
        </div>
        {bench.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted">
            {benchTotal === 0 ? 'Everyone is on the pitch.' : 'No one matches that search.'}
          </p>
        ) : (
          <div className="no-scrollbar -mx-3 flex gap-3 overflow-x-auto px-3 pb-1">
            {bench.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={(e) => handleTokenTap(e, p.id)}
                onPointerDown={(e) => handlePointerDown(e, p.id)}
                // pan-x: a sideways swipe scrolls the bench, an upward drag carries the player to the pitch
                style={{ touchAction: 'pan-x' }}
                className={`flex w-14 shrink-0 flex-col items-center gap-1.5 transition-transform active:scale-90 ${p.injured ? 'opacity-45' : ''}`}
              >
                <PlayerAvatar player={p} size={46} ring={selected === p.id ? '#ffffff' : null} />
                <span className="w-full truncate text-center text-[11px] font-medium text-mist">
                  {p.injured ? '🩹 ' : ''}{firstName(p.name)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function HalfLabel({ side, count }) {
  const team = TEAM[side]
  return (
    <span
      className={`chip pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 ${side === 'A' ? 'top-2' : 'bottom-2'}`}
      style={{ background: team.dim, color: team.text, borderColor: `${team.color}66` }}
    >
      {team.label} · {count}
    </span>
  )
}

function PitchLines() {
  return (
    <svg viewBox="0 0 300 400" className="pointer-events-none absolute inset-0 h-full w-full opacity-40" fill="none" stroke="#fff" aria-hidden="true">
      <rect x="12" y="12" width="276" height="376" strokeWidth="2" />
      <path d="M12 200h276" strokeWidth="1.5" />
      <circle cx="150" cy="200" r="36" strokeWidth="1.5" />
      <circle cx="150" cy="200" r="3" fill="#fff" />
      <rect x="82" y="12" width="136" height="58" />
      <rect x="118" y="4" width="64" height="8" strokeWidth="1.5" />
      <rect x="82" y="330" width="136" height="58" />
      <rect x="118" y="388" width="64" height="8" strokeWidth="1.5" />
    </svg>
  )
}

function PitchToken({ player, entry, side, selected, hidden, onClick, onPointerDown }) {
  const team = TEAM[side]
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      aria-label={`${player.name}, ${team.label}`}
      className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 transition-opacity"
      style={{ left: `${entry.x}%`, top: `${entry.y}%`, touchAction: 'none', opacity: hidden ? 0.15 : 1 }}
    >
      <span
        className="flex items-center justify-center rounded-full"
        style={{
          width: 40, height: 40,
          background: team.dim,
          border: `2px solid ${selected ? '#fff' : team.color}`,
          boxShadow: selected ? `0 0 0 3px ${team.color}77, 0 0 18px ${team.color}` : '0 3px 8px rgba(0,0,0,0.45)',
        }}
      >
        {player.avatarUrl ? (
          <img src={player.avatarUrl} alt="" draggable={false} className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="font-display text-sm font-semibold" style={{ color: team.text }}>{initialOf(player.name)}</span>
        )}
      </span>
      <span className="max-w-[58px] truncate rounded-full bg-black/55 px-1.5 py-px text-[9px] font-semibold leading-tight text-white">
        {firstName(player.name)}
      </span>
    </button>
  )
}
