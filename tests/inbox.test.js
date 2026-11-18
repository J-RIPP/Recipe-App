import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captionFromHtml, cleanOcr } from '../src/lib/inbox.js';
import { parseRecipeText } from '../src/lib/parse.js';

test('Instagram caption from link preview', () => {
  const html = `<meta property="og:description" content="1,234 likes, 56 comments - foodieholly on November 2, 2025: &quot;Romige pasta 🍝&#10;Ingrediënten:&#10;- 200 g pasta&#10;- 1 ui&#10;Bereiding:&#10;1. Kook de pasta.&#10;2. Meng alles.&quot;. " />`;
  const cap = captionFromHtml(html);
  assert.match(cap, /^Romige pasta/);
  const r = parseRecipeText(cap);
  assert.deepEqual(r.ingredients, ['200 g pasta', '1 ui']);
  assert.equal(r.steps.length, 2);
});

test('screenshot text is cleaned of phone chrome', () => {
  const ocr = '9:41\n87%\nfoodieholly\nVolgen\nRomige pasta\n1.234\nIngrediënten:\n200 g pasta\nBereiding:\nKook de pasta tot hij gaar is.\n';
  const r = parseRecipeText(cleanOcr(ocr));
  assert.equal(r.title, 'Romige pasta');
  assert.deepEqual(r.ingredients, ['200 g pasta']);
  assert.ok(!cleanOcr(ocr).includes('9:41'));
  assert.ok(!cleanOcr(ocr).includes('Volgen'));
});
