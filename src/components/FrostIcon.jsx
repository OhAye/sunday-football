// Animated frost icon shown next to players on a loss streak
export default function FrostIcon({ size = 13 }) {
  return (
    <span
      className="frost-icon"
      style={{ fontSize: size, lineHeight: 1, flexShrink: 0 }}
      aria-label="loss streak"
    >
      ❄️
    </span>
  )
}
