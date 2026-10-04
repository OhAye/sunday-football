// Animated snowflake shown next to players on a losing streak of 3+
export default function FrostIcon({ size = 13 }) {
  return (
    <span className="frost-icon shrink-0" style={{ fontSize: size, lineHeight: 1 }} role="img" aria-label="on a losing streak">
      ❄️
    </span>
  )
}
