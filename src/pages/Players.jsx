import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import FireIcon from '../components/FireIcon'

async function uploadAvatar(playerId, file) {
  const ext = file.name.split('.').pop()
  const path = `${playerId}.${ext}`
  const { error } = await supabase.storage
    .from('player-avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from('player-avatars').getPublicUrl(path)
  // Bust cache so updated photos show immediately
  return `${data.publicUrl}?t=${Date.now()}`
}

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD']

const POSITION_META = {
  GK:  { label: 'GK',  full: 'Goalkeeper', color: '#f59e0b', bg: '#3d2c00', border: '#f59e0b44' },
  DEF: { label: 'DEF', full: 'Defender',   color: '#3b82f6', bg: '#1e3a5f', border: '#3b82f644' },
  MID: { label: 'MID', full: 'Midfielder', color: '#16a34a', bg: '#14532d', border: '#16a34a44' },
  FWD: { label: 'FWD', full: 'Forward',    color: '#ef4444', bg: '#3d1515', border: '#ef444444' },
}

const REGULAR_THRESHOLD = 10

export default function Players() {
  const { players, addPlayer, updatePlayer, removePlayer, getPlayerStats, getStreaks, getAttendance, isAdmin } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [avatarTarget, setAvatarTarget] = useState(null)
  const [showNonRegular, setShowNonRegular] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [dragOverPos, setDragOverPos] = useState(null)

  // Get all-time games for each player
  const playersWithStats = players.map((p) => ({
    ...p,
    allTimeGames: getPlayerStats(p.id).played,
  }))

  const regular = playersWithStats.filter((p) => p.allTimeGames >= REGULAR_THRESHOLD)
  const nonRegular = playersWithStats.filter((p) => p.allTimeGames < REGULAR_THRESHOLD)

  function handleDrop(position) {
    if (dragId && isAdmin) {
      updatePlayer(dragId, { position })
    }
    setDragId(null)
    setDragOverPos(null)
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="px-5 pt-10 pb-5 relative overflow-hidden grain hero-enter" style={{ background: 'linear-gradient(to bottom, #0f1a12, #0b0f14)' }}>
        <p className="text-[#16a34a] text-xs font-semibold tracking-[0.25em] uppercase mb-1 relative z-10">Squad</p>
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
          {isAdmin ? (
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
          ) : (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-xl"
              style={{ fontFamily: "'Oswald', sans-serif", background: '#1c2330', color: '#64748b', border: '1px solid #252d3a' }}
            >
              🔒 Admin
            </Link>
          )}
        </div>
      </header>

      {isAdmin && editTarget && (
        <EditPlayerModal
          player={editTarget}
          players={players}
          onSave={(updates) => { updatePlayer(editTarget.id, updates); setEditTarget(null) }}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {avatarTarget && (
        <AvatarOnlyModal
          player={avatarTarget}
          onSave={(updates) => { updatePlayer(avatarTarget.id, updates); setAvatarTarget(null) }}
          onCancel={() => setAvatarTarget(null)}
        />
      )}

      <div className="px-4 space-y-5 pb-6">
        {/* Add player form (admin only) */}
        {isAdmin && showForm && (
          <AddPlayerForm
            players={players}
            onSave={(data) => { addPlayer(data); setShowForm(false) }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {players.length === 0 ? (
          <p className="text-[#64748b] text-sm pt-2">No players yet. Tap + Add Player to get started.</p>
        ) : (
          <>
            {/* ── Regular Players ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <p
                  className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#f1f5f9]"
                  style={{ fontFamily: "'Oswald', sans-serif" }}
                >
                  Regular Players
                </p>
                <span className="text-[10px] px-2 py-0.5 rounded-full text-[#16a34a]"
                  style={{ background: '#14532d' }}>
                  {REGULAR_THRESHOLD}+ games · {regular.length}
                </span>
              </div>
              <PositionBoard
                players={regular}
                isAdmin={isAdmin}
                dragId={dragId}
                dragOverPos={dragOverPos}
                onDragStart={setDragId}
                onDragOver={setDragOverPos}
                onDrop={handleDrop}
                onEdit={setEditTarget}
                onAvatarEdit={setAvatarTarget}
                onRemove={(id) => removePlayer(id)}
                getStats={getPlayerStats}
                getStreaks={getStreaks}
                getAttendance={getAttendance}
              />
            </section>

            {/* ── Non-Regular Players ── */}
            {nonRegular.length > 0 && (
              <section>
                <button
                  onClick={() => setShowNonRegular((v) => !v)}
                  className="flex items-center gap-2 mb-3 w-full text-left"
                >
                  <p
                    className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#64748b]"
                    style={{ fontFamily: "'Oswald', sans-serif" }}
                  >
                    Non-Regular Players
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full text-[#64748b]"
                    style={{ background: '#1c2330' }}>
                    &lt;{REGULAR_THRESHOLD} games · {nonRegular.length}
                  </span>
                  <span className="ml-auto text-[#334155] text-xs">{showNonRegular ? '▲' : '▼'}</span>
                </button>
                {showNonRegular && (
                  <PositionBoard
                    players={nonRegular}
                    isAdmin={isAdmin}
                    dragId={dragId}
                    dragOverPos={dragOverPos}
                    onDragStart={setDragId}
                    onDragOver={setDragOverPos}
                    onDrop={handleDrop}
                    onEdit={setEditTarget}
                    onAvatarEdit={setAvatarTarget}
                    onRemove={(id) => removePlayer(id)}
                    getStats={getPlayerStats}
                getStreaks={getStreaks}
                getAttendance={getAttendance}
                  />
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ─── Position Board (4 columns) ────────────────────────────────── */

function PositionBoard({ players, isAdmin, dragId, dragOverPos, onDragStart, onDragOver, onDrop, onEdit, onAvatarEdit, onRemove, getStats, getStreaks, getAttendance }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollSnapType: 'x mandatory' }}>
      {POSITIONS.map((pos) => {
        const meta = POSITION_META[pos]
        const colPlayers = players.filter((p) => (p.position ?? 'MID') === pos)
        const isDragTarget = dragOverPos === pos

        return (
          <div
            key={pos}
            onDragOver={(e) => { e.preventDefault(); onDragOver(pos) }}
            onDragLeave={() => onDragOver(null)}
            onDrop={() => onDrop(pos)}
            className="rounded-xl flex flex-col min-h-[80px] transition-all shrink-0"
            style={{
              width: 'calc(25vw - 10px)',
              minWidth: 150,
              maxWidth: 220,
              scrollSnapAlign: 'start',
              background: isDragTarget ? meta.bg : '#141920',
              border: `1px solid ${isDragTarget ? meta.color : '#252d3a'}`,
              boxShadow: isDragTarget ? `0 0 12px ${meta.color}33` : 'none',
            }}
          >
            {/* Column header */}
            <div
              className="flex items-center justify-between px-2 py-1.5 rounded-t-xl"
              style={{ background: meta.bg, borderBottom: `1px solid ${meta.border}` }}
            >
              <span
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ fontFamily: "'Oswald', sans-serif", color: meta.color }}
              >
                {pos}
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: '#00000033', color: meta.color }}
              >
                {colPlayers.length}
              </span>
            </div>

            {/* Player chips */}
            <div className="flex flex-col gap-1 p-1.5">
              {colPlayers.map((player) => (
                <PlayerChip
                  key={player.id}
                  player={player}
                  meta={meta}
                  isAdmin={isAdmin}
                  isDragging={dragId === player.id}
                  onDragStart={() => onDragStart(player.id)}
                  onDragEnd={() => { onDragStart(null); onDragOver(null) }}
                  onEdit={() => onEdit(player)}
                  onAvatarEdit={() => onAvatarEdit(player)}
                  onRemove={() => onRemove(player.id)}
                  stats={getStats(player.id)}
                  winStreak={getStreaks(player.id).winStreak}
                  attendance={getAttendance(player.id)}
                />
              ))}
              {colPlayers.length === 0 && (
                <p className="text-[9px] text-[#252d3a] text-center py-2">—</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Player Chip ────────────────────────────────────────────────── */

function PlayerChip({ player, meta, isAdmin, isDragging, onDragStart, onDragEnd, onEdit, onAvatarEdit, onRemove, stats, winStreak = 0, attendance }) {
  function handleDelete(e) {
    e.stopPropagation()
    if (confirm(`Remove ${player.name} from the squad?`)) onRemove()
  }

  return (
    <div
      draggable={isAdmin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="rounded-lg px-2 py-1.5 flex flex-col gap-0.5 transition-all"
      style={{
        background: isDragging ? meta.bg : player.injured ? '#2a1010' : '#1c2330',
        border: `1px solid ${isDragging ? meta.color + '88' : player.injured ? '#ef444466' : '#252d3a'}`,
        opacity: isDragging ? 0.5 : 1,
        cursor: isAdmin ? 'grab' : 'default',
      }}
    >
      {/* Name row — full width */}
      <div className="flex items-center gap-1 min-w-0">
        {/* Avatar — tappable by anyone to update photo */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAvatarEdit() }}
          className="shrink-0 rounded-full overflow-hidden"
          style={{ width: 18, height: 18, border: `1px solid ${player.avatarUrl ? meta.color + '55' : meta.border}` }}
          title="Update photo"
        >
          {player.avatarUrl ? (
            <img src={player.avatarUrl} alt={player.name} className="w-full h-full object-cover" />
          ) : (
            <span
              className="w-full h-full flex items-center justify-center text-[8px] font-bold"
              style={{ background: meta.bg, color: meta.color }}
            >
              {player.name[0].toUpperCase()}
            </span>
          )}
        </button>
        <Link
          to={`/player/${player.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[12px] font-bold uppercase leading-tight truncate flex-1 min-w-0"
          style={{ fontFamily: "'Oswald', sans-serif", color: '#f1f5f9' }}
        >
          {player.name}
        </Link>
        {winStreak >= 3 && stats?.played >= 3 && <FireIcon size={11} />}
        {player.injured && (
          <span
            className="shrink-0 text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded"
            style={{ background: '#ef444433', color: '#ef4444', border: '1px solid #ef444455' }}
          >
            OUT
          </span>
        )}
      </div>

      {/* Stats row + admin buttons */}
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-[#334155]">{stats.played}P</span>
        <span className="text-[9px] text-[#252d3a]">·</span>
        <span className="text-[9px] text-[#22c55e]">{stats.wins}W</span>
        {stats.played > 0 && (
          <>
            <span className="text-[9px] text-[#252d3a]">·</span>
            <span className="text-[9px]" style={{ color: stats.wins / stats.played >= 0.6 ? '#22c55e' : '#64748b' }}>
              {Math.round((stats.wins / stats.played) * 100)}%
            </span>
          </>
        )}
        {attendance?.rate !== null && attendance?.totalSince >= 5 && (
          <>
            <span className="text-[9px] text-[#252d3a]">·</span>
            <span className="text-[9px]" style={{ color: attendance.rate >= 80 ? '#22c55e' : attendance.rate >= 60 ? '#f59e0b' : '#64748b' }}>
              {attendance.rate}%att
            </span>
          </>
        )}
        {player.number && !isAdmin && (
          <span className="text-[9px] text-[#334155] ml-auto">#{player.number}</span>
        )}
        {isAdmin && (
          <div className="flex gap-1 ml-auto shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="w-5 h-5 flex items-center justify-center rounded text-[#64748b] hover:text-[#f1f5f9] transition-colors"
              aria-label="Edit"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                <path d="M11 2l3 3-9 9H2v-3L11 2z" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              className="w-5 h-5 flex items-center justify-center rounded text-[#64748b] hover:text-[#ef4444] transition-colors"
              aria-label="Remove"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-3 h-3">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Last 10 sessions attendance dots (newest left) */}
      {attendance?.last10?.length > 0 && (
        <div className="flex gap-0.5 mt-0.5">
          {attendance.last10.map((s, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{ width: 5, height: 5, background: s.played ? '#16a34a' : '#1c2330', flexShrink: 0 }}
              title={s.date}
            />
          ))}
        </div>
      )}
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

/* ─── Edit Player Modal ────────────────────────────────────────── */

function EditPlayerModal({ player, players, onSave, onCancel }) {
  const [name, setName] = useState(player.name)
  const [position, setPosition] = useState(player.position ?? 'MID')
  const [number, setNumber] = useState(player.number?.toString() ?? '')
  const [injured, setInjured] = useState(player.injured ?? false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(player.avatarUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Name is required.'); return }
    if (players.some((p) => p.id !== player.id && p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A player with that name already exists.')
      return
    }
    if (number && (isNaN(Number(number)) || Number(number) < 1 || Number(number) > 99)) {
      setError('Shirt number must be between 1 and 99.')
      return
    }

    let avatarUrl = player.avatarUrl ?? null
    if (avatarFile) {
      setUploading(true)
      try {
        avatarUrl = await uploadAvatar(player.id, avatarFile)
      } catch (err) {
        console.error('Avatar upload error:', err)
        setError(`Upload failed: ${err?.message ?? err}`)
        setUploading(false)
        return
      }
      setUploading(false)
    }

    onSave({ name: trimmed, position, number: number ? Number(number) : null, injured, avatarUrl })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: '#00000099' }}
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-t-3xl p-6 pb-10 space-y-4"
        style={{ background: '#141920', border: '1px solid #252d3a' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-sm font-bold uppercase tracking-[0.2em] text-[#f1f5f9]"
          style={{ fontFamily: "'Oswald', sans-serif" }}
        >
          Edit Player
        </h2>

        {/* Avatar picker */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative shrink-0 rounded-full overflow-hidden transition-opacity hover:opacity-80"
            style={{ width: 64, height: 64, background: '#1c2330', border: '2px solid #252d3a' }}
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span
                className="w-full h-full flex items-center justify-center text-xl font-bold"
                style={{ fontFamily: "'Oswald', sans-serif", color: '#64748b' }}
              >
                {player.name[0].toUpperCase()}
              </span>
            )}
            <span
              className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider opacity-0 hover:opacity-100 transition-opacity"
              style={{ background: '#00000088', color: '#fff' }}
            >
              Change
            </span>
          </button>
          <div>
            <p className="text-xs font-semibold text-[#f1f5f9]">Profile Photo</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] text-[#16a34a] mt-0.5"
            >
              {avatarPreview ? 'Change photo' : 'Upload photo'}
            </button>
            {avatarPreview && (
              <button
                type="button"
                onClick={() => { setAvatarFile(null); setAvatarPreview(null) }}
                className="text-[11px] text-[#ef4444] ml-3"
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-widest text-[#64748b] font-semibold">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            className="w-full rounded-xl px-4 py-3 text-sm text-[#f1f5f9] placeholder-[#334155] focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
            style={{ background: '#1c2330', border: '1px solid #252d3a' }}
          />
        </div>

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
        </div>

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
            style={{ fontFamily: "'Oswald', sans-serif", background: '#1c2330', border: '1px solid #252d3a' }}
          />
        </div>

        {/* Injured toggle */}
        <button
          type="button"
          onClick={() => setInjured((v) => !v)}
          className="flex items-center justify-between w-full rounded-xl px-4 py-3 transition-colors"
          style={{
            background: injured ? '#3d151522' : '#1c2330',
            border: `1px solid ${injured ? '#ef444466' : '#252d3a'}`,
          }}
        >
          <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: injured ? '#ef4444' : '#64748b' }}>
            <span>🩹</span> Injured
          </span>
          <span
            className="w-9 h-5 rounded-full flex items-center transition-all px-0.5"
            style={{ background: injured ? '#ef4444' : '#252d3a' }}
          >
            <span
              className="w-4 h-4 rounded-full bg-white transition-all"
              style={{ transform: injured ? 'translateX(16px)' : 'translateX(0)' }}
            />
          </span>
        </button>

        {/* PIN reset (admin only) */}
        {player.avatarPin && (
          <button
            type="button"
            onClick={() => onSave({ name: player.name, position: player.position ?? 'MID', number: player.number ?? null, injured: player.injured ?? false, avatarUrl: player.avatarUrl ?? null, avatarPin: null })}
            className="w-full text-xs text-[#64748b] hover:text-[#ef4444] transition-colors text-left"
          >
            🔑 Reset avatar PIN
          </button>
        )}

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl text-sm font-bold uppercase tracking-widest"
            style={{ fontFamily: "'Oswald', sans-serif", background: '#1c2330', color: '#64748b', border: '1px solid #252d3a' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading}
            className="flex-1 py-3 rounded-xl text-sm font-bold uppercase tracking-widest"
            style={{ fontFamily: "'Oswald', sans-serif", background: uploading ? '#14532d' : '#16a34a', color: '#fff', opacity: uploading ? 0.7 : 1 }}
          >
            {uploading ? 'Uploading…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ─── Avatar-Only Modal (PIN-protected) ──────────────────────── */

function AvatarOnlyModal({ player, onSave, onCancel }) {
  // step: 'verify' (existing PIN) | 'create' (no PIN yet) | 'photo' (upload)
  const [step, setStep] = useState(player.avatarPin ? 'verify' : 'create')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pendingPin, setPendingPin] = useState(null) // new PIN to save
  const [pinError, setPinError] = useState('')

  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(player.avatarUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  function handleVerifyPin() {
    if (pin === player.avatarPin) {
      setStep('photo')
      setPin('')
      setPinError('')
    } else {
      setPinError('Incorrect PIN. Try again.')
      setPin('')
    }
  }

  function handleCreatePin() {
    if (!/^\d{4}$/.test(pin)) { setPinError('PIN must be exactly 4 digits.'); return }
    if (pin !== confirmPin) { setPinError('PINs do not match.'); return }
    setPendingPin(pin)
    setStep('photo')
    setPin('')
    setConfirmPin('')
    setPinError('')
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!avatarFile && avatarPreview === (player.avatarUrl ?? null)) { onCancel(); return }
    setUploading(true)
    try {
      let avatarUrl = null
      if (avatarFile) {
        avatarUrl = await uploadAvatar(player.id, avatarFile)
      }
      onSave({ avatarUrl, ...(pendingPin ? { avatarPin: pendingPin } : {}) })
    } catch (err) {
      console.error('Avatar upload error:', err)
      setError(`Upload failed: ${err?.message ?? err}`)
    }
    setUploading(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: '#00000099' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 space-y-5"
        style={{ background: '#141920', border: '1px solid #252d3a' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-sm font-bold uppercase tracking-[0.2em] text-[#f1f5f9]"
          style={{ fontFamily: "'Oswald', sans-serif" }}
        >
          {player.name} — Profile Photo
        </h2>

        {/* ── PIN verify step ── */}
        {step === 'verify' && (
          <div className="space-y-4">
            <p className="text-xs text-[#64748b]">Enter your 4-digit PIN to update your photo.</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setPinError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyPin()}
              placeholder="••••"
              autoFocus
              className="w-full text-center rounded-xl px-4 py-3 text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              style={{ fontFamily: "'Oswald', sans-serif", background: '#1c2330', border: '1px solid #252d3a', color: '#f1f5f9' }}
            />
            {pinError && <p className="text-red-400 text-xs text-center">{pinError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={onCancel}
                className="flex-1 py-3 rounded-xl text-sm font-bold uppercase tracking-widest"
                style={{ fontFamily: "'Oswald', sans-serif", background: '#1c2330', color: '#64748b', border: '1px solid #252d3a' }}
              >Cancel</button>
              <button type="button" onClick={handleVerifyPin} disabled={pin.length !== 4}
                className="flex-1 py-3 rounded-xl text-sm font-bold uppercase tracking-widest"
                style={{ fontFamily: "'Oswald', sans-serif", background: '#16a34a', color: '#fff', opacity: pin.length !== 4 ? 0.4 : 1 }}
              >Continue</button>
            </div>
          </div>
        )}

        {/* ── PIN create step ── */}
        {step === 'create' && (
          <div className="space-y-4">
            <p className="text-xs text-[#64748b]">Set a 4-digit PIN to protect your profile photo.</p>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-[#64748b] font-semibold block">Choose PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setPinError('') }}
                placeholder="••••"
                autoFocus
                className="w-full text-center rounded-xl px-4 py-3 text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                style={{ fontFamily: "'Oswald', sans-serif", background: '#1c2330', border: '1px solid #252d3a', color: '#f1f5f9' }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-[#64748b] font-semibold block">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, '')); setPinError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePin()}
                placeholder="••••"
                className="w-full text-center rounded-xl px-4 py-3 text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                style={{ fontFamily: "'Oswald', sans-serif", background: '#1c2330', border: '1px solid #252d3a', color: '#f1f5f9' }}
              />
            </div>
            {pinError && <p className="text-red-400 text-xs text-center">{pinError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={onCancel}
                className="flex-1 py-3 rounded-xl text-sm font-bold uppercase tracking-widest"
                style={{ fontFamily: "'Oswald', sans-serif", background: '#1c2330', color: '#64748b', border: '1px solid #252d3a' }}
              >Cancel</button>
              <button type="button" onClick={handleCreatePin} disabled={pin.length !== 4 || confirmPin.length !== 4}
                className="flex-1 py-3 rounded-xl text-sm font-bold uppercase tracking-widest"
                style={{ fontFamily: "'Oswald', sans-serif", background: '#16a34a', color: '#fff', opacity: (pin.length !== 4 || confirmPin.length !== 4) ? 0.4 : 1 }}
              >Set PIN</button>
            </div>
          </div>
        )}

        {/* ── Photo step ── */}
        {step === 'photo' && (
          <>
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative rounded-full overflow-hidden"
                style={{ width: 96, height: 96, background: '#1c2330', border: '2px solid #252d3a' }}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span
                    className="w-full h-full flex items-center justify-center text-3xl font-bold"
                    style={{ fontFamily: "'Oswald', sans-serif", color: '#64748b' }}
                  >
                    {player.name[0].toUpperCase()}
                  </span>
                )}
                <span
                  className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: '#00000066', color: '#fff' }}
                >
                  {avatarPreview ? 'Change' : 'Upload'}
                </span>
              </button>
              <div className="flex gap-4">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm font-semibold text-[#16a34a]">
                  Choose photo
                </button>
                {avatarPreview && (
                  <button type="button" onClick={() => { setAvatarFile(null); setAvatarPreview(null) }} className="text-sm font-semibold text-[#ef4444]">
                    Remove
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            {error && <p className="text-red-400 text-xs text-center">{error}</p>}

            <div className="flex gap-3">
              <button type="button" onClick={onCancel}
                className="flex-1 py-3 rounded-xl text-sm font-bold uppercase tracking-widest"
                style={{ fontFamily: "'Oswald', sans-serif", background: '#1c2330', color: '#64748b', border: '1px solid #252d3a' }}
              >Cancel</button>
              <button type="button" onClick={handleSave}
                disabled={uploading || (!avatarFile && avatarPreview === (player.avatarUrl ?? null))}
                className="flex-1 py-3 rounded-xl text-sm font-bold uppercase tracking-widest"
                style={{
                  fontFamily: "'Oswald', sans-serif",
                  background: uploading ? '#14532d' : '#16a34a',
                  color: '#fff',
                  opacity: (uploading || (!avatarFile && avatarPreview === (player.avatarUrl ?? null))) ? 0.5 : 1,
                }}
              >{uploading ? 'Uploading…' : 'Save'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
