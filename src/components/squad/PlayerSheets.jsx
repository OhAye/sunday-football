// Bottom sheets for the Squad page: add a player, edit a player (admin), and the
// PIN-protected photo update that any player can use for their own avatar.
import { useRef, useState } from 'react'
import { useApp } from '../../context/app-context'
import { useFeedback } from '../feedback-context'
import { POSITIONS, POSITION_META } from '../../lib/constants'
import { uploadAvatar } from '../../lib/avatar'
import { CameraIcon, TrashIcon } from '../icons'
import PlayerAvatar from '../PlayerAvatar'
import Sheet from '../Sheet'

// ── Shared fields ──────────────────────────────────────────────

function PositionPicker({ value, onChange }) {
  return (
    <div>
      <span className="field-label">Position</span>
      <div className="grid grid-cols-4 gap-2">
        {POSITIONS.map((pos) => {
          const meta = POSITION_META[pos]
          const on = value === pos
          return (
            <button
              key={pos} type="button" aria-pressed={on} onClick={() => onChange(pos)}
              className="font-display min-h-11 rounded-xl border text-sm font-semibold uppercase tracking-wider transition-colors"
              style={{
                background: on ? meta.bg : '#1c2330',
                color: on ? meta.color : '#64748b',
                borderColor: on ? meta.color : '#252d3a',
              }}
            >
              {pos}
            </button>
          )
        })}
      </div>
      <p className="mt-1.5 text-xs text-muted">{POSITION_META[value].full}</p>
    </div>
  )
}

function validate({ name, number, players, selfId }) {
  const trimmed = name.trim()
  if (!trimmed) return 'Name is required.'
  if (players.some((p) => p.id !== selfId && p.name.toLowerCase() === trimmed.toLowerCase())) {
    return 'A player with that name already exists.'
  }
  if (number !== '' && (!/^\d+$/.test(number) || Number(number) < 1 || Number(number) > 99)) {
    return 'Shirt number must be between 1 and 99.'
  }
  return null
}

// Photo chooser with preview. `file` is a newly chosen File, `removed` means clear the existing photo.
function PhotoPicker({ player, photo, onChange, size = 88 }) {
  const inputRef = useRef(null)
  const preview = photo.file ? photo.preview : photo.removed ? null : player.avatarUrl
  const pick = (e) => {
    const file = e.target.files?.[0]
    if (file) onChange({ file, preview: URL.createObjectURL(file), removed: false })
  }
  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => inputRef.current?.click()} className="relative shrink-0 rounded-full" aria-label="Choose a photo">
        <PlayerAvatar player={{ ...player, avatarUrl: preview }} size={size} />
        <span className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-green text-white">
          <CameraIcon className="w-4 h-4" />
        </span>
      </button>
      <div className="flex flex-col items-start gap-2">
        <button type="button" className="btn btn-sm btn-quiet" onClick={() => inputRef.current?.click()}>
          {preview ? 'Change photo' : 'Upload photo'}
        </button>
        {preview && (
          <button type="button" className="text-xs font-semibold text-red-bright" onClick={() => onChange({ file: null, preview: null, removed: true })}>
            Remove photo
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />
    </div>
  )
}

const NO_PHOTO_CHANGE = { file: null, preview: null, removed: false }

// Resolve a PhotoPicker state into the avatarUrl to store (uploads if needed). Throws on upload failure.
async function resolveAvatar(player, photo) {
  if (photo.file) return uploadAvatar(player.id, photo.file)
  if (photo.removed) return null
  return player.avatarUrl ?? null
}

// ── Add player ─────────────────────────────────────────────────

export function AddPlayerSheet({ onClose }) {
  const { players, addPlayer } = useApp()
  const { toast } = useFeedback()
  const [name, setName] = useState('')
  const [position, setPosition] = useState('MID')
  const [number, setNumber] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const problem = validate({ name, number, players })
    if (problem) return setError(problem)
    setBusy(true)
    const player = await addPlayer({ name, position, number: number || null })
    setBusy(false)
    if (!player) return setError('Couldn’t add the player. Check your connection and try again.')
    toast(`${player.name} added to the squad`)
    onClose()
  }

  return (
    <Sheet title="New player" kicker="Squad" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="field-label" htmlFor="new-name">Name</label>
          <input id="new-name" type="text" autoFocus autoComplete="off" value={name} placeholder="e.g. Marcus"
            onChange={(e) => { setName(e.target.value); setError('') }} className="field" />
        </div>
        <PositionPicker value={position} onChange={setPosition} />
        <div>
          <label className="field-label" htmlFor="new-number">Shirt number <span className="normal-case tracking-normal text-faint">· optional</span></label>
          <input id="new-number" type="number" inputMode="numeric" min="1" max="99" value={number} placeholder="1–99"
            onChange={(e) => { setNumber(e.target.value); setError('') }} className="field w-28 text-center" />
        </div>
        {error && <p role="alert" className="text-sm text-red-bright">{error}</p>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? 'Adding…' : 'Add to squad'}
        </button>
      </form>
    </Sheet>
  )
}

// ── Edit player (admin) ────────────────────────────────────────

export function EditPlayerSheet({ player, onClose }) {
  const { players, updatePlayer, removePlayer } = useApp()
  const { toast, confirm } = useFeedback()
  const [name, setName] = useState(player.name)
  const [position, setPosition] = useState(POSITION_META[player.position] ? player.position : 'MID')
  const [number, setNumber] = useState(player.number?.toString() ?? '')
  const [injured, setInjured] = useState(!!player.injured)
  const [resetPin, setResetPin] = useState(false)
  const [photo, setPhoto] = useState(NO_PHOTO_CHANGE)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const problem = validate({ name, number, players, selfId: player.id })
    if (problem) return setError(problem)
    setBusy(true)
    let avatarUrl
    try {
      avatarUrl = await resolveAvatar(player, photo)
    } catch (err) {
      console.error('Avatar upload error:', err)
      setBusy(false)
      return setError(`Photo upload failed: ${err?.message ?? err}`)
    }
    const ok = await updatePlayer(player.id, {
      name: name.trim(),
      position,
      number: number ? Number(number) : null,
      injured,
      avatarUrl,
      ...(resetPin ? { avatarPin: null } : {}),
    })
    setBusy(false)
    if (!ok) return setError('Couldn’t save. Check your connection and try again.')
    toast('Player updated')
    onClose()
  }

  async function handleDelete() {
    const yes = await confirm({
      title: `Remove ${player.name}?`,
      body: 'They’ll be removed from the squad for everyone. Their past matches stay, but will show them as “Unknown”.',
      confirmLabel: 'Remove player',
      danger: true,
    })
    if (!yes) return
    setBusy(true)
    const ok = await removePlayer(player.id)
    setBusy(false)
    if (!ok) return setError('Couldn’t remove the player. Try again.')
    toast(`${player.name} removed`)
    onClose()
  }

  return (
    <Sheet title={player.name} kicker="Edit player" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <PhotoPicker player={player} photo={photo} onChange={setPhoto} size={72} />
        <div>
          <label className="field-label" htmlFor="edit-name">Name</label>
          <input id="edit-name" type="text" autoComplete="off" value={name}
            onChange={(e) => { setName(e.target.value); setError('') }} className="field" />
        </div>
        <PositionPicker value={position} onChange={setPosition} />
        <div>
          <label className="field-label" htmlFor="edit-number">Shirt number <span className="normal-case tracking-normal text-faint">· optional</span></label>
          <input id="edit-number" type="number" inputMode="numeric" min="1" max="99" value={number} placeholder="1–99"
            onChange={(e) => { setNumber(e.target.value); setError('') }} className="field w-28 text-center" />
        </div>

        <ToggleRow label="Injured" hint="Hidden from the team picker until they’re back." icon="🩹" on={injured} onChange={setInjured} danger />
        {player.avatarPin && (
          <ToggleRow label="Reset photo PIN" hint="They’ll choose a new PIN next time they change their photo." icon="🔑" on={resetPin} onChange={setResetPin} />
        )}

        {error && <p role="alert" className="text-sm text-red-bright">{error}</p>}

        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="btn btn-danger btn-block" disabled={busy} onClick={handleDelete}>
          <TrashIcon className="w-4 h-4" /> Remove from squad
        </button>
      </form>
    </Sheet>
  )
}

function ToggleRow({ label, hint, icon, on, onChange, danger = false }) {
  const accent = danger ? '#ef4444' : '#16a34a'
  return (
    <button
      type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className="flex w-full items-center gap-3 rounded-2xl border bg-raised px-4 py-3 text-left transition-colors"
      style={{ borderColor: on ? `${accent}88` : '#252d3a' }}
    >
      <span className="text-lg" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold" style={{ color: on ? (danger ? '#f87171' : '#22c55e') : '#cbd5e1' }}>{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <span className="flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors" style={{ background: on ? accent : '#334155' }}>
        <span className="h-5 w-5 rounded-full bg-white transition-transform" style={{ transform: on ? 'translateX(20px)' : 'none' }} />
      </span>
    </button>
  )
}

// ── Photo update (anyone, protected by the player's own PIN) ────

function PinInput({ id, value, onChange, onEnter, autoFocus = false }) {
  return (
    <input
      id={id} type="password" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="••••" autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      className="field font-display text-center text-2xl tracking-[0.5em]"
    />
  )
}

export function AvatarSheet({ player, onClose }) {
  const { updatePlayer } = useApp()
  const { toast } = useFeedback()
  // verify (has a PIN) → photo, or create (no PIN yet) → photo
  const [step, setStep] = useState(player.avatarPin ? 'verify' : 'create')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [newPin, setNewPin] = useState(null)
  const [photo, setPhoto] = useState(NO_PHOTO_CHANGE)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function verify() {
    if (pin === player.avatarPin) { setStep('photo'); setError('') }
    else setError('That PIN isn’t right. Ask an admin to reset it if you’ve forgotten.')
    setPin('')
  }

  function create() {
    if (!/^\d{4}$/.test(pin)) return setError('Your PIN needs to be exactly 4 digits.')
    if (pin !== confirmPin) return setError('Those PINs don’t match.')
    setNewPin(pin)
    setStep('photo')
    setError('')
  }

  const changed = !!photo.file || (photo.removed && !!player.avatarUrl)

  async function save() {
    setBusy(true)
    let avatarUrl
    try {
      avatarUrl = await resolveAvatar(player, photo)
    } catch (err) {
      console.error('Avatar upload error:', err)
      setBusy(false)
      return setError(`Photo upload failed: ${err?.message ?? err}`)
    }
    const ok = await updatePlayer(player.id, { avatarUrl, ...(newPin ? { avatarPin: newPin } : {}) })
    setBusy(false)
    if (!ok) return setError('Couldn’t save. Check your connection and try again.')
    toast('Photo updated')
    onClose()
  }

  return (
    <Sheet title={player.name} kicker="Profile photo" onClose={onClose}>
      <div className="space-y-5">
        {step === 'verify' && (
          <>
            <p className="text-sm text-mist">Enter your 4-digit PIN to change your photo.</p>
            <PinInput value={pin} onChange={(v) => { setPin(v); setError('') }} onEnter={verify} autoFocus />
            {error && <p role="alert" className="text-sm text-red-bright">{error}</p>}
            <button type="button" className="btn btn-primary btn-lg btn-block" disabled={pin.length !== 4} onClick={verify}>Continue</button>
          </>
        )}

        {step === 'create' && (
          <>
            <p className="text-sm text-mist">First, choose a 4-digit PIN. It stops anyone else changing your photo.</p>
            <div>
              <label className="field-label" htmlFor="pin-new">Choose a PIN</label>
              <PinInput id="pin-new" value={pin} onChange={(v) => { setPin(v); setError('') }} autoFocus />
            </div>
            <div>
              <label className="field-label" htmlFor="pin-confirm">Type it again</label>
              <PinInput id="pin-confirm" value={confirmPin} onChange={(v) => { setConfirmPin(v); setError('') }} onEnter={create} />
            </div>
            {error && <p role="alert" className="text-sm text-red-bright">{error}</p>}
            <button type="button" className="btn btn-primary btn-lg btn-block" disabled={pin.length !== 4 || confirmPin.length !== 4} onClick={create}>
              Set PIN
            </button>
          </>
        )}

        {step === 'photo' && (
          <>
            <PhotoPicker player={player} photo={photo} onChange={(p) => { setPhoto(p); setError('') }} size={96} />
            {error && <p role="alert" className="text-sm text-red-bright">{error}</p>}
            <button type="button" className="btn btn-primary btn-lg btn-block" disabled={busy || !changed} onClick={save}>
              {busy ? 'Uploading…' : 'Save photo'}
            </button>
          </>
        )}
      </div>
    </Sheet>
  )
}
