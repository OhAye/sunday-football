# Sunday Football — Claude Code Context

## Project Overview

A mobile-first React web app for tracking a Sunday 7-a-side football group. Players, match history, stats, and Man of the Match awards are all tracked here. Data lives in Supabase; the app is deployed to GitHub Pages.

Live: `https://ohaye.github.io/sunday-football/`

---

## Tech Stack

- **Frontend**: React 19, React Router v7 (HashRouter), Vite 7
- **Database**: Supabase (Postgres + Storage)
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite`), dark theme, mobile-first (max-width 480px)
- **Font**: Oswald (headings), system sans-serif (body)
- **Charts**: Recharts (horizontal bar chart on Stats page)
- **Deploy**: GitHub Pages via `gh-pages`

---

## Commands

```bash
npm run dev       # Start dev server
npm run build     # Production build (outputs to dist/)
npm run deploy    # Build + push to gh-pages branch
npm run lint      # ESLint
```

Base path is `/sunday-football/` (set in `vite.config.js`) — required for GitHub Pages.

---

## File Structure

```
src/
├── components/
│   ├── BottomNav.jsx         # Bottom nav tabs (Home, Games, Stats, Players)
│   └── PlayerAvatar.jsx      # Shared avatar component (photo or initial circle)
├── context/
│   └── AppContext.jsx        # All state, CRUD, and stats logic
├── data/
│   └── historicalSessions.js # 67 matches Oct 2024–Feb 2026 (seeded to Supabase on first run)
├── hooks/
│   └── useLocalStorage.js    # Unused in production (kept from pre-Supabase era)
├── lib/
│   └── supabase.js           # Supabase client (hardcoded public anon key — no .env needed)
├── pages/
│   ├── Admin.jsx             # PIN-protected admin: legacy stats editor, historical import, PIN change
│   ├── Dashboard.jsx         # Countdown, last result, MOTM/win-rate leaders
│   ├── Lineups.jsx           # Match creation/editing with pitch builder
│   ├── Players.jsx           # Squad management (position board, avatar upload)
│   ├── Stats.jsx             # Leaderboard, win-rate chart, MOTM rankings
│   └── Vote.jsx              # Device-based MOTM voting page
└── App.jsx                   # Router shell — hides BottomNav on /admin and /vote/:id
```

---

## Supabase Schema

**Tables:**

| Table | Key columns |
|-------|-------------|
| `players` | `id` (text PK, e.g. `h-omar`), `data` (jsonb — full player object) |
| `sessions` | `id` (uuid), `date`, `player_ids`, `teams`, `result`, `motm`, `created_at` |
| `settings` | `key` (PK), `value` — stores `admin_pin` |
| `vote_sessions` | `session_id` (PK), `date`, `players`, `score_label` |
| `motm_votes` | `session_id`, `device_id`, `voted_for` |

**Storage:** `player-avatars` bucket — public, avatars uploaded by player ID.

No RLS is configured (trusted team app, no auth).

---

## Data Model

### Player
```js
{
  id: 'h-omar',              // kebab-case, prefixed 'h-'
  name: 'Omar',
  position: 'MID',          // 'GK' | 'DEF' | 'MID' | 'FWD'
  number: null,              // shirt number or null
  createdAt: '2023-01-01T00:00:00.000Z',
  avatarUrl: null,           // Supabase Storage public URL or null
  avatarPin: null,           // 4-digit PIN protecting the avatar (non-admin users)
  injured: false,

  // Legacy stats (pre-Supabase, from WhatsApp match records)
  legacyMotm: 22,            // all-time MOTM count
  legacyMotm2024: 7,         // per-year MOTM
  legacyMotm2025: 4,
  legacyMotm2026: 1,
  legacyPlayed: 38,          // all-time P/W/L (zeroed once sessions are fully imported)
  legacyWins: 19,
  legacyLosses: 19,
  legacyDraws: 0,
  legacyPlayed2024: 8,       // per-year P/W/L
  legacyWins2024: 5,
  legacyLosses2024: 3,
  // ...same for 2025, 2026
  estimated: true,           // true = derived from match reports, not verified
}
```

### Session
```js
{
  id: 'uuid',
  date: '2025-03-16',        // YYYY-MM-DD
  playerIds: ['h-omar', ...],
  teams: {
    teamA: ['h-omar', 'h-tommy'],
    teamB: ['h-jonny', 'h-ranj'],
  },                         // null if no lineup assigned
  result: {
    scoreA: 3,
    scoreB: 2,
    scoreKnown: true,        // false = winner/loser known but exact score not recorded
    goals: { 'h-omar': 2 }, // goals per player (may be empty)
  },                         // null if match not completed
  motm: 'h-omar',            // null until awarded
  createdAt: '2025-03-16T...',
}
```

---

## Key Architectural Decisions

### Stats Computation (`AppContext.getPlayerStats`)
- Iterates `visibleSessions` (2024 excluded — data is inaccurate)
- For **year filter**: `sessions × year + legacyPlayed{year}` / `legacyWins{year}`
- For **all time**: sessions (2025+) + sum of all per-year legacy fields
- `getMotmCount` works similarly — sums session awards + `legacyMotm{year}`

### Home Tab (Dashboard) — Current Season Only
All stats and leader cards on the Dashboard (`Dashboard.jsx`) must always reflect the **current calendar year only** — never all-time or a prior season. This applies to:
- MOTM leader
- Win rate leader
- Most Reliable (attendance) leader
- Any future leader cards added to the home screen

Use `currentYear = new Date().getFullYear().toString()` and pass it to `getPlayerStats`, `getMotmCount`, and `getAttendance`. Streaks (`getStreaks`) are inherently current-season by design.

### 2024 Data Exclusion
Sessions from 2024 exist in Supabase but are filtered out everywhere:
```js
const visibleSessions = sessions.filter((s) => !s.date?.startsWith('2024'))
```
The Stats page also hides the 2024 season tab. All 2024 numbers come from legacy fields only.

### Admin System
- PIN stored in `settings` table (`key = 'admin_pin'`)
- Unlocked via 7-tap easter egg on the "Sunday" title on Dashboard
- `isAdmin` lives in context; persists for the browser session
- Admin-only: add players, edit legacy stats, delete players, drag position, reset avatar PINs, import historical sessions, change PIN

### Avatar PIN System
Non-admin players can update their own photo via a 4-digit PIN they set themselves. Admin can reset PINs. The PIN is stored in the player's `data.avatarPin` field in Supabase.

### MOTM Voting
- A shareable `/vote/:sessionId` link is created from the Lineups page
- `vote_sessions` row is upserted to Supabase when the vote link is shared
- Votes are recorded in `motm_votes` keyed by `device_id` (stored in `localStorage`)
- One vote per device per session (no user accounts)

### Regular vs Non-Regular Players
Players with **10+ all-time games** are "Regular" (shown first on Players page). Below 10 = "Non-Regular" (collapsed by default). Threshold is `REGULAR_THRESHOLD = 10` in `Players.jsx`.

### Pitch Builder
Uses a 1-2-3-1 formation layout. Slots mapped by percentage coordinates on a `3:4` aspect-ratio container. Players are placed by tap-to-select then tap-a-slot interaction (not drag-and-drop).

### Player IDs
All player IDs follow `h-{firstname}` convention. Two Usmans are disambiguated as `h-usmana` (Usman A, original) and `h-usmang` (Usman G, joined later). The old bare `h-usman` ID is remapped to `h-usmana` during Supabase loading.

---

## Coding Conventions

- All state and data operations go through `AppContext` — never call Supabase directly from pages except for avatar uploads (`Players.jsx`) and vote upserts (`Lineups.jsx`).
- `sessionsLoaded` (true when both players and sessions have loaded from Supabase) gates all pages — show a loading spinner until true.
- Async CRUD functions (`addPlayer`, `updateSession`, etc.) update Supabase first, then update local state only on success.
- Shared UI: `PlayerAvatar` is in `src/components/` — don't copy it into page files.
- Colors: Use the dark theme palette (`#0b0f14` bg, `#141920` surface, `#1c2330` raised, `#16a34a` green accent). Don't introduce new base colors.

---

## Ramadan / Seasonal Breaks

Dashboard has a `BREAK_UNTIL` constant (top of file) that can be set to skip ahead to a return date instead of showing the next Sunday. Set it to a past date (or remove the logic) when there's no break.

---

## Deployment Notes

- `npm run deploy` builds and pushes the `dist/` folder to the `gh-pages` branch.
- GitHub Pages serves from the `gh-pages` branch root.
- HashRouter is used specifically to avoid 404s on GitHub Pages (no server-side routing).
- After deploy, changes are live at `https://ohaye.github.io/sunday-football/` within ~1 minute.
