import { useState } from 'react'
import { useApp } from '../context/AppContext'

// ─── colour tokens ─────────────────────────────────────────────
const TEAM_A = { color: '#16a34a', dim: '#14532d', border: '#16a34a55', text: '#22c55e', label: 'Team A' }
const TEAM_B = { color: '#3b82f6', dim: '#1e3a5f', border: '#3b82f655', text: '#60a5fa', label: 'Team B' }

export default function Lineups() {
  const { players, sessions, saveMatch, updateSession, removeSession } = useApp()
  const [view, setView] = useState('list')   // 'list' | 'new' | 'edit'
  const [editId, setEditId] = useState(null)

  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  const editSession = sessions.find((s) => s.id === editId) ?? null

  function handleSave(data) {
    if (view === 'new') {
      saveMatch(data)
    } else {
      const hasScore = data.scoreA !== '' && data.scoreB !== '' && data.scoreA != null
      updateSession(editId, {
        date: data.date,
        playerIds: [...new Set([...data.teamA, ...data.teamB])],
        teams: { teamA: data.teamA, teamB: data.teamB },
        result: hasScore
          ? { scoreA: Number(data.scoreA), scoreB: Number(data.scoreB), goals: data.goals ?? {} }
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

  function handleDelete(id) {
    if (confirm('Delete this match?')) removeSession(id)
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
      <header className="px-5 pt-10 pb-5" style={{ background: 'linear-gradient(to bottom, #0f1a12, #0b0f14)' }}>
        <p className="text-[#16a34a] text-xs font-semibold tracking-[0.25em] uppercase mb-1">Matches</p>
        <div className="flex items-end justify-between">
          <h1 className="text-3xl font-bold uppercase text-[#f1f5f9] leading-none" style={{ fontFamily: "'Oswald', sans-serif" }}>
            Lineups
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
              onEdit={() => handleEdit(session.id)}
              onDelete={() => handleDelete(session.id)}
              onSetMotm={(playerId) => updateSession(session.id, { motm: playerId ?? null })}
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
  const [goals, setGoals] = useState(initialData?.result?.goals ?? {})
  const [showGoals, setShowGoals] = useState(false)

  const allAssigned = [...teamA, ...teamB]
  const canSave = teamA.length > 0 && teamB.length > 0

  function handleSave() {
    if (!canSave) return
    onSave({ date, teamA, teamB, scoreA, scoreB, goals })
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#0b0f14' }}>
      {/* Form header */}
      <header className="px-5 pt-10 pb-4" style={{ background: 'linear-gradient(to bottom, #0f1a12, #0b0f14)' }}>
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

        {/* Team builder */}
        <TeamBuilder
          allPlayers={players}
          teamA={teamA}
          teamB={teamB}
          onChange={(a, b) => { setTeamA(a); setTeamB(b) }}
        />

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

          {/* Goal scorers (collapsible) */}
          {allAssigned.length > 0 && scoreA !== '' && scoreB !== '' && (
            <div>
              <button
                onClick={() => setShowGoals((v) => !v)}
                className="text-xs text-[#16a34a] font-semibold hover:text-[#22c55e] transition-colors flex items-center gap-1"
              >
                <span>{showGoals ? '▾' : '▸'}</span>
                Goal scorers (optional)
              </button>
              {showGoals && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {allAssigned.map((id) => {
                    const p = players.find((pl) => pl.id === id)
                    if (!p) return null
                    const inA = teamA.includes(id)
                    return (
                      <div key={id} className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-bold px-1.5 rounded"
                          style={{ background: inA ? TEAM_A.dim : TEAM_B.dim, color: inA ? TEAM_A.text : TEAM_B.text }}
                        >
                          {inA ? 'A' : 'B'}
                        </span>
                        <span className="text-xs text-[#94a3b8] flex-1 truncate">{p.name}</span>
                        <input
                          type="number" min="0"
                          value={goals[id] ?? ''}
                          onChange={(e) => setGoals((prev) => ({ ...prev, [id]: Number(e.target.value) }))}
                          placeholder="0"
                          className="w-12 text-center rounded-lg px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
                          style={{ background: '#1c2330', border: '1px solid #252d3a', color: '#f1f5f9' }}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky save bar */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 max-w-lg mx-auto"
        style={{ background: 'linear-gradient(to top, #0b0f14 70%, transparent)', zIndex: 40 }}
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
function MatchCard({ session, players, onEdit, onDelete, onSetMotm }) {
  const [expanded, setExpanded] = useState(false)
  const [pickingMotm, setPickingMotm] = useState(false)
  const playerName = (id) => players.find((p) => p.id === id)?.name ?? 'Unknown'

  const hasResult = !!session.result
  const hasTeams = !!session.teams
  const motmPlayer = session.motm ? players.find((p) => p.id === session.motm) : null
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
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
                <p key={id} className="text-xs text-[#94a3b8] leading-relaxed truncate">
                  {session.motm === id && <span className="mr-1">⭐</span>}
                  {playerName(id)}
                  {session.result.goals?.[id] > 0 && <span className="text-[#22c55e] ml-1">⚽{session.result.goals[id]}</span>}
                </p>
              ))}
              {!expanded && (session.teams?.teamA?.length ?? 0) > 4 && (
                <p className="text-[10px] text-[#334155]">+{session.teams.teamA.length - 4} more</p>
              )}
            </div>
            {/* Score */}
            <div className="flex flex-col items-center justify-center px-2 shrink-0">
              <div className="flex items-center gap-1">
                <span className="text-4xl font-bold leading-none" style={{ fontFamily: "'Oswald', sans-serif", color: session.result.scoreA > session.result.scoreB ? TEAM_A.text : '#64748b' }}>
                  {session.result.scoreA}
                </span>
                <span className="text-2xl font-bold text-[#334155]" style={{ fontFamily: "'Oswald', sans-serif" }}>–</span>
                <span className="text-4xl font-bold leading-none" style={{ fontFamily: "'Oswald', sans-serif", color: session.result.scoreB > session.result.scoreA ? TEAM_B.text : '#64748b' }}>
                  {session.result.scoreB}
                </span>
              </div>
              <p className="text-[9px] uppercase tracking-widest text-[#334155] mt-1">{session.playerIds.length}p</p>
            </div>
            {/* Team B */}
            <div className="flex-1 min-w-0 text-right">
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: TEAM_B.color }}>{TEAM_B.label}</p>
              {(session.teams?.teamB ?? []).slice(0, expanded ? undefined : 4).map((id) => (
                <p key={id} className="text-xs text-[#94a3b8] leading-relaxed truncate">
                  {session.result.goals?.[id] > 0 && <span className="text-[#60a5fa] mr-1">⚽{session.result.goals[id]}</span>}
                  {playerName(id)}
                  {session.motm === id && <span className="ml-1">⭐</span>}
                </p>
              ))}
              {!expanded && (session.teams?.teamB?.length ?? 0) > 4 && (
                <p className="text-[10px] text-[#334155]">+{session.teams.teamB.length - 4} more</p>
              )}
            </div>
          </div>
        ) : hasTeams ? (
          <div className="flex items-stretch gap-3">
            <TeamList meta={TEAM_A} ids={session.teams.teamA} playerName={playerName} motmId={session.motm} expanded={expanded} />
            <div className="flex flex-col items-center justify-center px-2 shrink-0">
              <span className="text-[#334155] text-2xl font-bold" style={{ fontFamily: "'Oswald', sans-serif" }}>vs</span>
              <p className="text-[9px] uppercase tracking-widest text-[#334155] mt-1">{session.playerIds.length}p</p>
            </div>
            <div className="flex-1 min-w-0 text-right">
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: TEAM_B.color }}>{TEAM_B.label}</p>
              {session.teams.teamB.slice(0, expanded ? undefined : 4).map((id) => (
                <p key={id} className="text-xs text-[#94a3b8] leading-relaxed truncate">
                  {playerName(id)}
                  {session.motm === id && <span className="ml-1">⭐</span>}
                </p>
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
          style={{ border: `1px solid ${motmPlayer ? '#a16207' : '#252d3a'}` }}
        >
          {motmPlayer ? (
            /* Awarded */
            <div
              className="flex items-center gap-3 px-3 py-2.5"
              style={{ background: 'linear-gradient(to right, #2d1f00, #1c1400)' }}
            >
              <span className="text-lg leading-none">⭐</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#a16207]">Man of the Match</p>
                <p className="font-bold text-[#fbbf24] truncate" style={{ fontFamily: "'Oswald', sans-serif" }}>
                  {motmPlayer.name}
                </p>
              </div>
              <button
                onClick={() => setPickingMotm(true)}
                className="text-[10px] font-semibold text-[#a16207] hover:text-[#fbbf24] transition-colors shrink-0"
              >
                Change
              </button>
            </div>
          ) : (
            /* Not awarded yet */
            <button
              onClick={() => setPickingMotm(true)}
              className="w-full flex items-center gap-2 px-3 py-2.5 transition-colors"
              style={{ background: '#141920' }}
            >
              <span className="text-base leading-none opacity-40">⭐</span>
              <span className="text-xs font-semibold text-[#334155] hover:text-[#64748b] transition-colors">
                Award Man of the Match
              </span>
            </button>
          )}
        </div>
      )}

      {/* ── MOTM picker ── */}
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
          <div className="p-3 flex flex-wrap gap-2">
            {attendingPlayers.map((p) => {
              const isSelected = session.motm === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    onSetMotm(isSelected ? null : p.id)
                    if (!isSelected) setPickingMotm(false)
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
                  {isSelected && <span className="text-xs">⭐</span>}
                  {p.name}
                </button>
              )
            })}
          </div>
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

function TeamList({ meta, ids, playerName, motmId, expanded }) {
  const shown = expanded ? ids : ids.slice(0, 4)
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: meta.color }}>{meta.label}</p>
      {shown.map((id) => (
        <p key={id} className="text-xs text-[#94a3b8] leading-relaxed truncate">
          {motmId === id && <span className="mr-1">⭐</span>}
          {playerName(id)}
        </p>
      ))}
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
