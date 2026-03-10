import { useState } from 'react'
import { useApp } from '../context/AppContext'

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD']

const POSITION_META = {
  GK:  { label: 'GK',  full: 'Goalkeeper', color: '#f59e0b', bg: '#3d2c00', border: '#f59e0b44' },
  DEF: { label: 'DEF', full: 'Defender',   color: '#3b82f6', bg: '#1e3a5f', border: '#3b82f644' },
  MID: { label: 'MID', full: 'Midfielder', color: '#16a34a', bg: '#14532d', border: '#16a34a44' },
  FWD: { label: 'FWD', full: 'Forward',    color: '#ef4444', bg: '#3d1515', border: '#ef444444' },
}

const POSITION_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 }

export default function Players() {
  const { players, addPlayer, removePlayer, getPlayerStats } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('ALL')

  const sorted = [...players].sort((a, b) => {
    const pd = POSITION_ORDER[a.position ?? 'MID'] - POSITION_ORDER[b.position ?? 'MID']
    return pd !== 0 ? pd : a.name.localeCompare(b.name)
  })

  const filtered = filter === 'ALL' ? sorted : sorted.filter((p) => p.position === filter)

  const counts = POSITIONS.reduce((acc, pos) => {
    acc[pos] = players.filter((p) => p.position === pos).length
    return acc
  }, {})

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="px-5 pt-10 pb-5" style={{ background: 'linear-gradient(to bottom, #0f1a12, #0b0f14)' }}>
        <p className="text-[#16a34a] text-xs font-semibold tracking-[0.25em] uppercase mb-1">Squad</p>
        <div className="flex items-end justify-between">
          <div>
            <h1
              className="text-3xl font-bold uppercase text-[#f1f5f9] leading-none"
              style={{ fontFamily: "'Oswald', sans-serif" }}
            >
              Players
            </h1>
            <p className="text-[#64748b] text-sm mt-1">{players.length} in the squad</p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-xl transition-colors"
            style={{
              fontFamily: "'Oswald', sans-serif",
              background: showForm ? '#1c2330' : '#16a34a',
              color: showForm ? '#64748b' : '#fff',
              border: showForm ? '1px solid #252d3a' : 'none',
            }}
          >
            {showForm ? 'Cancel' : '+ Add Player'}
          </button>
        </div>
      </header>

      <div className="px-4 space-y-4 pb-4">
        {/* Add player form */}
        {showForm && (
          <AddPlayerForm
            players={players}
            onSave={(data) => { addPlayer(data); setShowForm(false) }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Position filter tabs */}
        {players.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <FilterTab label="All" count={players.length} active={filter === 'ALL'} onClick={() => setFilter('ALL')} color="#16a34a" />
            {POSITIONS.map((pos) => (
              counts[pos] > 0 && (
                <FilterTab
                  key={pos}
                  label={pos}
                  count={counts[pos]}
                  active={filter === pos}
                  onClick={() => setFilter(pos)}
                  color={POSITION_META[pos].color}
                />
              )
            ))}
          </div>
        )}

        {/* Player grid */}
        {filtered.length === 0 ? (
          <p className="text-[#64748b] text-sm pt-2">
            {players.length === 0 ? 'No players yet. Tap + Add Player to get started.' : 'No players in this position.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((player) => (
              <PlayerCard key={player.id} player={player} stats={getPlayerStats(player.id)} onRemove={() => removePlayer(player.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Add Player Form ─────────────────────────────────────────── */

function AddPlayerForm({ players, onSave, onCancel }) {
  const [name, setName] = useState('')
  const [position, setPosition] = useState('MID')
  const [number, setNumber] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Name is required.'); return }
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A player with that name already exists.')
      return
    }
    if (number && (isNaN(Number(number)) || Number(number) < 1 || Number(number) > 99)) {
      setError('Shirt number must be between 1 and 99.')
      return
    }
    onSave({ name: trimmed, position, number: number || null })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl p-4 space-y-4"
      style={{ background: '#141920', border: '1px solid #16a34a55' }}
    >
      <h2
        className="text-sm font-bold uppercase tracking-[0.2em] text-[#f1f5f9]"
        style={{ fontFamily: "'Oswald', sans-serif" }}
      >
        New Player
      </h2>

      {/* Name */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-widest text-[#64748b] font-semibold">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError('') }}
          placeholder="e.g. Marcus"
          autoFocus
          className="w-full rounded-xl px-4 py-3 text-sm text-[#f1f5f9] placeholder-[#334155] focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
          style={{ background: '#1c2330', border: '1px solid #252d3a' }}
        />
      </div>

      {/* Position selector */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-widest text-[#64748b] font-semibold">Position</label>
        <div className="grid grid-cols-4 gap-2">
          {POSITIONS.map((pos) => {
            const meta = POSITION_META[pos]
            const active = position === pos
            return (
              <button
                key={pos}
                type="button"
                onClick={() => setPosition(pos)}
                className="py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                style={{
                  fontFamily: "'Oswald', sans-serif",
                  background: active ? meta.bg : '#1c2330',
                  color: active ? meta.color : '#64748b',
                  border: `1px solid ${active ? meta.color : '#252d3a'}`,
                  boxShadow: active ? `0 0 10px ${meta.color}33` : 'none',
                }}
              >
                {pos}
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-[#64748b]">{POSITION_META[position].full}</p>
      </div>

      {/* Shirt number */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-widest text-[#64748b] font-semibold">
          Shirt Number <span className="text-[#334155] normal-case tracking-normal">(optional)</span>
        </label>
        <input
          type="number"
          value={number}
          onChange={(e) => { setNumber(e.target.value); setError('') }}
          placeholder="1 – 99"
          min="1"
          max="99"
          className="w-24 rounded-xl px-4 py-3 text-sm text-[#f1f5f9] placeholder-[#334155] focus:outline-none focus:ring-2 focus:ring-[#16a34a] text-center"
          style={{
            fontFamily: "'Oswald', sans-serif",
            background: '#1c2330',
            border: '1px solid #252d3a',
          }}
        />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        type="submit"
        className="w-full py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-colors"
        style={{ fontFamily: "'Oswald', sans-serif", background: '#16a34a', color: '#fff' }}
      >
        Add to Squad
      </button>
    </form>
  )
}

/* ─── Player Card ─────────────────────────────────────────────── */

function PlayerCard({ player, stats, onRemove }) {
  const pos = player.position ?? 'MID'
  const meta = POSITION_META[pos]

  function handleDelete(e) {
    e.stopPropagation()
    if (confirm(`Remove ${player.name} from the squad?`)) onRemove()
  }

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col relative"
      style={{ background: '#141920', border: '1px solid #252d3a' }}
    >
      {/* Top band with shirt number + position */}
      <div
        className="px-3 pt-3 pb-2 flex items-start justify-between"
        style={{ background: meta.bg, borderBottom: `1px solid ${meta.border}` }}
      >
        {/* Shirt number */}
        <span
          className="text-4xl font-bold leading-none"
          style={{ fontFamily: "'Oswald', sans-serif", color: meta.color, opacity: player.number ? 1 : 0.2 }}
        >
          {player.number ?? '?'}
        </span>

        {/* Position badge + delete */}
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={handleDelete}
            className="w-6 h-6 flex items-center justify-center rounded-full transition-colors"
            style={{ background: '#00000033', color: meta.color }}
            aria-label="Remove player"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3 h-3">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: '#00000044', color: meta.color, border: `1px solid ${meta.color}55` }}
          >
            {pos}
          </span>
        </div>
      </div>

      {/* Name */}
      <div className="px-3 pt-2.5 pb-1">
        <p
          className="text-base font-bold uppercase leading-tight text-[#f1f5f9] truncate"
          style={{ fontFamily: "'Oswald', sans-serif" }}
        >
          {player.name}
        </p>
      </div>

      {/* Stats row */}
      <div className="px-3 pb-3 mt-auto">
        {stats.played > 0 ? (
          <div className="flex items-center gap-2 mt-1">
            <Stat label="P" value={stats.played} />
            <span className="text-[#252d3a]">·</span>
            <Stat label="W" value={stats.wins} color="#22c55e" />
            <span className="text-[#252d3a]">·</span>
            <Stat label="G" value={stats.goals} color="#60a5fa" />
            {stats.played > 0 && (
              <>
                <span className="text-[#252d3a]">·</span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto"
                  style={{
                    background: stats.wins / stats.played >= 0.6 ? '#14532d' : '#1c2330',
                    color: stats.wins / stats.played >= 0.6 ? '#22c55e' : '#64748b',
                  }}
                >
                  {Math.round((stats.wins / stats.played) * 100)}%
                </span>
              </>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-[#334155] mt-1">No games yet</p>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, color = '#64748b' }) {
  return (
    <span className="text-[10px] font-semibold" style={{ color }}>
      {value}<span className="text-[#334155] ml-0.5">{label}</span>
    </span>
  )
}

/* ─── Filter Tab ──────────────────────────────────────────────── */

function FilterTab({ label, count, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
      style={{
        fontFamily: "'Oswald', sans-serif",
        background: active ? color + '22' : '#141920',
        color: active ? color : '#64748b',
        border: `1px solid ${active ? color : '#252d3a'}`,
      }}
    >
      {label}
      <span
        className="text-[10px] px-1 rounded-full"
        style={{ background: active ? color + '33' : '#1c2330', color: active ? color : '#334155' }}
      >
        {count}
      </span>
    </button>
  )
}
