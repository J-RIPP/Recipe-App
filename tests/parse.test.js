import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecipeHtml, parseRecipeText, scaleIngredient, meatWarnings, isoDuration, normalizeImported } from '../src/lib/parse.js';
import { shopGroup } from '../src/lib/util.js';
import { parseConfigSnippet } from '../src/lib/db.js';

const html = `<html><head><meta property="og:image" content="https://x/og.jpg">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Recipe",
"name":"Romige orzo met spinazie &amp; feta","image":["https://x/1.jpg","https://x/2.jpg"],"recipeYield":["4","4 personen"],
"prepTime":"PT10M","totalTime":"PT1H5M","recipeCategory":["Hoofdgerecht"],"recipeIngredient":["300 gram orzo","1 ui"],
"recipeInstructions":[{"@type":"HowToSection","name":"Saus","itemListElement":[{"@type":"HowToStep","text":"Snipper de <b>ui</b>."}]},
{"@type":"HowToStep","text":"Serveer."}]}]}</script></head></html>`;

test('JSON-LD recipe from a page', () => {
  const r = parseRecipeHtml(html, 'https://kookmutsjes.com/x');
  assert.equal(r.title, 'Romige orzo met spinazie & feta');
  assert.deepEqual(r.ingredients, ['300 gram orzo', '1 ui']);
  assert.deepEqual(r.steps, ['Snipper de ui.', 'Serveer.']);
  assert.equal(r.servings, 4);
  assert.equal(r.prep_time, '10 min');
  assert.equal(r.cook_time, '1 u 5 min');
  assert.equal(r.category, 'Dinner');
});

test('page without recipe data falls back to title + photo', () => {
  const r = parseRecipeHtml('<title>Lekker</title><meta property="og:image" content="https://x/a.jpg">', 'https://a');
  assert.equal(r.partial, true);
  assert.equal(r.photo_url, 'https://x/a.jpg');
});

test('Instagram-style caption with headers', () => {
  const r = parseRecipeText(`Makkelijke pasta pesto 🌿
Super snel klaar!
Ingrediënten (2 personen):
- 200 g pasta
- ½ courgette
Bereiding:
1. Kook de pasta.
2. Meng met pesto.
#pasta #vega`);
  assert.equal(r.title, 'Makkelijke pasta pesto 🌿');
  assert.deepEqual(r.ingredients, ['200 g pasta', '½ courgette']);
  assert.deepEqual(r.steps, ['Kook de pasta.', 'Meng met pesto.']);
});

test('caption without headers', () => {
  const r = parseRecipeText('Overnight oats\n50 g havermout\n100 ml melk\nMeng alles in een pot en zet een nacht in de koelkast.');
  assert.deepEqual(r.ingredients, ['50 g havermout', '100 ml melk']);
  assert.equal(r.steps.length, 1);
  assert.equal(r.category, 'Breakfast');
});

test('servings scaling', () => {
  assert.equal(scaleIngredient('200 g pasta', 1.5), '300 g pasta');
  assert.equal(scaleIngredient('½ courgette', 2), '1 courgette');
  assert.equal(scaleIngredient('1 1/2 tl zout', 2), '3 tl zout');
  assert.equal(scaleIngredient('1,5 dl room', 2), '3 dl room');
  assert.equal(scaleIngredient('snufje zout', 2), 'snufje zout');
});

test('meat warning ignores vegetarian swaps', () => {
  assert.deepEqual(meatWarnings(['200 g kipfilet', 'vegetarische kipstukjes', '250 g vegetarische garnalen', 'groentebouillon']), ['200 g kipfilet']);
});

test('old JSON format still imports', () => {
  const r = normalizeImported({ title: 'Test', ingredients: ['a'], steps: 'one\ntwo', photo_url: 'https://p' });
  assert.deepEqual(r.steps, ['one', 'two']);
  assert.equal(normalizeImported({ ingredients: [] }), null);
});

test('shopping groups', () => {
  assert.equal(shopGroup('2 uien'), 'Fruit & veg');
  assert.equal(shopGroup('1 groentebouillonblokje'), 'Tins & jars');
  assert.equal(shopGroup('vegetarische kipstukjes'), 'Meat substitutes');
  assert.equal(shopGroup('2 el olijfolie'), 'Herbs & pantry');
});

test('Firebase config snippet parsing', () => {
  const cfg = parseConfigSnippet(`const firebaseConfig = {
    apiKey: "AIzaXYZ", authDomain: "r.firebaseapp.com", projectId: "our-recipes",
    storageBucket: "r.appspot.com", messagingSenderId: "123", appId: "1:123:web:abc" };`);
  assert.equal(cfg.projectId, 'our-recipes');
  assert.equal(parseConfigSnippet('nonsense'), null);
  assert.equal(isoDuration('PT45M'), '45 min');
});

test('blog without recipe data (Wix-style headings and lists)', () => {
  const html = `<html><head><meta property="og:title" content="Roasted Cherry Tomato Bisque Pasta"><meta property="og:image" content="https://static.wixstatic.com/x.jpg">
  <script type="application/ld+json">{"@type":"BlogPosting","headline":"Roasted"}</script></head><body>
  <h1>Roasted Cherry Tomato Bisque Pasta</h1>
  <p><span><strong>Total Time:</strong> 1 hour</span></p><p><span><strong>Serving Size:</strong> 2-4 servings</span></p>
  <p><em>Penne pasta tossed in a creamy sauce.</em><a href="https://x.com"><img src="a.png"/>Try Artisan Pasta</a></p>
  <h2><span>Ingredients:</span></h2>
  <ul><li><p><span>1/2 lb. penne or other short pasta</span><a href="https://shop"><span><img src="b.png"/></span>Try Artisan Pasta</a></p></li>
  <li><p><span>2 pints cherry tomatoes, halved</span></p></li>
  <li><p><span>2 tbsp. <a href="https://link.amazon/x">tomato paste</a></span></p></li></ul>
  <h2><span>Directions:</span></h2>
  <ol><li><p>Heat the oven to 375°F. Roast for 30-40 minutes.</p></li><li><p>Blend until smooth.</p></li></ol>
  <p>Affiliate disclosure: I may earn a commission.</p><h1>Recent Posts</h1></body></html>`;
  const r = parseRecipeHtml(html, 'https://www.thepastatable.com/post/x');
  assert.equal(r.title, 'Roasted Cherry Tomato Bisque Pasta');
  assert.equal(r.photo_url, 'https://static.wixstatic.com/x.jpg');
  assert.deepEqual(r.ingredients, ['1/2 lb. penne or other short pasta', '2 pints cherry tomatoes, halved', '2 tbsp. tomato paste']);
  assert.deepEqual(r.steps, ['Heat the oven to 375°F. Roast for 30-40 minutes.', 'Blend until smooth.']);
  assert.equal(r.servings, 2);
  assert.equal(r.cook_time, '1 hour');
  assert.equal(r.partial, undefined);
});
