# 🍽️ Our Recipes — DataIsCool

A shared recipe app for two people. Plan weekly dinners, generate shopping lists, and cook step-by-step — all synced in real time.

**Live app:** [project-o4np8.vercel.app](https://project-o4np8.vercel.app)  
**Tests:** [project-o4np8.vercel.app/tests.html](https://project-o4np8.vercel.app/tests.html)

---

## Features

| Feature | Description |
|---|---|
| 📚 Recipe Library | Browse, search, filter by category, sort by newest/A-Z/rating |
| ⭐ Ratings & Notes | Rate recipes 1–5 stars, add personal notes |
| ♥ Favourites | Heart recipes, filter library to favourites only |
| 📅 Rolling Planner | 15-day rolling calendar (7 back, today, 7 forward) with real dates |
| 🛒 Shopping List | Auto-generated from plan, grouped by category, synced for both users |
| 🍳 Cook Mode | Step-by-step cooking with progress bar, ingredient list alongside |
| ⚖️ Servings Scaler | Scale ingredient quantities up or down per recipe |
| 📎 JSON Import | Upload one or multiple JSON recipe files at once |
| ⚡ Quick Add | Add a recipe with just a title and ingredients — add steps later |
| 🔒 PIN Access | Shared 4-digit PIN, remembered for 7 days per device |
| 📱 PWA | Installable on Android and iOS home screen |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (CDN, no build step), Babel standalone |
| Styling | Inline styles with shared design token object |
| Database | Supabase (PostgreSQL, REST API) |
| Hosting | Vercel |
| PWA | Service worker (`sw.js`) + Web App Manifest (`manifest.json`) |

---

## Database Schema

### `recipes`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| title | text | Required |
| category | text | Breakfast / Lunch / Dinner / Snack / Dessert / Other |
| source_url | text | Original recipe link |
| photo_url | text | Image URL |
| ingredients | jsonb | Array of strings |
| steps | jsonb | Array of strings |
| servings | integer | Default 2 |
| prep_time | text | e.g. "10 min" |
| cook_time | text | e.g. "30 min" |
| is_favourite | boolean | Default false |
| rating | integer | 0–5 |
| notes | text | Personal notes |
| created_at | timestamp | Auto |

### `week_plan`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| date | date | The specific calendar date |
| week_start | date | Monday of that week |
| recipe_id | uuid | FK → recipes |
| day | text | Legacy column (no longer used) |

### `shopping_ticks`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| week_start | date | Scopes ticks to a week |
| ingredient | text | Ingredient string |
| ticked | boolean | Default true |
| created_at | timestamp | Auto |

---

## How to Add Recipes

### Option 1 — Claude JSON import (recommended)
1. Paste a recipe link into this Claude chat
2. Claude fetches and formats it, gives you a `.json` file to download
3. In the app → Add → Upload from Claude JSON
4. Select one or multiple `.json` files at once

### Option 2 — Quick Add
1. App → Add → ⚡ Quick add
2. Enter title and ingredients only
3. Add steps later via Edit on the recipe

### Option 3 — Manual form
1. App → Add → Full recipe
2. Fill in all fields

---

## Project Structure

```
/
├── index.html          # Main app (React, all-in-one)
├── converter.html      # Recipe converter tool (Claude API)
├── manifest.json       # PWA manifest
├── sw.js               # Service worker (offline + caching)
├── tests.html          # Test suite (open in browser to run)
├── README.md           # This file
└── CHANGELOG.md        # Version history
```

---

## Local Development

No build step needed. Just open `index.html` in a browser — but note:

- Supabase calls require internet access
- The service worker only registers on HTTPS or localhost
- To test PWA install, use a live URL (Vercel)

---

## Deploying Updates

1. Make changes to `index.html` (and other files as needed)
2. Update `CHANGELOG.md` with what changed and bump the version
3. Bump the cache version in `sw.js` (e.g. `recipes-v4` → `recipes-v5`) so users get the update
4. Commit and push to GitHub — Vercel auto-deploys within ~60 seconds

---

## Environment / Credentials

> ⚠️ The Supabase anon key is intentionally public-facing (designed for client-side use). Row Level Security (RLS) is enabled on all tables.

| Config | Location |
|---|---|
| Supabase URL | `index.html` line ~30 |
| Supabase anon key | `index.html` line ~31 |
| PIN | `index.html` line ~32 |
| imgbb API key | `index.html` — search `YOUR_IMGBB_KEY` and replace |

---

## Running Tests

Open `tests.html` in any browser and tap **Run All Tests**. Tests cover:

- Date calculations (`getMonday`, `getRollingDays`)
- Ingredient scaling (`scaleIngredient`)
- Shopping list grouping (`getGroup`, `buildShopGroups`)
- Cook log logic
- Custom shopping items
- Sort functions

Tests must pass before every deployment.

---

## Roadmap

See `CHANGELOG.md` for what's been built. Potential next features:

- [ ] Smart ingredient quantity combining (e.g. 120g + 180g pasta = 300g)
- [ ] Recipe history / cook count tracking
- [ ] Meal suggestions based on ratings
- [ ] Recipe converter hosted independently with API key
- [ ] `recipes.dataiscool.com` custom domain (pending DNS transfer)

---

*Built with Claude — DataIsCool*
