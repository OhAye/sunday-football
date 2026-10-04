import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/app-context'
import { POSITIONS, POSITION_META, REGULAR_THRESHOLD, positionOf } from '../lib/constants'
import { pct, plural } from '../lib/format'
import { EmptyState, FormDots, Loading, PageHeader, Pills, WinPill } from '../components/ui'
import { CameraIcon, ChevronDownIcon, EditIcon, LockIcon, PlusIcon, SearchIcon } from '../components/icons'
import { AddPlayerSheet, AvatarSheet, EditPlayerSheet } from '../components/squad/PlayerSheets'
import PlayerAvatar from '../components/PlayerAvatar'
import FireIcon from '../components/FireIcon'
import FrostIcon from '../components/FrostIcon'

const POSITION_FILTERS = [{ value: 'ALL', label: 'All' }, ...POSITIONS.map((p) => ({ value: p, label: p }))]

// Squad tab. Anyone can browse and update their own photo (PIN); admins can add and edit players.
export default function Players() {
  const { players, sessionsLoaded, isAdmin, getPlayerStats, getAttendance, firePlayerIds, frostPlayerIds } = useApp()
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState('ALL')
  const [showOthers, setShowOthers] = useState(false)
  const [sheet, setSheet] = useState(null) // null | { type: 'add' } | { type: 'edit' | 'avatar', id }

  if (!sessionsLoaded) return <Loading />

  const q = query.trim().toLowerCase()
  const rows = players
    .filter((p) => (position === 'ALL' || positionOf(p) === position) && (!q || p.name.toLowerCase().includes(q)))
    .map((p) => ({ player: p, stats: getPlayerStats(p.id), attendance: getAttendance(p.id) }))
    .sort((a, b) => a.player.name.localeCompare(b.player.name))
  const regulars = rows.filter((r) => r.stats.played >= REGULAR_THRESHOLD)
  const others = rows.filter((r) => r.stats.played < REGULAR_THRESHOLD)
  const othersOpen = showOthers || !!q // searching should never hide a match behind a collapsed group

  // Look the player up fresh so an open sheet always shows current data
  const sheetPlayer = sheet?.id ? players.find((p) => p.id === sheet.id) : null
  const card = (r) => (
    <PlayerCard
      key={r.player.id} {...r} isAdmin={isAdmin}
      fire={firePlayerIds.has(r.player.id)} frost={frostPlayerIds.has(r.player.id)}
      onAvatar={() => setSheet({ type: 'avatar', id: r.player.id })}
      onEdit={() => setSheet({ type: 'edit', id: r.player.id })}
    />
  )

  return (
    <div className="flex flex-col">
      <PageHeader
        kicker="Squad"
        title="Players"
        sub={`${plural(players.length, 'player')} · ${players.filter((p) => p.injured).length} injured`}
        action={
          isAdmin ? (
            <button type="button" className="btn btn-primary" onClick={() => setSheet({ type: 'add' })}>
              <PlusIcon className="w-4 h-4" strokeWidth={2.4} /> Add
            </button>
          ) : (
            <Link to="/admin" aria-label="Admin" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-muted">
              <LockIcon className="w-4 h-4" />
            </Link>
          )
        }
      />

      <div className="space-y-4 px-4">
        <label className="relative block">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the squad" aria-label="Search the squad" className="field pl-10" />
        </label>
        <Pills options={POSITION_FILTERS} value={position} onChange={setPosition} />

        {players.length === 0 ? (
          <EmptyState icon="👟" title="No players yet" body={isAdmin ? 'Add your first player to get started.' : 'An admin needs to add the squad.'} />
        ) : rows.length === 0 ? (
          <EmptyState icon="🔍" title="No one found" body="Try a different name or position." />
        ) : (
          <>
            {regulars.length > 0 && (
              <section>
                <GroupHeading title="Regulars" note={`${REGULAR_THRESHOLD}+ games`} count={regulars.length} />
                <div className="stagger grid grid-cols-2 gap-2.5">{regulars.map(card)}</div>
              </section>
            )}
            {others.length > 0 && (
              <section>
                <button type="button" onClick={() => setShowOthers((v) => !v)} aria-expanded={othersOpen} className="w-full text-left">
                  <GroupHeading
                    title="Occasional" note={`under ${REGULAR_THRESHOLD} games`} count={others.length}
                    trailing={!q && <ChevronDownIcon className={`w-4 h-4 text-muted transition-transform ${othersOpen ? 'rotate-180' : ''}`} />}
                  />
                </button>
                {othersOpen && <div className="grid grid-cols-2 gap-2.5">{others.map(card)}</div>}
              </section>
            )}
          </>
        )}
      </div>

      {sheet?.type === 'add' && isAdmin && <AddPlayerSheet onClose={() => setSheet(null)} />}
      {sheet?.type === 'edit' && isAdmin && sheetPlayer && <EditPlayerSheet player={sheetPlayer} onClose={() => setSheet(null)} />}
      {sheet?.type === 'avatar' && sheetPlayer && <AvatarSheet player={sheetPlayer} onClose={() => setSheet(null)} />}
    </div>
  )
}

function GroupHeading({ title, note, count, trailing }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="eyebrow text-soft">{title}</h2>
      <span className="chip chip-neutral">{count}</span>
      <span className="text-[11px] text-muted">{note}</span>
      <span className="ml-auto">{trailing}</span>
    </div>
  )
}

function PlayerCard({ player, stats, attendance, isAdmin, fire, frost, onAvatar, onEdit }) {
  const pos = positionOf(player)
  const meta = POSITION_META[pos]
  const winPct = pct(stats.wins, stats.played)

  return (
    <article
      className="card relative overflow-hidden p-3"
      style={player.injured ? { borderColor: 'rgba(239,68,68,0.4)' } : undefined}
    >
      {/* position colour bar */}
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px]" style={{ background: meta.color }} />

      <div className="flex items-start gap-2.5">
        <button type="button" onClick={onAvatar} aria-label={`Change ${player.name}'s photo`} className="relative shrink-0 rounded-full">
          <PlayerAvatar player={player} size={46} ring={`${meta.color}aa`} />
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-raised text-mist">
            <CameraIcon className="w-2.5 h-2.5" strokeWidth={2.2} />
          </span>
        </button>
        <Link to={`/player/${player.id}`} className="min-w-0 flex-1">
          <p className="display truncate text-[17px] leading-tight text-ink">{player.name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: meta.color }}>
            {pos}
            {player.number && <span className="text-muted">#{player.number}</span>}
            {fire && <FireIcon size={11} />}
            {frost && <FrostIcon size={11} />}
          </p>
        </Link>
        {isAdmin && (
          <button type="button" onClick={onEdit} aria-label={`Edit ${player.name}`}
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted active:bg-raised">
            <EditIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <Link to={`/player/${player.id}`} className="mt-3 block">
        <div className="flex items-center justify-between">
          <p className="text-xs text-mist">
            <span className="font-semibold text-ink">{stats.played}</span> {stats.played === 1 ? 'game' : 'games'}
          </p>
          {player.injured ? <span className="chip chip-red">Out</span> : <WinPill pct={winPct} />}
        </div>
        <div className="mt-2.5 flex h-2 items-center">
          {attendance.last10.length > 0
            ? <FormDots items={attendance.last10} size={8} />
            : <span className="text-[10px] text-faint">No recent games</span>}
        </div>
      </Link>
    </article>
  )
}
