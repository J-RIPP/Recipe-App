// Week plan generator: picks a recipe per day.
// Hard rule: the same recipe needs at least `gap` free days between two plannings (also against what's
// already in the planner). Soft preferences: variety, ratings/favourites and how well the macros fit.
import { macrosOf } from './nutrition.js';
import { ymd, addDays, dayLabel, dateShort } from './util.js';
import { t } from './i18n.js';

export const DEFAULT_TARGETS = {
  people: [{ name: 'Me', kcal: 2000, protein: 100, carbs: 250, fat: 65 }],
  dinnerShare: 35,
};

/** Per-meal target for one person: their daily target × the share of the day this meal gets. */
export function mealTarget(targets, personIdx = 0) {
  const t = targets?.people?.[personIdx] || DEFAULT_TARGETS.people[0];
  const s = (targets?.dinnerShare ?? DEFAULT_TARGETS.dinnerShare) / 100;
  return { kcal: Math.round(t.kcal * s), protein: Math.round(t.protein * s), carbs: Math.round(t.carbs * s), fat: Math.round(t.fat * s) };
}

/** 0..1, how well one serving fits the meal target. Protein short and fat over count, overshooting protein doesn't. */
export function macroFit(m, t) {
  if (!m || !t?.kcal) return null;
  const kcalDev = Math.abs(m.kcal - t.kcal) / t.kcal;
  const protShort = t.protein ? Math.max(0, t.protein - m.protein) / t.protein : 0;
  const fatOver = t.fat ? Math.max(0, m.fat - t.fat) / t.fat : 0;
  return Math.max(0, Math.min(1, 1 - 1.5 * (0.45 * kcalDev + 0.4 * protShort + 0.15 * fatOver)));
}

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const daysBetween = (a, b) => Math.round((new Date(a + 'T12:00') - new Date(b + 'T12:00')) / 864e5);

/**
 * @param {object} o
 * @param {Array} o.recipes          all recipes
 * @param {Object} o.plan            existing planner { 'YYYY-MM-DD': [ids] }
 * @param {string[]} o.dates         dates to fill
 * @param {number} o.gap             min free days between two of the same recipe (1 = not two days in a row)
 * @param {string[]} o.categories    allowed categories (empty = all)
 * @param {'balanced'|'favourites'|'protein'|'variety'} o.prefer
 * @param {object|null} o.target     per-meal macro target
 * @param {Object} [o.fixed]         dates already chosen in this proposal that must be kept { date: id }
 * @param {string[]} [o.avoid]       recipe ids to leave out (used when swapping one day)
 * @param {number} [o.seed]
 * @returns {{ picks: Object, notes: string[] }}
 */
export function generatePlan({ recipes, plan = {}, dates, gap = 1, categories = [], prefer = 'balanced', target = null, fixed = {}, avoid = [], seed = Date.now() }) {
  const rand = rng(seed);
  let pool = recipes.filter((r) => (!categories.length || categories.includes(r.category)) && !avoid.includes(r.id));
  const notes = [];
  if (!pool.length) { pool = recipes; if (recipes.length) notes.push(t('No recipes in the chosen categories, so all recipes were used.')); }

  const picks = { ...fixed };
  // Everything already planned (outside the dates we're filling) counts for spacing and variety
  const taken = [];
  Object.entries(plan).forEach(([d, ids]) => { if (!dates.includes(d)) ids.forEach((id) => taken.push([d, id])); });
  const occupied = () => [...taken, ...Object.entries(picks).map(([d, id]) => [d, id])];

  const w = {
    balanced: { rating: 0.7, fav: 0.4, macro: 1.5, jitter: 0.6 },
    favourites: { rating: 1.2, fav: 1.4, macro: 0.5, jitter: 0.5 },
    protein: { rating: 0.5, fav: 0.2, macro: 1.0, protein: 1.6, jitter: 0.5 },
    variety: { rating: 0.3, fav: 0.1, macro: 0.4, jitter: 1.4 },
  }[prefer] || {};

  const macroCache = new Map(pool.map((r) => [r.id, macrosOf(r)]));

  for (const date of dates) {
    if (picks[date]) continue;
    const occ = occupied();
    const scored = [];
    for (const r of pool) {
      // hard rule: at least `gap` free days between the same recipe
      if (occ.some(([d, id]) => id === r.id && Math.abs(daysBetween(d, date)) <= gap)) continue;
      let s = 0;
      s += ((r.rating || 2.5) / 5) * w.rating;
      if (r.is_favourite) s += w.fav;
      const m = macroCache.get(r.id);
      const fit = macroFit(m, target);
      s += (fit == null ? 0.45 : fit) * w.macro;
      if (w.protein && m?.kcal) s += Math.min(1, (m.protein * 4) / m.kcal / 0.3) * w.protein; // protein share of calories, 30% = max
      const uses = occ.filter(([, id]) => id === r.id);
      const inThisPlan = Object.values(picks).filter((id) => id === r.id).length;
      s -= inThisPlan * 2.2;                                                  // strongly prefer something new this week
      s -= uses.filter(([d]) => Math.abs(daysBetween(d, date)) <= 10).length * 0.7; // eaten recently
      s += rand() * w.jitter;
      scored.push([s, r.id]);
    }
    if (!scored.length) { notes.push(t('No recipe fits on {day} without repeating too soon.', { day: `${dayLabel(date).toLowerCase()} ${dateShort(date)}` })); continue; }
    scored.sort((a, b) => b[0] - a[0]);
    picks[date] = scored[0][1];
  }
  return { picks, notes };
}

export function nextDates(start, n) {
  return Array.from({ length: n }, (_, i) => ymd(addDays(start, i)));
}

export function summarize(picks, byId) {
  const ms = Object.values(picks).map((id) => macrosOf(byId[id])).filter(Boolean);
  if (!ms.length) return null;
  const avg = (k) => Math.round(ms.reduce((a, m) => a + (m[k] || 0), 0) / ms.length);
  return { kcal: avg('kcal'), protein: avg('protein'), carbs: avg('carbs'), fat: avg('fat'), counted: ms.length };
}
