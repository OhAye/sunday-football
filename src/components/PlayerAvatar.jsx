import { initialOf } from '../lib/format'

// Round player photo, or an initial on a tinted disc. `ring` adds a coloured outline (team / position).
export default function PlayerAvatar({ player, size = 16, ring = null, className = '' }) {
  if (!player) return null
  const style = {
    width: size,
    height: size,
    boxShadow: ring ? `0 0 0 ${size >= 40 ? 2 : 1.5}px ${ring}` : '0 0 0 1px rgba(255,255,255,0.08)',
  }
  return player.avatarUrl ? (
    <img
      src={player.avatarUrl}
      alt=""
      loading="lazy"
      className={`shrink-0 rounded-full object-cover bg-raised ${className}`}
      style={style}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`shrink-0 rounded-full flex items-center justify-center font-display font-semibold text-mist ${className}`}
      style={{
        ...style,
        background: 'linear-gradient(145deg, #252d3a, #1c2330)',
        fontSize: Math.max(8, Math.floor(size * 0.44)),
        lineHeight: 1,
      }}
    >
      {initialOf(player.name)}
    </span>
  )
}
