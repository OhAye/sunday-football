export default function PlayerAvatar({ player, size = 16 }) {
  if (!player) return null
  return player.avatarUrl ? (
    <img
      src={player.avatarUrl}
      alt={player.name}
      className="rounded-full object-cover shrink-0"
      style={{
        width: size,
        height: size,
        border: '1.5px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.3)',
      }}
    />
  ) : (
    <span
      className="rounded-full flex items-center justify-center shrink-0 font-bold"
      style={{
        width: size, height: size,
        background: 'linear-gradient(135deg, #1c2330, #252d3a)',
        border: '1.5px solid #2a3344',
        fontSize: Math.floor(size * 0.44),
        color: '#64748b',
        letterSpacing: '0.02em',
      }}
    >
      {player.name?.[0]?.toUpperCase()}
    </span>
  )
}
