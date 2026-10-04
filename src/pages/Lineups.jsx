import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import PlayerAvatar from '../components/PlayerAvatar'
import FireIcon from '../components/FireIcon'

// ─── colour tokens ─────────────────────────────────────────────
const TEAM_A = { color: '#16a34a', dim: '#14532d', border: '#16a34a55', text: '#22c55e', label: 'Team A' }
const TEAM_B = { color: '#3b82f6', dim: '#1e3a5f', border: '#3b82f655', text: '#60a5fa', label: 'Team B' }

// ─── Pitch slot layouts by format (coords = % of container) ──────
// Team A sits in the top half (own goal at top), Team B mirrors it.
// 7-a-side = 1-2-3-1, 9-a-side = 1-3-3-2. Array order = slot index used by initFreePlaced.
const FORMATIONS = {
  7: {
    label: '7-a-side',
    A: [
      { label: 'GK',  x: 50, y: 9  },  // near own goal (top)
      { label: 'DEF', x: 28, y: 22 },
      { label: 'DEF', x: 72, y: 22 },
      { label: 'MID', x: 15, y: 35 },
      { label: 'MID', x: 50, y: 35 },
      { label: 'MID', x: 85, y: 35 },
      { label: 'FWD', x: 50, y: 46 },  // near centre line
    ],
    B: [
      { label: 'GK',  x: 50, y: 91 },  // near own goal (bottom)
      { label: 'DEF', x: 28, y: 78 },
      { label: 'DEF', x: 72, y: 78 },
      { label: 'MID', x: 15, y: 65 },
      { label: 'MID', x: 50, y: 65 },
      { label: 'MID', x: 85, y: 65 },
      { label: 'FWD', x: 50, y: 54 },  // near centre line
    ],
  },
  9: {
    label: '9-a-side',
    A: [
      { label: 'GK',  x: 50, y: 7  },  // near own goal (top)
      { label: 'DEF', x: 22, y: 19 },
      { label: 'DEF', x: 50, y: 19 },
      { label: 'DEF', x: 78, y: 19 },
      { label: 'MID', x: 22, y: 33 },
      { label: 'MID', x: 50, y: 33 },
      { label: 'MID', x: 78, y: 33 },
      { label: 'FWD', x: 35, y: 46 },  // near centre line
      { label: 'FWD', x: 65, y: 46 },
    ],
    B: [
      { label: 'GK',  x: 50, y: 93 },  // near own goal (bottom)
      { label: 'DEF', x: 22, y: 81 },
      { label: 'DEF', x: 50, y: 81 },
      { label: 'DEF', x: 78, y: 81 },
      { label: 'MID', x: 22, y: 67 },
      { label: 'MID', x: 50, y: 67 },
      { label: 'MID', x: 78, y: 67 },
      { label: 'FWD', x: 35, y: 54 },  // near centre line
      { label: 'FWD', x: 65, y: 54 },
    ],
  },
}

const DEFAULT_FORMAT = 7

// Infer a match format from stored data (falls back to team sizes for pre-format sessions)
function formatOf(session) {
  const stored = session?.teams?.format ?? session?.format
  if (stored === 7 || stored === 9) return stored
  const maxTeam = Math.max(session?.teams?.teamA?.length ?? 0, session?.teams?.teamB?.length ?? 0)
  return maxTeam > 7 ? 9 : DEFAULT_FORMAT
}

export default function Lineups() {
  const { players, sessions, sessionsLoaded, saveMatch, updateSession, removeSession, getStreaks, fetchWeatherForDate } = useApp()
  const firePlayerIds = new Set(players.filter((p) => getStreaks(p.id).winStreak >= 3).map((p) => p.id))
  const [view, setView] = useState('list')   // 'list' | 'new' | 'edit'
  const [editId, setEditId] = useState(null)

  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  const editSession = sessions.find((s) => s.id === editId) ?? null

  async function handleSave(data) {
    if (view === 'new') {
      await saveMatch(data)
    } else {
      const hasScore = data.scoreA !== '' && data.scoreB !== '' && data.scoreA != null
      await updateSession(editId, {
        date: data.date,
        playerIds: [...new Set([...data.teamA, ...data.teamB])],
        teams: { teamA: data.teamA, teamB: data.teamB, format: data.format },
        result: hasScore
          ? { scoreA: Number(data.scoreA), scoreB: Number(data.scoreB), scoreKnown: true }
          : null,
      })
    }
    setView('list')
    setEditId(null)
  }

  function handleEdit(id) {
    setEditId(id)
    setView('edit')
  }

  async function handleDelete(id) {
    if (confirm('Delete this match?')) await removeSession(id)
  }

  if (!sessionsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0b0f14' }}>
        <p className="text-[#64748b] text-sm">Loading...</p>
      </div>
    )
  }

  if (view === 'new' || view === 'edit') {
    return (
      <MatchForm
        players={players}
        initialData={editSession}
        onSave={handleSave}
        onCancel={() => { setView('list'); setEditId(null) }}
        isEdit={view === 'edit'}
      />
    )
  }

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-10 pb-5 relative overflow-hidden grain hero-enter" style={{ background: 'linear-gradient(to bottom, #0f1a12, #0b0f14)' }}>
        <p className="text-[#16a34a] text-xs font-semibold tracking-[0.25em] uppercase mb-1">Matches</p>
        <div className="flex items-end justify-between">
          <h1 className="text-3xl font-bold uppercase text-[#f1f5f9] leading-none" style={{ fontFamily: "'Oswald', sans-serif" }}>
            Games
          </h1>
          <button
            onClick={() => setView('new')}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-xl transition-colors"
            style={{ fontFamily: "'Oswald', sans-serif", background: '#16a34a', color: '#fff' }}
          >
            + New Match
          </button>
        </div>
      </header>

      <div className="px-4 space-y-3 pb-4">
        {sorted.length === 0 ? (
          <div className="pt-8 text-center space-y-2">
            <p className="text-4xl">⚽</p>
            <p className="text-[#64748b] text-sm">No matches yet.</p>
            <button
              onClick={() => setView('new')}
              className="mt-2 text-sm font-bold text-[#16a34a] hover:text-[#22c55e] transition-colors"
            >
              Record your first match →
            </button>
          </div>
        ) : (
          sorted.map((session) => (
            <MatchCard
              key={session.id}
              session={session}
              players={players}
              firePlayerIds={firePlayerIds}
              onEdit={() => handleEdit(session.id)}
              onDelete={() => handleDelete(session.id)}
              onSetMotm={async (newIds) => updateSession(session.id, { motm: newIds.length ? newIds : null })}
              onSaveReport={async (text, writtenBy) => updateSession(session.id, { report: text || null, writtenBy: writtenBy || null })}
              onFetchWeather={async () => {
                const w = await fetchWeatherForDate(session.date)
                if (w) await updateSession(session.id, { weather: w })
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Match Form ────────────────────────────────────────────────
function MatchForm({ players, initialData, onSave, onCancel, isEdit }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(initialData?.date ?? today)
  const [teamA, setTeamA] = useState(initialData?.teams?.teamA ?? [])
  const [teamB, setTeamB] = useState(initialData?.teams?.teamB ?? [])
  const [scoreA, setScoreA] = useState(initialData?.result?.scoreA ?? '')
  const [scoreB, setScoreB] = useState(initialData?.result?.scoreB ?? '')
  const [format, setFormat] = useState(() => (initialData ? formatOf(initialData) : DEFAULT_FORMAT))
  const [builderView, setBuilderView] = useState('pitch')

  const allAssigned = [...teamA, ...teamB]
  const canSave = teamA.length > 0 && teamB.length > 0

  function handleSave() {
    if (!canSave) return
    onSave({ date, teamA, teamB, scoreA, scoreB, format })
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#0b0f14' }}>
      {/* Form header */}
      <header className="px-5 pt-10 pb-4 relative overflow-hidden grain hero-enter" style={{ background: 'linear-gradient(to bottom, #0f1a12, #0b0f14)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#16a34a] text-xs font-semibold tracking-[0.25em] uppercase mb-1">
              {isEdit ? 'Editing Match' : 'New Match'}
            </p>
            <h1 className="text-3xl font-bold uppercase text-[#f1f5f9] leading-none" style={{ fontFamily: "'Oswald', sans-serif" }}>
              {isEdit ? 'Edit Lineup' : 'Set Lineup'}
            </h1>
          </div>
          <button
            onClick={onCancel}
            className="text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-xl transition-colors"
            style={{ fontFamily: "'Oswald', sans-serif", background: '#141920', color: '#64748b', border: '1px solid #252d3a' }}
          >
            Cancel
          </button>
        </div>
      </header>

      <div className="px-4 space-y-4 pb-32">
        {/* Date */}
        <div className="rounded-2xl p-4 space-y-2" style={{ background: '#141920', border: '1px solid #252d3a' }}>
          <label className="text-[10px] uppercase tracking-widest text-[#64748b] font-semibold block">Match Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl px-4 py-3 text-sm text-[#f1f5f9] focus:outline-none focus:ring-2 focus:ring-[#16a34a] w-full"
            style={{ background: '#1c2330', border: '1px solid #252d3a' }}
          />
        </div>

        {/* Format (players per side) */}
        <div className="rounded-2xl p-4 space-y-2" style={{ background: '#141920', border: '1px solid #252d3a' }}>
          <label className="text-[10px] uppercase tracking-widest text-[#64748b] font-semibold block">Format</label>
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#0b0f14', border: '1px solid #1c2330' }}>
            {[7, 9].map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                style={{
                  fontFamily: "'Oswald', sans-serif",
                  background: format === f ? '#16a34a' : 'transparent',
                  color: format === f ? '#fff' : '#64748b',
                }}
              >
                {f}-a-side
              </button>
            ))}
          </div>
        </div>

        {/* Builder view toggle */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#0b0f14', border: '1px solid #1c2330' }}>
          {[{ v: 'list', label: '☰  List' }, { v: 'pitch', label: '⚽  Pitch' }].map(({ v, label }) => (
            <button
              key={v}
              onClick={() => setBuilderView(v)}
              className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
              style={{
                fontFamily: "'Oswald', sans-serif",
                background: builderView === v ? (v === 'pitch' ? '#16a34a' : '#1c2330') : 'transparent',
                color: builderView === v ? '#fff' : '#64748b',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Team builder */}
        {builderView === 'list' ? (
          <TeamBuilder
            allPlayers={players}
            teamA={teamA}
            teamB={teamB}
            onChange={(a, b) => { setTeamA(a); setTeamB(b) }}
          />
        ) : (
          <PitchBuilder
            allPlayers={players}
            teamA={teamA}
            teamB={teamB}
            format={format}
            onChange={(a, b) => { setTeamA(a); setTeamB(b) }}
          />
        )}

        {/* Score + result */}
        <div className="rounded-2xl p-4 space-y-4" style={{ background: '#141920', border: '1px solid #252d3a' }}>
          <label className="text-[10px] uppercase tracking-widest text-[#64748b] font-semibold block">
            Score <span className="text-[#334155] normal-case tracking-normal">(optional)</span>
          </label>
          <div className="flex items-center justify-center gap-4">
            <ScoreInput
              label="Team A"
              value={scoreA}
              onChange={setScoreA}
              color={TEAM_A.color}
              textColor={TEAM_A.text}
            />
            <span className="text-2xl font-bold text-[#334155]" style={{ fontFamily: "'Oswald', sans-serif" }}>–</span>
            <ScoreInput
              label="Team B"
              value={scoreB}
              onChange={setScoreB}
              color={TEAM_B.color}
              textColor={TEAM_B.text}
            />
          </div>

        </div>
      </div>

      {/* Sticky save bar — z-[60] to sit above BottomNav (z-50) */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-3 max-w-lg mx-auto"
        style={{ background: 'linear-gradient(to top, #0b0f14 80%, transparent)', zIndex: 60 }}
      >
        {!canSave && (
          <p className="text-xs text-[#64748b] text-center mb-2">
            Assign at least one player to each team to save
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="w-full py-4 rounded-2xl text-base font-bold uppercase tracking-widest transition-all disabled:opacity-30"
          style={{
            fontFamily: "'Oswald', sans-serif",
            background: canSave ? '#16a34a' : '#1c2330',
            color: canSave ? '#fff' : '#64748b',
            boxShadow: canSave ? '0 0 20px #16a34a44' : 'none',
          }}
        >
          {isEdit ? 'Save Changes' : 'Save Match'}
        </button>
      </div>
    </div>
  )
}

// ─── Team Builder ──────────────────────────────────────────────
function TeamBuilder({ allPlayers, teamA, teamB, onChange }) {
  const [dragOver, setDragOver] = useState(null) // 'A' | 'B' | null

  const aPlayers = allPlayers.filter((p) => teamA.includes(p.id))
  const bPlayers = allPlayers.filter((p) => teamB.includes(p.id))
  const pool = allPlayers.filter((p) => !teamA.includes(p.id) && !teamB.includes(p.id))

  function assign(playerId, team) {
    const newA = teamA.filter((id) => id !== playerId)
    const newB = teamB.filter((id) => id !== playerId)
    if (team === 'A') onChange([...newA, playerId], newB)
    else onChange(newA, [...newB, playerId])
  }

  function unassign(playerId) {
    onChange(teamA.filter((id) => id !== playerId), teamB.filter((id) => id !== playerId))
  }

  function moveToOther(playerId, currentTeam) {
    assign(playerId, currentTeam === 'A' ? 'B' : 'A')
  }

  // ── HTML5 drag handlers ──
  function onDragStart(e, playerId) {
    e.dataTransfer.setData('text/plain', playerId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e, zone) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(zone)
  }

  function onDrop(e, team) {
    e.preventDefault()
    const playerId = e.dataTransfer.getData('text/plain')
    if (playerId) assign(playerId, team)
    setDragOver(null)
  }

  function onDropPool(e) {
    e.preventDefault()
    const playerId = e.dataTransfer.getData('text/plain')
    if (playerId) unassign(playerId)
    setDragOver(null)
  }

  return (
    <div className="space-y-3">
      {/* Team columns */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { meta: TEAM_A, players: aPlayers, team: 'A' },
          { meta: TEAM_B, players: bPlayers, team: 'B' },
        ].map(({ meta, players: tPlayers, team }) => (
          <div
            key={team}
            onDragOver={(e) => onDragOver(e, team)}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => onDrop(e, team)}
            className="rounded-2xl p-3 min-h-28 transition-all"
            style={{
              background: dragOver === team ? meta.dim : '#141920',
              border: `1px solid ${dragOver === team ? meta.color : '#252d3a'}`,
              boxShadow: dragOver === team ? `0 0 16px ${meta.color}33` : 'none',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "'Oswald', sans-serif", color: meta.color }}>
                {meta.label}
              </p>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: meta.dim, color: meta.text }}
              >
                {tPlayers.length}
              </span>
            </div>

            {tPlayers.length === 0 ? (
              <p className="text-[10px] text-[#334155] mt-3 text-center">
                Drag here or use buttons below
              </p>
            ) : (
              <div className="space-y-1">
                {tPlayers.map((p) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, p.id)}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl cursor-grab active:cursor-grabbing group"
                    style={{ background: meta.dim, border: `1px solid ${meta.border}` }}
                  >
                    <PlayerAvatar player={p} size={16} />
                    {p.number && (
                      <span className="text-[10px] font-bold w-4 text-center shrink-0" style={{ color: meta.text }}>
                        {p.number}
                      </span>
                    )}
                    <span className="text-xs font-medium text-[#f1f5f9] flex-1 truncate">{p.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => moveToOther(p.id, team)}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors"
                        style={{ background: team === 'A' ? TEAM_B.dim : TEAM_A.dim, color: team === 'A' ? TEAM_B.text : TEAM_A.text }}
                        title={`Move to ${team === 'A' ? 'Team B' : 'Team A'}`}
                      >
                        →{team === 'A' ? 'B' : 'A'}
                      </button>
                      <button
                        onClick={() => unassign(p.id)}
                        className="text-[10px] text-[#64748b] hover:text-red-400 transition-colors"
                        title="Remove from team"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Player pool */}
      {allPlayers.length === 0 ? (
        <div className="rounded-2xl p-4 text-center" style={{ background: '#141920', border: '1px solid #252d3a' }}>
          <p className="text-xs text-[#64748b]">No players in squad. Add players first.</p>
        </div>
      ) : pool.length > 0 ? (
        <div
          className="rounded-2xl p-3"
          onDragOver={(e) => onDragOver(e, 'pool')}
          onDragLeave={() => setDragOver(null)}
          onDrop={onDropPool}
          style={{
            background: '#141920',
            border: `1px solid ${dragOver === 'pool' ? '#64748b' : '#252d3a'}`,
          }}
        >
          <p className="text-[10px] uppercase tracking-widest text-[#64748b] font-semibold mb-2.5">
            Squad — tap [A] or [B] to assign
          </p>
          <div className="space-y-1.5">
            {[...pool].sort((a, b) => {
              const po = { GK: 0, DEF: 1, MID: 2, FWD: 3 }
              return (po[a.position] ?? 2) - (po[b.position] ?? 2) || a.name.localeCompare(b.name)
            }).map((p) => (
              <div
                key={p.id}
                draggable
                onDragStart={(e) => onDragStart(e, p.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-grab active:cursor-grabbing"
                style={{ background: '#1c2330', border: '1px solid #252d3a' }}
              >
                <PlayerAvatar player={p} size={20} />
                {p.number && (
                  <span className="text-xs font-bold text-[#334155] w-5 text-center shrink-0">
                    {p.number}
                  </span>
                )}
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: POS_BG[p.position ?? 'MID'], color: POS_COLOR[p.position ?? 'MID'] }}
                >
                  {p.position ?? 'MID'}
                </span>
                <span className="text-sm text-[#f1f5f9] font-medium flex-1 truncate">{p.name}</span>
                <button
                  onClick={() => assign(p.id, 'A')}
                  className="text-xs font-bold px-2.5 py-1 rounded-lg transition-colors shrink-0"
                  style={{ background: TEAM_A.dim, color: TEAM_A.text, border: `1px solid ${TEAM_A.border}` }}
                >
                  A
                </button>
                <button
                  onClick={() => assign(p.id, 'B')}
                  className="text-xs font-bold px-2.5 py-1 rounded-lg transition-colors shrink-0"
                  style={{ background: TEAM_B.dim, color: TEAM_B.text, border: `1px solid ${TEAM_B.border}` }}
                >
                  B
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl px-4 py-2 flex items-center gap-2" style={{ background: '#14532d', border: '1px solid #16a34a44' }}>
          <span className="text-[#22c55e] text-sm">✓</span>
          <p className="text-xs text-[#22c55e] font-medium">All squad players assigned to a team</p>
        </div>
      )}
    </div>
  )
}

// ─── Pitch Builder (free-form positioning) ─────────────────────
// Converts a team's player IDs into { playerId, x, y } entries using the
// formation's slot positions as the starting layout. Any players beyond the
// available slots are laid out along the centre line so none are stranded.
function initFreePlaced(playerIds, allPlayers, team, format) {
  const slotDefs = (FORMATIONS[format] ?? FORMATIONS[DEFAULT_FORMAT])[team]
  // Sort players by position into buckets derived from the slot labels
  const players = playerIds.map((id) => allPlayers.find((p) => p.id === id)).filter(Boolean)
  const posOrder = { GK: 0, DEF: 1, MID: 2, FWD: 3 }
  const sorted = [...players].sort((a, b) => (posOrder[a.position] ?? 2) - (posOrder[b.position] ?? 2))
  const buckets = {}
  slotDefs.forEach((s, i) => { (buckets[s.label] ??= []).push(i) })
  const N = slotDefs.length
  const slots = Array(N).fill(null)
  const placed = new Set()
  for (const p of sorted) {
    const freeSlot = (buckets[p.position] ?? []).find((i) => slots[i] === null)
    if (freeSlot !== undefined) { slots[freeSlot] = p.id; placed.add(p.id) }
  }
  let ei = 0
  for (const p of sorted) {
    if (placed.has(p.id)) continue
    while (ei < N && slots[ei] !== null) ei++
    if (ei >= N) break
    slots[ei] = p.id
    placed.add(p.id)
  }
  const result = slots
    .map((playerId, i) => playerId ? { playerId, x: slotDefs[i].x, y: slotDefs[i].y } : null)
    .filter(Boolean)
  // Overflow (more players than slots): spread along the centre line, staying on this team's half
  const extras = sorted.filter((p) => !placed.has(p.id))
  const baseY = team === 'A' ? 48 : 52
  extras.forEach((p, k) => {
    const x = extras.length === 1 ? 50 : 12 + (76 * k) / (extras.length - 1)
    result.push({ playerId: p.id, x, y: baseY })
  })
  return result
}

function PitchBuilder({ allPlayers, teamA, teamB, format, onChange }) {
  const [placedA, setPlacedA] = useState(() => initFreePlaced(teamA, allPlayers, 'A', format))
  const [placedB, setPlacedB] = useState(() => initFreePlaced(teamB, allPlayers, 'B', format))
  const [selected, setSelected] = useState(null) // { playerId, src: 'pool'|'A'|'B' } | null
  const [ghostPos, setGhostPos] = useState(null) // { x, y, playerId } | null

  const pitchRef = useRef(null)
  // sr holds mutable values accessible from window event listeners without stale closures
  const sr = useRef({ placedA, placedB, onChange, pending: null, drag: null, wasDrag: false })
  sr.current.placedA = placedA
  sr.current.placedB = placedB
  sr.current.onChange = onChange

  // Re-lay-out placed players when the format (7 ↔ 9) changes, preserving team membership
  const prevFormat = useRef(format)
  useEffect(() => {
    if (prevFormat.current === format) return
    prevFormat.current = format
    setPlacedA(initFreePlaced(sr.current.placedA.map((p) => p.playerId), allPlayers, 'A', format))
    setPlacedB(initFreePlaced(sr.current.placedB.map((p) => p.playerId), allPlayers, 'B', format))
  }, [format, allPlayers])

  const placedIds = new Set([...placedA, ...placedB].map((p) => p.playerId))
  const pool = allPlayers.filter((p) => !placedIds.has(p.id))

  // Team assignment is determined by pitch half: y < 50 → Team A, y ≥ 50 → Team B
  function applyPlace(playerId, rawX, rawY) {
    const x = Math.max(5, Math.min(95, rawX))
    const y = Math.max(2, Math.min(98, rawY))
    const newA = sr.current.placedA.filter((p) => p.playerId !== playerId)
    const newB = sr.current.placedB.filter((p) => p.playerId !== playerId)
    if (y < 50) newA.push({ playerId, x, y })
    else newB.push({ playerId, x, y })
    setPlacedA(newA); setPlacedB(newB)
    sr.current.onChange(newA.map((p) => p.playerId), newB.map((p) => p.playerId))
  }

  function applyRemove(playerId) {
    const newA = sr.current.placedA.filter((p) => p.playerId !== playerId)
    const newB = sr.current.placedB.filter((p) => p.playerId !== playerId)
    setPlacedA(newA); setPlacedB(newB)
    sr.current.onChange(newA.map((p) => p.playerId), newB.map((p) => p.playerId))
  }

  // ── Tap handlers ─────────────────────────────────────────────
  // Tap pitch background → place selected player at that spot
  function handlePitchClick(e) {
    if (sr.current.wasDrag) { sr.current.wasDrag = false; return }
    if (!selected) return
    const rect = pitchRef.current.getBoundingClientRect()
    applyPlace(selected.playerId, ((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100)
    setSelected(null)
  }

  // Tap a placed player → select / deselect
  function handlePlayerTap(e, playerId, src) {
    e.stopPropagation()
    if (sr.current.wasDrag) { sr.current.wasDrag = false; return }
    setSelected((prev) => prev?.playerId === playerId ? null : { playerId, src })
  }

  // Tap pool token → select / deselect
  function handlePoolTap(playerId) {
    if (sr.current.wasDrag) { sr.current.wasDrag = false; return }
    setSelected((prev) => prev?.playerId === playerId ? null : { playerId, src: 'pool' })
  }

  // ── Drag initiation ──────────────────────────────────────────
  function onPlayerPointerDown(e, playerId) {
    sr.current.pending = { playerId, startX: e.clientX, startY: e.clientY, pointerId: e.pointerId }
  }

  // ── Window-level pointer events ──────────────────────────────
  useEffect(() => {
    function onMove(e) {
      const { pending, drag } = sr.current
      if (drag) {
        setGhostPos({ x: e.clientX, y: e.clientY, playerId: drag.playerId })
        return
      }
      if (!pending || pending.pointerId !== e.pointerId) return
      const dx = e.clientX - pending.startX
      const dy = e.clientY - pending.startY
      if (Math.sqrt(dx * dx + dy * dy) > 8) {
        sr.current.drag = pending
        sr.current.pending = null
        sr.current.wasDrag = true
        setSelected(null)
        setGhostPos({ x: e.clientX, y: e.clientY, playerId: pending.playerId })
      }
    }

    function onUp(e) {
      sr.current.pending = null
      const d = sr.current.drag
      if (!d || d.pointerId !== e.pointerId) return
      sr.current.drag = null
      setGhostPos(null)

      const pitchEl = pitchRef.current
      if (!pitchEl) return
      const rect = pitchEl.getBoundingClientRect()
      const px = ((e.clientX - rect.left) / rect.width) * 100
      const py = ((e.clientY - rect.top) / rect.height) * 100

      // Within pitch → place at drop position (team assigned by half)
      if (px >= -5 && px <= 105 && py >= -5 && py <= 105) {
        applyPlace(d.playerId, px, py)
      } else {
        // Outside pitch → return to pool
        applyRemove(d.playerId)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  const selectedPlayer = selected ? allPlayers.find((p) => p.id === selected.playerId) : null
  const ghostPlayer = ghostPos ? allPlayers.find((p) => p.id === ghostPos.playerId) : null
  const isDragging = !!ghostPos

  return (
    <div className="space-y-3">
      {/* Ghost element — follows pointer during drag */}
      {ghostPos && ghostPlayer && (
        <div
          className="fixed z-[200] pointer-events-none"
          style={{ left: ghostPos.x, top: ghostPos.y, transform: 'translate(-50%, -50%)' }}
        >
          <div
            className="rounded-full flex items-center justify-center"
            style={{ width: 44, height: 44, background: '#1c2330', border: '2px solid #fff', opacity: 0.9, boxShadow: '0 4px 16px rgba(0,0,0,0.6)' }}
          >
            {ghostPlayer.avatarUrl ? (
              <img src={ghostPlayer.avatarUrl} alt={ghostPlayer.name} className="rounded-full object-cover" style={{ width: 40, height: 40 }} />
            ) : (
              <span className="text-sm font-bold text-white">{ghostPlayer.name[0].toUpperCase()}</span>
            )}
          </div>
        </div>
      )}

      {/* Selected player banner */}
      {selected && selectedPlayer && !isDragging && (
        <div
          className="flex items-center justify-between px-4 py-2 rounded-xl"
          style={{ background: '#1c2330', border: '1px solid #334155' }}
        >
          <div className="flex items-center gap-2">
            <PlayerAvatar player={selectedPlayer} size={24} />
            <span className="text-xs font-semibold text-[#f1f5f9]">{selectedPlayer.name}</span>
            <span className="text-[10px] text-[#64748b]">· tap pitch to place · drag to move</span>
          </div>
          <button onClick={() => setSelected(null)} className="text-xs text-[#64748b] hover:text-red-400 transition-colors">✕</button>
        </div>
      )}

      {/* Pitch */}
      <div
        ref={pitchRef}
        onClick={handlePitchClick}
        className="relative w-full rounded-2xl overflow-hidden select-none"
        style={{ aspectRatio: '3/4', background: '#1a6b2a', cursor: selected && !isDragging ? 'crosshair' : 'default' }}
      >
        <PitchSVG />

        {/* Halfway line team labels */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: '#14532d', color: '#22c55e', border: '1px solid #16a34a55' }}>
            Team A
          </span>
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: '#1e3a5f', color: '#60a5fa', border: '1px solid #3b82f655' }}>
            Team B
          </span>
        </div>

        {/* Placed players */}
        {[...placedA.map((e) => ({ ...e, team: 'A' })), ...placedB.map((e) => ({ ...e, team: 'B' }))].map((entry) => {
          const player = allPlayers.find((p) => p.id === entry.playerId)
          if (!player) return null
          return (
            <FreePitchPlayer
              key={entry.playerId}
              player={player}
              x={entry.x}
              y={entry.y}
              team={entry.team}
              isSelected={selected?.playerId === entry.playerId}
              isBeingDragged={isDragging && ghostPos?.playerId === entry.playerId}
              hasSelection={!!selected}
              onClick={(e) => handlePlayerTap(e, entry.playerId, entry.team)}
              onPointerDown={(e) => onPlayerPointerDown(e, entry.playerId)}
            />
          )
        })}
      </div>

      {/* Pool */}
      {pool.length > 0 ? (
        <div className="rounded-2xl p-3" style={{ background: '#141920', border: '1px solid #252d3a' }}>
          <p className="text-[10px] uppercase tracking-widest text-[#64748b] font-semibold mb-2.5">
            {selected?.src === 'pool' ? 'Tap the pitch to place · top half = Team A, bottom = Team B' : 'Unassigned — tap or drag onto pitch'}
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
            {pool.map((p) => (
              <PoolToken
                key={p.id} player={p}
                isSelected={selected?.playerId === p.id && selected?.src === 'pool'}
                onTap={() => handlePoolTap(p.id)}
                onPointerDown={(e) => onPlayerPointerDown(e, p.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl px-4 py-2 flex items-center gap-2" style={{ background: '#14532d', border: '1px solid #16a34a44' }}>
          <span className="text-[#22c55e] text-sm">✓</span>
          <p className="text-xs text-[#22c55e] font-medium">All squad players placed — drag to rearrange</p>
        </div>
      )}
    </div>
  )
}

// ─── Pitch SVG background lines ────────────────────────────────
function PitchSVG() {
  return (
    <svg
      viewBox="0 0 300 400"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.3 }}
    >
      <rect x="12" y="12" width="276" height="376" fill="none" stroke="white" strokeWidth="2" />
      <line x1="12" y1="200" x2="288" y2="200" stroke="white" strokeWidth="1.5" />
      <circle cx="150" cy="200" r="36" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="150" cy="200" r="3" fill="white" />
      <rect x="82" y="12" width="136" height="58" fill="none" stroke="white" strokeWidth="1" />
      <rect x="118" y="4" width="64" height="8" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="150" cy="92" r="2" fill="white" />
      <rect x="82" y="330" width="136" height="58" fill="none" stroke="white" strokeWidth="1" />
      <rect x="118" y="388" width="64" height="8" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="150" cy="308" r="2" fill="white" />
    </svg>
  )
}

// ─── Freely positioned player on pitch ─────────────────────────
function FreePitchPlayer({ player, x, y, team, isSelected, isBeingDragged, hasSelection, onClick, onPointerDown }) {
  const meta = team === 'A' ? TEAM_A : TEAM_B
  const SIZE = 38

  return (
    <div
      className="absolute z-10"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={onClick}
          onPointerDown={onPointerDown}
          className="rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{
            width: SIZE, height: SIZE,
            touchAction: 'none',
            opacity: isBeingDragged ? 0.2 : 1,
            background: meta.dim,
            border: `2px solid ${isSelected ? '#ffffff' : hasSelection ? meta.color : meta.color + 'bb'}`,
            boxShadow: isSelected ? `0 0 0 3px ${meta.color}55, 0 0 18px ${meta.color}88` : 'none',
          }}
        >
          {!isBeingDragged && (
            player.avatarUrl ? (
              <img src={player.avatarUrl} alt={player.name} className="rounded-full object-cover" style={{ width: SIZE - 4, height: SIZE - 4 }} />
            ) : (
              <span className="text-xs font-bold" style={{ color: meta.text }}>{player.name[0].toUpperCase()}</span>
            )
          )}
        </button>
        {!isBeingDragged && (
          <span
            className="text-[8px] font-semibold leading-none text-center"
            style={{ maxWidth: 50, color: 'rgba(255,255,255,0.95)', textShadow: '0 1px 4px rgba(0,0,0,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {player.name.split(' ')[0]}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Pool player token ─────────────────────────────────────────
function PoolToken({ player, isSelected, onTap, onPointerDown }) {
  return (
    <button
      onClick={onTap}
      onPointerDown={onPointerDown}
      className="flex flex-col items-center gap-1 shrink-0 transition-all active:scale-90"
      style={{ touchAction: 'none' }}
    >
      <div
        className="rounded-full overflow-hidden flex items-center justify-center"
        style={{
          width: 44, height: 44, background: '#1c2330',
          border: `2px solid ${isSelected ? '#fff' : '#334155'}`,
          boxShadow: isSelected ? '0 0 0 2px rgba(255,255,255,0.25), 0 0 16px rgba(255,255,255,0.25)' : 'none',
        }}
      >
        {player.avatarUrl ? (
          <img src={player.avatarUrl} alt={player.name} className="rounded-full object-cover" style={{ width: 40, height: 40 }} />
        ) : (
          <span className="text-sm font-bold text-[#64748b]">{player.name[0].toUpperCase()}</span>
        )}
      </div>
      <span
        className="text-[8px] font-medium text-[#94a3b8] text-center"
        style={{ maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {player.name.split(' ')[0]}
      </span>
    </button>
  )
}

// ─── Score Input ───────────────────────────────────────────────
function ScoreInput({ label, value, onChange, color, textColor }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color }}>{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange((v) => String(Math.max(0, (Number(v) || 0) - 1)))}
          className="w-8 h-8 rounded-xl text-lg font-bold transition-colors flex items-center justify-center"
          style={{ background: '#1c2330', color: '#64748b', border: '1px solid #252d3a' }}
        >
          –
        </button>
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-14 h-14 text-center rounded-xl text-3xl font-bold focus:outline-none focus:ring-2"
          style={{
            fontFamily: "'Oswald', sans-serif",
            background: value !== '' ? '#1c2330' : '#141920',
            border: `1px solid ${value !== '' ? color : '#252d3a'}`,
            color: value !== '' ? textColor : '#334155',
            focusRingColor: color,
          }}
          placeholder="0"
        />
        <button
          onClick={() => onChange((v) => String((Number(v) || 0) + 1))}
          className="w-8 h-8 rounded-xl text-lg font-bold transition-colors flex items-center justify-center"
          style={{ background: '#1c2330', color: '#64748b', border: '1px solid #252d3a' }}
        >
          +
        </button>
      </div>
    </div>
  )
}

// ─── Match Card ────────────────────────────────────────────────
function weatherEmoji(code) {
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤️'
  if (code === 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌦️'
  return '⛈️'
}

function MatchCard({ session, players, firePlayerIds = new Set(), onEdit, onDelete, onSetMotm, onSaveReport, onFetchWeather }) {
  const [expanded, setExpanded] = useState(false)
  const [pickingMotm, setPickingMotm] = useState(false)
  const [editingReport, setEditingReport] = useState(false)
  const [draftReport, setDraftReport] = useState(session.report ?? '')
  const [draftWrittenBy, setDraftWrittenBy] = useState(session.writtenBy ?? 'h-shez')
  const [fetchingWeather, setFetchingWeather] = useState(false)
  const playerName = (id) => players.find((p) => p.id === id)?.name ?? 'Unknown'
  const playerObj = (id) => players.find((p) => p.id === id)

  const hasResult = !!session.result
  const hasTeams = !!session.teams
  const matchFormat = formatOf(session)
  const motmIds = session.motm ?? []
  const motmPlayers = motmIds.map((id) => players.find((p) => p.id === id)).filter(Boolean)
  const attendingPlayers = players.filter((p) => session.playerIds.includes(p.id))

  let resultLabel = null
  let resultColor = '#64748b'
  if (hasResult) {
    const { scoreA, scoreB } = session.result
    if (scoreA > scoreB)       { resultLabel = 'Team A Win'; resultColor = TEAM_A.color }
    else if (scoreB > scoreA)  { resultLabel = 'Team B Win'; resultColor = TEAM_B.color }
    else                       { resultLabel = 'Draw';       resultColor = '#f59e0b' }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#141920', border: '1px solid #252d3a' }}>

      {/* ── Date / badges / actions row ── */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #252d3a' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold uppercase text-[#f1f5f9]" style={{ fontFamily: "'Oswald', sans-serif" }}>
            {formatDate(session.date)}
          </p>
          {resultLabel && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: resultColor + '22', color: resultColor, border: `1px solid ${resultColor}44` }}
            >
              {resultLabel}
            </span>
          )}
          {!hasResult && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: '#3d2c0022', color: '#f59e0b', border: '1px solid #f59e0b44' }}
            >
              Upcoming
            </span>
          )}
          {hasTeams && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: '#1c2330', color: '#64748b', border: '1px solid #252d3a' }}
            >
              {matchFormat}-a-side
            </span>
          )}
          {session.weather ? (
            <span className="text-[10px] text-[#475569]">
              {weatherEmoji(session.weather.code)} {session.weather.tempC}°C
            </span>
          ) : hasResult && (
            <button
              onClick={async () => { setFetchingWeather(true); await onFetchWeather(); setFetchingWeather(false) }}
              disabled={fetchingWeather}
              className="text-[10px] text-[#334155] hover:text-[#64748b] transition-colors disabled:opacity-40"
            >
              {fetchingWeather ? 'Fetching…' : '+ Weather'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasTeams && (
            <button
              onClick={() => shareTeamLineup(session, players)}
              className="text-[#25d366] hover:text-[#22c55e] transition-colors"
              aria-label="Share teams on WhatsApp"
              title="Share teams"
            >
              <WhatsAppIcon className="w-4 h-4" />
            </button>
          )}
          <button onClick={onEdit} className="text-[#64748b] hover:text-[#94a3b8] transition-colors" aria-label="Edit">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" />
            </svg>
          </button>
          <button onClick={onDelete} className="text-[#64748b] hover:text-red-400 transition-colors" aria-label="Delete">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Score + teams ── */}
      <div className="px-4 py-4">
        {hasResult ? (
          <div className="flex items-stretch gap-3">
            {/* Team A */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: TEAM_A.color }}>{TEAM_A.label}</p>
              {(session.teams?.teamA ?? []).slice(0, expanded ? undefined : 4).map((id) => (
                <div key={id} className="flex items-center gap-1 leading-relaxed">
                  <PlayerAvatar player={playerObj(id)} size={14} />
                  {motmIds.includes(id) && <span className="text-[10px] shrink-0">⭐</span>}
                  <span className="text-xs text-[#94a3b8] truncate">{playerName(id)}</span>
                  {firePlayerIds.has(id) && <FireIcon size={11} />}
                </div>
              ))}
              {!expanded && (session.teams?.teamA?.length ?? 0) > 4 && (
                <p className="text-[10px] text-[#334155]">+{session.teams.teamA.length - 4} more</p>
              )}
            </div>
            {/* Score */}
            <div className="flex flex-col items-center justify-center px-2 shrink-0">
              {session.result.scoreKnown === false ? (
                <div className="flex flex-col items-center gap-1">
                  <span
                    className="text-xl font-bold px-3 py-1 rounded-lg"
                    style={{
                      fontFamily: "'Oswald', sans-serif",
                      background: session.result.scoreA > session.result.scoreB ? TEAM_A.dim
                        : session.result.scoreB > session.result.scoreA ? TEAM_B.dim : '#3d2c00',
                      color: session.result.scoreA > session.result.scoreB ? TEAM_A.text
                        : session.result.scoreB > session.result.scoreA ? TEAM_B.text : '#f59e0b',
                    }}
                  >
                    {session.result.scoreA > session.result.scoreB ? 'W-L'
                      : session.result.scoreB > session.result.scoreA ? 'L-W' : 'D-D'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-4xl font-bold leading-none" style={{ fontFamily: "'Oswald', sans-serif", color: session.result.scoreA > session.result.scoreB ? TEAM_A.text : '#64748b' }}>
                    {session.result.scoreA}
                  </span>
                  <span className="text-2xl font-bold text-[#334155]" style={{ fontFamily: "'Oswald', sans-serif" }}>–</span>
                  <span className="text-4xl font-bold leading-none" style={{ fontFamily: "'Oswald', sans-serif", color: session.result.scoreB > session.result.scoreA ? TEAM_B.text : '#64748b' }}>
                    {session.result.scoreB}
                  </span>
                </div>
              )}
              <p className="text-[9px] uppercase tracking-widest text-[#334155] mt-1">{session.playerIds.length}p</p>
            </div>
            {/* Team B */}
            <div className="flex-1 min-w-0 text-right">
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: TEAM_B.color }}>{TEAM_B.label}</p>
              {(session.teams?.teamB ?? []).slice(0, expanded ? undefined : 4).map((id) => (
                <div key={id} className="flex items-center justify-end gap-1 leading-relaxed">
                  {firePlayerIds.has(id) && <FireIcon size={11} />}
                  <span className="text-xs text-[#94a3b8] truncate">{playerName(id)}</span>
                  {motmIds.includes(id) && <span className="text-[10px] shrink-0">⭐</span>}
                  <PlayerAvatar player={playerObj(id)} size={14} />
                </div>
              ))}
              {!expanded && (session.teams?.teamB?.length ?? 0) > 4 && (
                <p className="text-[10px] text-[#334155]">+{session.teams.teamB.length - 4} more</p>
              )}
            </div>
          </div>
        ) : hasTeams ? (
          <div className="flex items-stretch gap-3">
            <TeamList meta={TEAM_A} ids={session.teams.teamA} players={players} playerName={playerName} motmIds={motmIds} expanded={expanded} firePlayerIds={firePlayerIds} />
            <div className="flex flex-col items-center justify-center px-2 shrink-0">
              <span className="text-[#334155] text-2xl font-bold" style={{ fontFamily: "'Oswald', sans-serif" }}>vs</span>
              <p className="text-[9px] uppercase tracking-widest text-[#334155] mt-1">{session.playerIds.length}p</p>
            </div>
            <div className="flex-1 min-w-0 text-right">
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: TEAM_B.color }}>{TEAM_B.label}</p>
              {session.teams.teamB.slice(0, expanded ? undefined : 4).map((id) => (
                <div key={id} className="flex items-center justify-end gap-1 leading-relaxed">
                  {firePlayerIds.has(id) && <FireIcon size={11} />}
                  <span className="text-xs text-[#94a3b8] truncate">{playerName(id)}</span>
                  {motmIds.includes(id) && <span className="text-[10px] shrink-0">⭐</span>}
                  <PlayerAvatar player={playerObj(id)} size={14} />
                </div>
              ))}
              {!expanded && session.teams.teamB.length > 4 && (
                <p className="text-[10px] text-[#334155]">+{session.teams.teamB.length - 4} more</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {session.playerIds.map((id) => (
              <span key={id} className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#1c2330', color: '#94a3b8', border: '1px solid #252d3a' }}>
                {playerName(id)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── MOTM strip ── */}
      {session.playerIds.length > 0 && !pickingMotm && (
        <div
          className="mx-4 mb-4 rounded-xl overflow-hidden"
          style={{ border: `1px solid ${motmPlayers.length > 0 ? '#a16207' : '#252d3a'}` }}
        >
          {motmPlayers.length > 0 ? (
            /* Awarded */
            <div
              className="flex items-center gap-3 px-3 py-2.5"
              style={{ background: 'linear-gradient(to right, #2d1f00, #1c1400)' }}
            >
              <span className="text-lg leading-none shrink-0">⭐</span>
              <div className="flex -space-x-1 shrink-0">
                {motmPlayers.map((p) => <PlayerAvatar key={p.id} player={p} size={28} />)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#a16207]">
                  {motmPlayers.length > 1 ? 'Joint ' : ''}Man of the Match
                </p>
                <p className="font-bold text-[#fbbf24] truncate" style={{ fontFamily: "'Oswald', sans-serif" }}>
                  {motmPlayers.map((p) => p.name).join(' & ')}
                </p>
              </div>
              <button
                onClick={() => shareMotmResult(session, players)}
                title="Share result on WhatsApp"
                className="text-[#a16207] hover:text-[#25d366] transition-colors shrink-0 mr-1"
              >
                <WhatsAppIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPickingMotm(true)}
                className="text-[10px] font-semibold text-[#a16207] hover:text-[#fbbf24] transition-colors shrink-0"
              >
                Change
              </button>
            </div>
          ) : (
            /* Not awarded yet */
            <div className="flex items-center justify-between px-3 py-2.5" style={{ background: '#141920' }}>
              <button onClick={() => setPickingMotm(true)} className="flex items-center gap-2">
                <span className="text-base leading-none opacity-40">⭐</span>
                <span className="text-xs font-semibold text-[#334155] hover:text-[#64748b] transition-colors">
                  Award MOTM
                </span>
              </button>
              <button
                onClick={() => shareMotmVote(session, players)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors"
                style={{ background: '#0a2818', color: '#25d366', border: '1px solid #25d36633' }}
              >
                <WhatsAppIcon className="w-3.5 h-3.5" />
                Share Vote
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MOTM picker (multi-select) ── */}
      {pickingMotm && (
        <div className="mx-4 mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid #a16207', background: '#1c1400' }}>
          <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid #2d1f00' }}>
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">⭐</span>
              <p className="text-xs font-bold uppercase tracking-widest text-[#a16207]">Man of the Match</p>
            </div>
            <button
              onClick={() => setPickingMotm(false)}
              className="text-xs font-bold uppercase tracking-wider text-[#a16207] hover:text-[#fbbf24] transition-colors"
              style={{ fontFamily: "'Oswald', sans-serif" }}
            >
              Done
            </button>
          </div>
          <p className="text-[10px] text-[#475569] px-3 pt-2">Tap to select · tap again to deselect · select multiple for a tie</p>
          <div className="p-3 flex flex-wrap gap-2">
            {attendingPlayers.map((p) => {
              const isSelected = motmIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    const newIds = isSelected
                      ? motmIds.filter((id) => id !== p.id)
                      : [...motmIds, p.id]
                    onSetMotm(newIds)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    fontFamily: isSelected ? "'Oswald', sans-serif" : 'inherit',
                    background: isSelected ? '#3d2c00' : '#252d3a',
                    color: isSelected ? '#fbbf24' : '#94a3b8',
                    border: `1px solid ${isSelected ? '#a16207' : '#334155'}`,
                    boxShadow: isSelected ? '0 0 10px #f59e0b33' : 'none',
                  }}
                >
                  <PlayerAvatar player={p} size={20} />
                  {isSelected && <span className="text-xs">⭐</span>}
                  {p.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Match report ── */}
      {hasResult && (
        <div className="mx-4 mb-4">
          {editingReport ? (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #252d3a', background: '#0f1621' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#64748b] px-3 pt-2.5 pb-1">Match Report</p>
              <textarea
                value={draftReport}
                onChange={(e) => setDraftReport(e.target.value)}
                placeholder="Write a match report…"
                rows={4}
                className="w-full px-3 pb-2 text-xs text-[#cbd5e1] resize-none outline-none"
                style={{ background: 'transparent' }}
              />
              <div className="px-3 pb-2">
                <label className="text-[10px] uppercase tracking-widest text-[#475569] font-semibold block mb-1">Written by</label>
                <select
                  value={draftWrittenBy}
                  onChange={(e) => setDraftWrittenBy(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg text-xs text-[#94a3b8] outline-none"
                  style={{ background: '#1c2330', border: '1px solid #252d3a' }}
                >
                  <option value="">— optional —</option>
                  {attendingPlayers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 px-3 pb-3">
                <button
                  onClick={async () => {
                    await onSaveReport(draftReport, draftWrittenBy)
                    setEditingReport(false)
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  style={{ background: '#16a34a', color: '#fff' }}
                >
                  Save
                </button>
                <button
                  onClick={() => { setDraftReport(session.report ?? ''); setDraftWrittenBy(session.writtenBy ?? 'h-shez'); setEditingReport(false) }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#64748b] hover:text-[#94a3b8] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : session.report ? (
            <div className="rounded-xl px-3 py-2.5" style={{ background: '#0f1621', border: '1px solid #252d3a' }}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#64748b]">Match Report</p>
                <button
                  onClick={() => setEditingReport(true)}
                  className="text-[10px] font-semibold text-[#334155] hover:text-[#64748b] transition-colors"
                >
                  Edit
                </button>
              </div>
              <p className="text-xs text-[#94a3b8] whitespace-pre-wrap leading-relaxed">{session.report}</p>
              {session.writtenBy && (
                <p className="text-[10px] text-[#475569] mt-2 italic">
                  Written by {players.find((p) => p.id === session.writtenBy)?.name ?? 'Unknown'}
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setEditingReport(true)}
              className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#334155] hover:text-[#64748b] transition-colors"
              style={{ border: '1px dashed #252d3a' }}
            >
              + Add match report
            </button>
          )}
        </div>
      )}

      {/* ── Expand toggle ── */}
      {hasTeams && ((session.teams?.teamA?.length ?? 0) + (session.teams?.teamB?.length ?? 0) > 8) && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full py-2 text-[10px] uppercase tracking-widest text-[#334155] hover:text-[#64748b] transition-colors"
          style={{ borderTop: '1px solid #252d3a' }}
        >
          {expanded ? '▲ Show less' : '▼ Show all players'}
        </button>
      )}
    </div>
  )
}

function TeamList({ meta, ids, players, playerName, motmIds = [], expanded, firePlayerIds = new Set() }) {
  const shown = expanded ? ids : ids.slice(0, 4)
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: meta.color }}>{meta.label}</p>
      {shown.map((id) => {
        const p = players?.find((pl) => pl.id === id)
        return (
          <Link key={id} to={`/player/${id}`} className="flex items-center gap-1 leading-relaxed">
            <PlayerAvatar player={p} size={14} />
            {motmIds.includes(id) && <span className="text-[10px] shrink-0">⭐</span>}
            <span className="text-xs text-[#94a3b8] truncate">{playerName(id)}</span>
            {firePlayerIds.has(id) && <FireIcon size={11} />}
          </Link>
        )
      })}
      {!expanded && ids.length > 4 && (
        <p className="text-[10px] text-[#334155]">+{ids.length - 4} more</p>
      )}
    </div>
  )
}

// ─── helpers ───────────────────────────────────────────────────
const POS_COLOR = { GK: '#f59e0b', DEF: '#3b82f6', MID: '#16a34a', FWD: '#ef4444' }
const POS_BG    = { GK: '#3d2c00', DEF: '#1e3a5f', MID: '#14532d', FWD: '#3d1515' }

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ─── WhatsApp share helpers ─────────────────────────────────────
function WhatsAppIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function shareTeamLineup(session, players) {
  if (!session.teams) return
  const name = (id) => players.find((p) => p.id === id)?.name ?? 'Unknown'
  const date = formatDate(session.date)
  const teamA = session.teams.teamA.map(name).join(' ')
  const teamB = session.teams.teamB.map(name).join(' ')
  const lines = [
    `⚽ Sunday FC — ${date}`,
    '',
    `${teamA} V ${teamB}`,
  ]
  window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
}

async function shareMotmVote(session, players) {
  const name = (id) => players.find((p) => p.id === id)?.name ?? 'Unknown'
  const date = formatDate(session.date)

  // Build the player list for the vote page (all attending players)
  const votePlayers = session.playerIds.map((id) => {
    const p = players.find((pl) => pl.id === id)
    return { id, name: p?.name ?? 'Unknown', avatarUrl: p?.avatarUrl ?? null }
  })

  // Score label
  let scoreLabel = null
  if (session.result) {
    scoreLabel = `Team A ${session.result.scoreA} – ${session.result.scoreB} Team B`
  }

  // Upsert the vote session into Supabase so the vote page can load it
  await supabase.from('vote_sessions').upsert(
    { session_id: session.id, date, score_label: scoreLabel, players: votePlayers },
    { onConflict: 'session_id' }
  )

  // Build the shareable vote URL
  const base = window.location.href.replace(/#.*$/, '')
  const voteUrl = `${base}#/vote/${session.id}`

  const lines = [
    '⭐ MOTM Vote — Sunday FC ⭐',
    '',
    `📅 ${date}`,
  ]
  if (scoreLabel) lines.push(`⚽ ${scoreLabel}`)
  lines.push('')
  lines.push('Vote for your Man of the Match:')
  lines.push(voteUrl)

  window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
}

function shareMotmResult(session, players) {
  const motmIds = session.motm ?? []
  const motmNames = motmIds.map((id) => players.find((p) => p.id === id)?.name).filter(Boolean)
  if (!motmNames.length) return
  const nameStr = motmNames.join(' & ')
  const date = formatDate(session.date)

  const lines = [
    '⭐ Man of the Match — Sunday FC ⭐',
    '',
    `📅 ${date}`,
  ]

  if (session.result) {
    lines.push(`⚽ Team A ${session.result.scoreA} – ${session.result.scoreB} Team B`)
  }

  lines.push('')
  lines.push(`🏆 ${motmNames.length > 1 ? 'Joint ' : ''}MOTM: ${nameStr}`)
  lines.push('')
  lines.push(`Congrats ${nameStr}! 👏`)

  window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
}
