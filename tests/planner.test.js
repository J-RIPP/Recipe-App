import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan, macroFit, mealTarget, nextDates } from '../src/lib/planner.js';
import { estimateLine, estimateMacros } from '../src/lib/nutrition.js';

const mk = (id, extra = {}) => ({ id, title: id, category: 'Dinner', ingredients: ['300 g pasta', '1 ui'], servings: 2, ...extra });
const dates = ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26'];

test('never the same recipe on consecutive days, even with only 2 recipes', () => {
  for (let seed = 1; seed < 40; seed++) {
    const { picks } = generatePlan({ recipes: [mk('a'), mk('b')], dates, gap: 1, seed });
    for (let i = 1; i < dates.length; i++) assert.notEqual(picks[dates[i]], picks[dates[i - 1]]);
  }
});

test('gap counts against what is already planned', () => {
  const { picks } = generatePlan({ recipes: [mk('a'), mk('b')], plan: { '2026-11-19': ['a'] }, dates: ['2026-11-20'], gap: 1, seed: 3 });
  assert.equal(picks['2026-11-20'], 'b');
});

test('larger gap leaves days empty when impossible, with a note', () => {
  const { picks, notes } = generatePlan({ recipes: [mk('a'), mk('b')], dates: dates.slice(0, 4), gap: 2, seed: 1 });
  assert.equal(Object.keys(picks).length, 3); // a, b, (empty), a
  assert.ok(notes.length);
});

test('enough recipes: no repeats in a week', () => {
  const recipes = 'abcdefghij'.split('').map((x) => mk(x));
  for (let seed = 1; seed < 20; seed++) {
    const { picks } = generatePlan({ recipes, dates, seed });
    assert.equal(new Set(Object.values(picks)).size, 7);
  }
});

test('category filter and swap avoid', () => {
  const recipes = [mk('a'), mk('b', { category: 'Dessert' }), mk('c')];
  const { picks } = generatePlan({ recipes, dates: ['2026-11-20'], categories: ['Dinner'], avoid: ['a'], seed: 1 });
  assert.equal(picks['2026-11-20'], 'c');
});

test('macro fit prefers on-target meals', () => {
  const t = mealTarget({ people: [{ kcal: 1832, protein: 115, carbs: 229, fat: 51 }], dinnerShare: 35 });
  assert.deepEqual(t, { kcal: 641, protein: 40, carbs: 80, fat: 18 });
  assert.ok(macroFit({ kcal: 640, protein: 42, fat: 15 }, t) > macroFit({ kcal: 900, protein: 15, fat: 50 }, t));
});

test('ingredient estimates', () => {
  assert.equal(Math.round(estimateLine('300 g orzo').kcal), 1065);
  assert.equal(Math.round(estimateLine('2 el olijfolie').f), 27);
  assert.equal(estimateLine('1 groentebouillonblokje').grams, 10);
  assert.equal(estimateLine('250 g vegetarische kipstukjes (in plaats van kip)').p, 55);
  assert.equal(estimateLine('olijfolie'), null);
  assert.equal(estimateLine('zout en peper').kcal, 0);
  const m = estimateMacros(['300 g orzo', '1 ui', '250 g vegetarische kipstukjes'], 3);
  assert.equal(m.matched, 3);
  assert.equal(nextDates(new Date(2026, 10, 20), 2)[1], '2026-11-21');
});

import { stepMinutes } from '../src/lib/util.js';
test('timer durations found in steps', () => {
  assert.equal(stepMinutes('Laat 10 minuten sudderen.'), 10);
  assert.equal(stepMinutes('Bak 20-25 min in de oven'), 25);
  assert.equal(stepMinutes('Simmer for 1 hour'), 60);
  assert.equal(stepMinutes('Voeg 2 uien toe'), null);
  assert.equal(stepMinutes('Bake for 15 minutes until golden'), 15);
});
