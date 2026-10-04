# Sunday Football — Claude Code Context

## Project Overview

A mobile-first React web app for tracking a Sunday 7-a-side football group. Players, match history, stats, and Man of the Match awards are all tracked here. Data lives in Supabase; the app is deployed to GitHub Pages.

Live: `https://ohaye.github.io/sunday-football/`

---

## Tech Stack

- **Frontend**: React 19, React Router v7 (HashRouter), Vite 7
- **Database**: Supabase (Postgres + Storage)
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite`), dark theme, mobile-first (max-width 512px)
- **Fonts**: Oswald (headings, buttons, labels), Teko (numerals), Barlow (body) — loaded from Google Fonts in `index.html`
- **Charts**: Recharts (horizontal bar chart on Stats page — lazy-loaded with that page)
- **Deploy**: GitHub Pages via `gh-pages`

---

## Commands

```bash
npm run dev       # Start dev server
npm run build     # Production build (outputs to dist/)
npm run deploy    # Build + push to gh-pages branch
npm run lint      # ESLint — must stay at zero errors
```

Base path is `/sunday-football/` (set in `vite.config.js`) — required for GitHub Pages.

There are no tests. Verify changes with `npm run lint`, `npm run build`, and by looking at the page.
The dev server talks to the **live** Supabase project: loading pages is read-only, but anything you tap that saves is a real write.

---

## File Structure

```
src/
├── App.jsx                   # Router shell, lazy routes, load-error banner
├── index.css                 # Design system: @theme tokens + component classes
├── context/
│   ├── AppContext.jsx        # AppProvider: all state, CRUD, vote ops, stats getters
│   └── app-context.js        # Context object + useApp() hook
├── lib/
│   ├── supabase.js           # Supabase client (hardcoded public anon key — no .env needed)
│   ├── constants.js          # Thresholds, BREAK, positions, team colours, win colours
│   ├── format.js             # Dates (toYMD, fmtDate, getNextMatchday…), pct, plural, slugify
│   ├── stats.js              # Pure stat helpers: outcomeFor, tally, streaksFrom, computeH2H, formatOf
│   ├── balance.js            # Team balancer algorithm
│   ├── parseTeams.js         # Parses a pasted WhatsApp teams message and matches names to players
│   ├── share.js              # WhatsApp message builders + openers
│   ├── weather.js            # Open-Meteo match-day weather
│   └── avatar.js             # Avatar resize + upload to Supabase Storage
├── data/
│   ├── historicalSessions.js # 67 matches Oct 2024–Feb 2026 (lazy: seeding/import only)
│   └── seedPlayers.js        # initialPlayers + migratePlayers (lazy: seeding/fallback only)
├── components/
│   ├── ui.jsx                # PageHeader, Loading, Section, EmptyState, StatTile, Segmented, Pills,
│   │                         #   PositionTag, WinPill, FormDots, RecordBar, RecordChips
│   ├── icons.jsx             # Line icon set
│   ├── Sheet.jsx             # Bottom-sheet modal (portal)
│   ├── Feedback.jsx          # FeedbackProvider: toasts + confirm dialogs
│   ├── feedback-context.js   # useFeedback() hook
│   ├── BottomNav.jsx         # Floating dock: Home, Games, Teams (raised centre), Stats, Squad
│   ├── MatchFace.jsx         # Team A · scoreboard · Team B (Home + Games)
│   ├── PlayerAvatar.jsx      # Shared avatar (photo or initial)
│   ├── FireIcon.jsx / FrostIcon.jsx
│   ├── match/                # MatchCard, MatchForm, PitchBuilder, TeamBuilder, PasteTeamsSheet, ScoreStepper, formations.js
│   └── squad/PlayerSheets.jsx# AddPlayerSheet, EditPlayerSheet, AvatarSheet
└── pages/
    ├── Dashboard.jsx         # Home: next match, last result, season tiles, leaders, streaks
    ├── Lineups.jsx           # Games list (upcoming first, results by season, paginated)
    ├── MatchEditor.jsx       # /lineups/new and /lineups/:id/edit → MatchForm
    ├── Balancer.jsx          # Teams: pick who's in → balanced sides → create/update match
    ├── Stats.jsx             # Leaderboard, win-rate chart, MOTM table, head to head
    ├── Players.jsx           # Squad: search, position filter, player cards
    ├── PlayerProfile.jsx     # Record, form, nemesis/favourite opponent, head to head
    ├── Vote.jsx              # Public device-based MOTM ballot
    └── Admin.jsx             # PIN pad + legacy stats editor, historical import, PIN change
```

### Routes

`/` · `/lineups` · `/lineups/new` · `/lineups/:id/edit` · `/balance` · `/stats` · `/players` · `/player/:id` · `/admin` · `/vote/:sessionId`. Unknown paths redirect to `/`.
The bottom nav is hidden on `/admin`, `/vote/*` and the match editor (`/lineups/*`).

---

## Supabase Schema

| Table | Key columns |
|-------|-------------|
| `players` | `id` (text PK, e.g. `h-omar`), `data` (jsonb — full player object) |
| `sessions` | `id` (uuid), `date`, `player_ids`, `teams`, `result`, `motm` (text[]), `report`, `weather`, `written_by`, `created_at` |
| `settings` | `key` (PK), `value` — stores `admin_pin` |
| `vote_sessions` | `session_id` (PK), `date` (display text), `players`, `score_label` |
| `motm_votes` | `session_id`, `device_id`, `voted_for` |

**Storage:** `player-avatars` bucket — public, one file per player ID.

No RLS is configured (trusted team app, no auth). The admin PIN and avatar PINs are checked in the browser, so they deter accidents, not attackers.

---

## Data Model

### Player
```js
{
  id: 'h-omar',              // h-{name slug}; a few older players have UUID ids
  name: 'Omar',
  position: 'MID',          // 'GK' | 'DEF' | 'MID' | 'FWD'
  number: null,              // shirt number or null
  createdAt: '2023-01-01T00:00:00.000Z',
  avatarUrl: null,           // Supabase Storage public URL or null
  avatarPin: null,           // 4-digit PIN protecting the avatar (non-admin users)
  injured: false,            // hidden from the team picker while true
  aliases: ['Shehzad'],      // other spellings seen in pasted WhatsApp messages (optional)

  // Legacy stats (pre-Supabase, from WhatsApp match records). May be negative (correction offsets).
  legacyMotm: 22,            // all-time MOTM count
  legacyMotm2024: 7, legacyMotm2025: 4, legacyMotm2026: 1,
  legacyPlayed: 38, legacyWins: 19, legacyLosses: 19, legacyDraws: 0,
  legacyPlayed2024: 8, legacyWins2024: 5, legacyLosses2024: 3, // …same for 2025, 2026
  estimated: true,
}
```

### Session
```js
{
  id: 'uuid',
  date: '2025-03-16',        // YYYY-MM-DD (local time)
  playerIds: ['h-omar', ...],
  teams: { teamA: [...], teamB: [...], format: 7 },   // format 7 | 9 (inferred from sizes if absent); null if no lineup
  result: { scoreA: 3, scoreB: 2, scoreKnown: true, goals: {} },
                             // scoreKnown false = winner known, score not recorded (shown as W / L)
                             // null = not played yet / no result
  motm: ['h-omar'],          // string[] (joint awards allowed) or null
  report: 'text' | null,
  writtenBy: 'h-shez' | null,
  weather: { code, tempC, windKph } | null,
  createdAt: '2025-03-16T...',
}
```

---

## Key Architectural Decisions

### Context API (`useApp()`)
- Data: `players`, `playerById` (Map), `sessions` (visible, newest first, includes upcoming), `playedSessions` (counts towards stats), `sessionsLoaded`, `loadError`, `reload`
- Writes: `addPlayer`, `updatePlayer`, `removePlayer`, `saveMatch`, `updateSession`, `removeSession`, `importHistoricalSessions`, `publishVote`, `changePin`
- Reads: `getPlayerStats`, `getMotmCount`, `getStreaks`, `getAttendance`, `getVoteCounts`, `firePlayerIds`, `frostPlayerIds`
- Every write goes to Supabase first and only updates local state on success. Creators return the record or `null`; updaters return `true`/`false`. **Callers must check the result and show a toast on failure.**
- The stat getters are memoised (`useCallback`) — safe to use as hook dependencies.

### Stats Computation
- `sessions` excludes 2024 (data is inaccurate); all 2024 numbers come from legacy fields only.
- `playedSessions` also excludes **upcoming fixtures** (no result, dated today or later) so a planned lineup doesn't count as a game and a loss. A past session with no result still counts as played (legacy behaviour the calibrated totals rely on).
- Year filter: sessions in that year + `legacyPlayed{year}` / `legacyWins{year}`; losses = played − wins − draws.
- All time: sessions + all-time and per-year (2025, 2026) legacy fields.
- Win/draw/loss logic lives in one place: `outcomeFor(session, playerId)` in `lib/stats.js`. Don't re-implement it.

### Home Tab (Dashboard) — Current Season Only
Everything on the Dashboard must reflect the **current calendar year only**: season tiles (matches, players, goals), the leaders card (MOTM, win rate, reliable) and streaks. Use `currentYear()` from `lib/format.js`.

### Games workflow
- Upcoming matches are pinned under "Up next"; results are grouped by season and paginated.
- Everyday jobs are inline on the match card: enter score, award MOTM (shows the vote tally with "Use vote"), share vote link, write report, share teams, add weather.
- Lineup changes and **delete** live in the match editor (edit button), behind a confirm sheet.
- Editing preserves `result.goals` and the `scoreKnown: false` flag unless the score itself changes.

### Paste teams from WhatsApp
The match editor has a "Paste teams from WhatsApp" button (`PasteTeamsSheet`). `parseTeamsMessage` in `lib/parseTeams.js` finds the last `… V …` line (or two blocks split by a lone "v"), splits it into names (multi-word names are recognised from the squad, aliases and the message's numbered sign-up list; a lone letter joins the name before it) and matches each to a player: exact name or alias → `exact`; one clear fuzzy match → `guess` (shown amber for checking); otherwise `unknown` (user picks or leaves out). Confirmed guesses and manual picks are saved to the player's `aliases`, so they match exactly next time. The parser is pure — test it with Node against sample messages.

### Team balancer
Rating = all-time win % (50 for players under `MIN_RATED_GAMES`). `balanceTeams` gives equal-sized sides and swaps pairs to minimise the average gap; Shuffle adds jitter. Saving creates a match, or replaces the lineup of an unplayed match already on that date.

### Pitch Builder
Free placement on a 3:4 pitch: tap a player then tap the pitch, or drag. Top half = Team A, bottom = Team B. Starting layouts come from `formations.js` (7-a-side 1-2-3-1, 9-a-side 1-3-3-2). Positions are not persisted — only team membership. Mounted with `key={format}` so a format switch re-lays out. Bench tokens use `touch-action: pan-x` (swipe scrolls the bench, dragging up carries a player).

### Admin System
- PIN stored in `settings` (`key = 'admin_pin'`); unlocked via 7 taps on the "Sunday FC" title on Home, or the lock button on Squad.
- `isAdmin` persists for the browser tab (sessionStorage `sf_admin`).
- Admin-only: add/edit/remove players, injured flag, reset avatar PINs, legacy stats, historical import, PIN change.
- Match editing is open to everyone (trusted group).

### Avatar PIN System
Non-admin players update their own photo via a 4-digit PIN they set themselves (`data.avatarPin`). Photos are cropped square and downscaled to 384px JPEG before upload.

### MOTM Voting
- "Vote link" on a match card upserts a `vote_sessions` row (`publishVote`) and opens WhatsApp with `/vote/:sessionId`.
- Votes go to `motm_votes` keyed by a `device_id` in `localStorage`; one vote per device, confirmed with a second tap, results shown after voting.
- The MOTM picker on the match card shows the tally and can apply the winner(s).

### Regular vs Occasional Players
`REGULAR_THRESHOLD = 10` all-time games (`lib/constants.js`). Regulars are listed first on Squad and Teams; the rest are collapsed.

### Player IDs
New players get `h-{slug of name}` (numeric suffix on collision). Two Usmans: `h-usmana` (original) and `h-usmang`. The old bare `h-usman` is remapped to `h-usmana` on load.

---

## Design System ("floodlit matchday")

- **Palette** (tokens in `index.css` `@theme`): `pitch #0b0f14`, `surface #141920`, `raised #1c2330`, `line #252d3a`, `green #16a34a`. Semantic: blue = Team B, gold = MOTM, amber = upcoming/warnings, red = losses/danger. **Don't introduce new base colours.**
- Use token utilities (`bg-surface`, `border-line`, `text-mist`, `text-green-bright`) rather than raw hex. Hex is only for dynamic inline styles, SVG and Recharts — take it from `lib/constants.js`.
- Text greys: `ink` → `soft` → `mist` → `muted` → `faint`. `ghost` is decorative only (too dim for text).
- **Component classes**: `.card`, `.card-head`, `.inset`, `.btn` (+ `-primary`, `-quiet`, `-ghost`, `-danger`, `-whatsapp`, `-sm`, `-lg`, `-block`), `.field`, `.field-label`, `.chip` (+ colours), `.pill`, `.seg`, `.scorebox`, `.display`, `.eyebrow`, `.kicker`, `.num`.
- **Type**: `.display` (Oswald caps) for names and titles, `.num` (Teko) for every statistic, `.eyebrow` for card labels.
- Touch targets ≥ 40px; inputs use `.field` (16px text, so iOS doesn't zoom).
- Motion: `.stagger` on a page's card stack, `.hero-enter` on headers. `prefers-reduced-motion` is respected globally.
- Modals: always `<Sheet>` (portal). Never `window.alert/confirm` — use `useFeedback()` → `toast()` / `confirm()`.

---

## Coding Conventions

- All data operations go through `AppContext`. Only three places touch Supabase directly: `AppContext.jsx`, `lib/avatar.js`, and `Vote.jsx` (the standalone public page).
- `sessionsLoaded` gates every page — render `<Loading />` until true.
- Reuse `components/ui.jsx`, `MatchFace`, `PlayerAvatar` and the `lib/` helpers; don't copy them into pages.
- Files exporting components must export only components (hooks/constants go in a sibling `.js` file) — required by the fast-refresh lint rule.
- Dates: use `lib/format.js` (`todayYMD`, `fmtDate`). Never `new Date().toISOString().slice(0, 10)` — that's UTC and is wrong around midnight in BST.

---

## Ramadan / Seasonal Breaks

`BREAK` in `src/lib/constants.js` (`{ until: 'YYYY-MM-DD', label }`). While today is before `until`, the Home countdown targets that date and shows the label. Leave a past date when there's no break.

---

## Deployment Notes

- `npm run deploy` builds and pushes `dist/` to the `gh-pages` branch; live within ~1 minute.
- HashRouter is used to avoid 404s on GitHub Pages (no server-side routing).
- A snapshot of the code before the October 2026 redesign is kept at the git ref `refs/backup/pre-redesign`.
