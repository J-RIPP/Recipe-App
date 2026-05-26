# Changelog

All notable changes to Our Recipes are documented here.  
Format: `## [version] — YYYY-MM-DD`

---

## [1.4.0] — 2026-05-26

### Full audit update — all 7 departments

**Bug fixes**
- Fixed `olive oil` incorrectly categorised as Tins & Jars (now correctly Pantry)
- Fixed servings scaler to integer steps only (was allowing 0.5 increments)
- Fixed cook mode crash when recipe has 0 steps
- Fixed past days in planner still showing Add button (now read-only)

**Design**
- Fixed old orange colour (`#e07b4a`) on active category/day buttons — now correct forest green
- Fixed shopping checkbox border (was unbranded `#444`)
- Added "Nothing planned for tonight" nudge on library home when today is empty
- Improved empty shopping list state with illustration and "Go to planner" shortcut
- Updated Add tab icon from ➕ to 📝

**Engineering**
- `useMemo` for `rollingDays` and `todayKey` — no longer recalculates on every render
- `weekStart` now auto-updates if app is left open overnight or across a week boundary
- Lazy loading (`loading="lazy"`) on all recipe images
- `outline: none` replaced with `focus-visible` only — keyboard focus rings restored

**Security**
- PIN remember-me for 7 days per device using localStorage with expiry
- PIN clears on connection error / retry

**Features**
- ⚡ Quick Add mode — just title and ingredients, add steps later via Edit
- 🆘 Help / onboarding screen on first visit, always accessible via `?` button
- Progress bar in cook mode showing % through steps
- `aria-label` on all icon buttons, `aria-pressed` on filters, `lang="en"` on HTML tag
- Minimum 44×44px touch targets on all interactive elements

**Tests**
- Added `buildShopGroups` test suite (4 tests)
- Added `getSortedRecipes` test suite (3 tests)
- Added `olive oil vs olives` grouping tests
- Added `0-steps cook mode` safety test
- Total: 52 tests (up from 26)

---

## [1.3.0] — 2026-05-26

### Multi-department improvements

**Bugs fixed**
- Detail header now sticky — ♥, Edit, Delete always visible while scrolling
- Delete button colour changed to red (was green — looked like a positive action)
- Unfavourited heart now visible (was near-invisible on dark background)
- Recipe detail page scrolls correctly on Android
- Cook log now shows formatted dates (e.g. "Mon 25 May") instead of raw ISO strings

**Features**
- Multiple JSON file upload — select several files at once
- Photo upload in edit form via imgbb (requires API key — see README)

---

## [1.2.0] — 2026-05-25

### Reliability + daily friction round

**Bugs fixed**
- Shopping ticks now saved to Supabase (was memory-only, reset on every visit)
- Fixed shopping tick delete query (ingredient encoding issue)
- Fixed file input not resetting after JSON upload (same file couldn't be re-uploaded)
- Error handling added to all Supabase calls with user-facing messages
- Connection timeout (10s) with error screen and retry button

**Features**
- Custom shopping items — add anything to the list (stored locally per device)
- Cook log — "Mark as cooked" on today's planner entry, recent history on library screen
- PWA manifest and service worker — installable to home screen
- Shopping list ticked items now sink to bottom of their group
- "Clear all" button on shopping list clears both ticks and custom items

---

## [1.1.0] — 2026-05-24

### Full feature audit

**Bugs fixed**
- `getMonday()` timezone bug — date strings now parsed with `T12:00:00` to avoid UTC shift
- Shopping list week filter was using wrong Monday reference
- `assignDay` was passing wrong type to `getMonday`

**Features**
- Rolling 15-day planner (7 days back, today, 7 days forward) with real dates
- Today highlighted in planner with orange border and TODAY label
- Past days dimmed in planner
- Recipe picker overlay with search when assigning to planner
- Favourites — heart button, filter in library, badge on cards
- Star ratings (1–5) on recipes
- Personal notes per recipe
- Servings scaler (scale ingredients up/down)
- Sort recipes by newest / A-Z / rating
- Prep + cook time fields
- "Tonight's Dinner" banner on library home
- Shopping list grouped by category (Frozen, Produce, Meat & Fish, Dairy, etc.)
- Ticked items sink to bottom of group
- Copy last week's plan button
- Days planned shown on recipe cards
- Delete confirmation dialog

**Tests added**
- `buildShopGroups` (basic, skips past, deduplicates, null recipes)
- `getSortedRecipes` (az, rating, newest)
- `formatCookDate`
- Total: 26 tests

---

## [1.0.0] — 2026-05-23

### Initial release

- Recipe library with search and category filter
- Add recipe via manual form or JSON upload
- Week planner (Mon–Sun)
- Shopping list (deduplicated ingredients)
- Cook mode (step-by-step)
- Supabase backend
- Shared PIN access
- DataIsCool branding (forest green theme)
- Hosted on Vercel

---

*Semantic versioning: MAJOR.MINOR.PATCH*  
*MAJOR = breaking change, MINOR = new feature, PATCH = bug fix*
