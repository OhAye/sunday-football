import { useMemo, useState } from 'react'
import { useApp } from '../../context/app-context'
import { useFeedback } from '../feedback-context'
import { TEAM } from '../../lib/constants'
import { normalizeName, parseTeamsMessage } from '../../lib/parseTeams'
import { CheckIcon } from '../icons'
import PlayerAvatar from '../PlayerAvatar'
import Sheet from '../Sheet'

// Paste a WhatsApp teams message → review the name matches → fill both teams.
// Names the user confirms or picks by hand are remembered as aliases on the player,
// so "Shehzad" matches Shez automatically next time.
export default function PasteTeamsSheet({ onApply, onClose }) {
  const { players, playerById, updatePlayer } = useApp()
  const { toast } = useFeedback()
  const [text, setText] = useState('')
  const [picks, setPicks] = useState({}) // "A:0" → playerId | '' (overrides the parser's choice)
  const [busy, setBusy] = useState(false)

  const parsed = useMemo(() => (text.trim() ? parseTeamsMessage(text, players) : null), [text, players])
  const sorted = useMemo(() => [...players].sort((a, b) => a.name.localeCompare(b.name)), [players])

  const rows = parsed?.ok
    ? [['A', parsed.teamA], ['B', parsed.teamB]].flatMap(([side, entries]) =>
        entries.map((entry, i) => {
          const key = `${side}:${i}`
          return { key, side, entry, playerId: key in picks ? picks[key] : entry.playerId ?? '' }
        }))
    : []

  const chosen = rows.filter((r) => r.playerId).map((r) => r.playerId)
  const duplicates = new Set(chosen.filter((id, i) => chosen.indexOf(id) !== i))
  const unresolved = rows.filter((r) => !r.playerId).length
  const toCheck = rows.filter((r) => r.entry.status === 'guess' && !(r.key in picks)).length
  const teamIds = (side) => rows.filter((r) => r.side === side && r.playerId).map((r) => r.playerId)
  const canApply = parsed?.ok && duplicates.size === 0 && teamIds('A').length > 0 && teamIds('B').length > 0 && !busy

  async function pasteFromClipboard() {
    try {
      const clip = await navigator.clipboard.readText()
      if (clip) { setText(clip); setPicks({}) }
    } catch {
      toast('Couldn’t read the clipboard. Long-press the box and choose Paste.', 'error')
    }
  }

  async function apply() {
    setBusy(true)
    // Remember every spelling that didn't already match a player's name or alias
    const learned = new Map() // playerId → Set of new aliases
    for (const r of rows) {
      if (!r.playerId || r.entry.status === 'exact') continue
      const player = playerById.get(r.playerId)
      const known = [player.name, ...(player.aliases ?? [])].map(normalizeName)
      if (known.includes(normalizeName(r.entry.raw))) continue
      if (!learned.has(r.playerId)) learned.set(r.playerId, new Set())
      learned.get(r.playerId).add(r.entry.raw.trim())
    }
    for (const [playerId, names] of learned) {
      const player = playerById.get(playerId)
      await updatePlayer(playerId, { aliases: [...(player.aliases ?? []), ...names] }) // best effort
    }
    setBusy(false)
    onApply(teamIds('A'), teamIds('B'))
  }

  return (
    <Sheet
      title="Paste teams"
      kicker="From WhatsApp"
      onClose={onClose}
      footer={
        <>
          {parsed?.ok && unresolved > 0 && (
            <p className="mb-2 text-center text-xs text-amber">
              {unresolved} {unresolved === 1 ? 'name isn’t' : 'names aren’t'} matched and will be left out.
            </p>
          )}
          {duplicates.size > 0 && (
            <p className="mb-2 text-center text-xs text-red-bright">The same player is picked twice. Fix the rows marked in red.</p>
          )}
          <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!canApply} onClick={apply}>
            {busy ? 'Applying…' : parsed?.ok ? `Use these teams · ${teamIds('A').length} v ${teamIds('B').length}` : 'Use these teams'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="field-label mb-0" htmlFor="paste-teams">The message</label>
            <button type="button" className="btn btn-sm btn-quiet" onClick={pasteFromClipboard}>Paste</button>
          </div>
          <textarea
            id="paste-teams" rows={parsed?.ok ? 3 : 7} value={text}
            onChange={(e) => { setText(e.target.value); setPicks({}) }}
            placeholder={'Paste the whole WhatsApp message here.\n\nThe teams line should look like:\nShez Tony Zeshan V Jonny Sean Matt'}
            className="field resize-none text-sm leading-relaxed"
          />
        </div>

        {parsed && !parsed.ok && <p role="alert" className="text-sm text-amber">{parsed.error}</p>}

        {parsed?.ok && (
          <>
            {toCheck > 0 && (
              <p className="text-xs text-amber">
                {toCheck === 1 ? 'One name is a best guess' : `${toCheck} names are best guesses`} — check the amber {toCheck === 1 ? 'row' : 'rows'}. They’ll be remembered for next time.
              </p>
            )}
            {['A', 'B'].map((side) => (
              <section key={side}>
                <h3 className="eyebrow mb-2" style={{ color: TEAM[side].text }}>
                  {TEAM[side].label} · {teamIds(side).length}
                </h3>
                <ul className="space-y-1.5">
                  {rows.filter((r) => r.side === side).map((r) => (
                    <MatchRow
                      key={r.key} row={r} players={sorted} player={playerById.get(r.playerId)}
                      duplicate={duplicates.has(r.playerId)} confirmed={r.key in picks}
                      onPick={(id) => setPicks((prev) => ({ ...prev, [r.key]: id }))}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </Sheet>
  )
}

function MatchRow({ row, players, player, duplicate, confirmed, onPick }) {
  const { entry, playerId } = row
  const sure = entry.status === 'exact' && !confirmed
  const guess = entry.status === 'guess' && !confirmed
  const border = duplicate ? 'border-red/60' : !playerId || guess ? 'border-amber/50' : 'border-line'
  // Likely candidates first, then everyone else
  const likely = entry.candidates.map((id) => players.find((p) => p.id === id)).filter(Boolean)
  const rest = players.filter((p) => !entry.candidates.includes(p.id))

  return (
    <li className={`flex items-center gap-2.5 rounded-xl border bg-raised py-1.5 pl-2.5 pr-1.5 ${border}`}>
      {player ? <PlayerAvatar player={player} size={28} /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-amber text-xs text-amber">?</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{entry.raw}</span>
        {!sure && (
          <span className={`block text-[11px] ${duplicate ? 'text-red-bright' : playerId && !guess ? 'text-muted' : 'text-amber'}`}>
            {duplicate ? 'Picked twice' : !playerId ? 'Not matched — pick a player' : guess ? 'Best guess — check' : 'Chosen by you'}
          </span>
        )}
      </span>
      {sure ? (
        <span className="mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-dim text-green-bright">
          <CheckIcon className="w-3.5 h-3.5" strokeWidth={3} />
        </span>
      ) : (
        <select
          value={playerId} onChange={(e) => onPick(e.target.value)} aria-label={`Player for ${entry.raw}`}
          className="field min-h-9 w-[42%] shrink-0 py-1 pl-2.5 pr-1 text-sm"
        >
          <option value="">Leave out</option>
          {likely.length > 0 && <optgroup label="Likely">{likely.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
          <optgroup label={likely.length > 0 ? 'Everyone' : 'Squad'}>{rest.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
        </select>
      )}
    </li>
  )
}
