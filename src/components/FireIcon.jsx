// Animated fire shown next to players on a win streak of 3+
export default function FireIcon({ size = 13 }) {
  return (
    <span className="fire-icon shrink-0" style={{ fontSize: size, lineHeight: 1 }} role="img" aria-label="on a win streak">
      🔥
    </span>
  )
}
