// Animated fire icon shown next to players on a win streak of 3+
export default function FireIcon({ size = 13 }) {
  return (
    <span
      className="fire-icon"
      style={{ fontSize: size, lineHeight: 1, flexShrink: 0 }}
      aria-label="win streak"
    >
      🔥
    </span>
  )
}
