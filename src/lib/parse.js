// Recipe parsing: schema.org JSON-LD from web pages, and free text (Instagram/TikTok captions, notes).

const decode = (s) => {
  if (typeof s !== 'string') return '';
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#8217;|&rsquo;/g, "'")
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?)])/g, '$1')
    .trim();
};

export function isoDuration(v) {
  if (!v || typeof v !== 'string') return '';
  const m = v.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return decode(v);
  const mins = (+(m[1] || 0)) * 1440 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
  if (!mins) return '';
  const h = Math.floor(mins / 60), mm = mins % 60;
  return h ? `${h} u${mm ? ` ${mm} min` : ''}` : `${mm} min`;
}

function findRecipeNode(node) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const n of node) { const r = findRecipeNode(n); if (r) return r; }
    return null;
  }
  if (typeof node !== 'object') return null;
  const t = node['@type'];
  if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return node;
  if (node['@graph']) return findRecipeNode(node['@graph']);
  if (node.mainEntity) return findRecipeNode(node.mainEntity);
  return null;
}

function flattenInstructions(ins) {
  const out = [];
  const walk = (x) => {
    if (!x) return;
    if (typeof x === 'string') {
      // Some sites put all steps in one string separated by newlines
      x.split(/\n+/).map(decode).filter(Boolean).forEach((s) => out.push(s));
    } else if (Array.isArray(x)) x.forEach(walk);
    else if (typeof x === 'object') {
      if (x.itemListElement) walk(x.itemListElement);
      else if (x.text) out.push(decode(x.text));
      else if (x.name) out.push(decode(x.name));
    }
  };
  walk(ins);
  return out.map((s) => s.replace(/^(stap|step)\s*\d+[:.)-]?\s*/i, '').replace(/^\d+[.)]\s+/, '')).filter(Boolean);
}

function pickImage(img) {
  if (!img) return '';
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) return pickImage(img[img.length > 1 ? img.length - 1 : 0]) || pickImage(img[0]);
  return img.url || img.contentUrl || '';
}

function parseYield(y) {
  if (Array.isArray(y)) y = y[0];
  const m = String(y ?? '').match(/\d+/);
  return m ? Math.min(+m[0], 50) : null;
}

const CAT_MAP = [
  [/ontbijt|breakfast|brunch|oats|havermout|granola|pannenkoek|pancake|smoothie/i, 'Breakfast'],
  [/lunch/i, 'Lunch'],
  [/dessert|toetje|nagerecht|taart|cake|koek|gebak|baking/i, 'Dessert'],
  [/snack|borrel|tussendoor|appetizer|voorgerecht/i, 'Snack'],
  [/diner|dinner|hoofdgerecht|main|avondeten/i, 'Dinner'],
];

export function guessCategory(text) {
  for (const [re, cat] of CAT_MAP) if (re.test(text || '')) return cat;
  return 'Dinner';
}

function metaContent(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  return tag ? decode(tag.match(/content=["']([^"']*)["']/i)?.[1] || '') : '';
}

/** Parse a recipe from a web page's HTML. Returns a partial recipe or null. */
export function parseRecipeHtml(html, url = '') {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let node = null;
  for (const b of blocks) {
    try {
      const json = JSON.parse(b[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g, ''));
      node = findRecipeNode(json);
      if (node) break;
    } catch { /* malformed block, skip */ }
  }
  if (!node) {
    const title = metaContent(html, 'og:title') || decode(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '');
    if (!title) return null;
    return { title, photo_url: metaContent(html, 'og:image'), source_url: url, ingredients: [], steps: [], partial: true };
  }
  const cat = [node.recipeCategory, node.keywords, node.name].flat().filter(Boolean).join(' ');
  let photo = pickImage(node.image) || metaContent(html, 'og:image');
  if (photo && url && photo.startsWith('/')) { try { photo = new URL(photo, url).href; } catch { /* keep */ } }
  return {
    title: decode(node.name || ''),
    category: guessCategory(cat),
    source_url: url,
    photo_url: photo,
    ingredients: (node.recipeIngredient || node.ingredients || []).map(decode).filter(Boolean),
    steps: flattenInstructions(node.recipeInstructions),
    servings: parseYield(node.recipeYield),
    prep_time: isoDuration(node.prepTime),
    cook_time: isoDuration(node.cookTime || node.totalTime),
  };
}

const ING_HDR = /^(?:[^\p{L}\d]*)(ingredi[eë]nten|ingredients?|wat heb je nodig|benodigdheden|boodschappen|je hebt nodig|you(?:'ll)? need)\b/iu;
const STEP_HDR = /^(?:[^\p{L}\d]*)(bereiding(?:swijze)?|instructies|instructions|method|methode|steps|stappen|werkwijze|zo maak je( het)?|aan de slag|directions|preparation|how to make( it)?)\b/iu;
const BULLET = /^\s*(?:[-•*·▪️✔️✅👉➡️🔸🔹]|\p{Extended_Pictographic})+\s*/u;
const NUMBERED = /^\s*(?:(?:stap|step)\s*)?\d{1,2}\s*[.):-]\s+/i;
const QTY_START = /^\s*(?:\d|½|¼|¾|⅓|⅔|een |snuf|scheutje|handje|handvol|blik|pak|zakje|teen|tenen|el |tl |a pinch|pinch)/i;
const HASHTAGS = /(^|\s)#[\p{L}\d_]+/gu;

/** Parse free text (caption, note) into a recipe. */
export function parseRecipeText(raw) {
  const lines = raw
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(HASHTAGS, '').trim())
    .filter((l) => l && !/^(link in bio|volg|follow|save|bewaar|tag)\b/i.test(l));
  if (!lines.length) return null;

  let title = '';
  const ingredients = [], steps = [];
  let mode = null;
  let hasHeaders = lines.some((l) => ING_HDR.test(l)) || lines.some((l) => STEP_HDR.test(l));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (ING_HDR.test(line)) {
      mode = 'ing';
      let rest = line.replace(ING_HDR, '');
      rest = (rest.includes(':') ? rest.slice(rest.lastIndexOf(':') + 1) : '').trim();
      if (rest.length > 2 && /\d/.test(rest)) ingredients.push(...rest.split(/,\s*/));
      continue;
    }
    if (STEP_HDR.test(line)) { mode = 'step'; continue; }
    const clean = line.replace(BULLET, '').trim();
    if (!clean) continue;
    if (!title && !mode) { title = clean.replace(/[:!]+$/, ''); continue; }
    if (hasHeaders) {
      if (mode === 'ing') ingredients.push(clean);
      else if (mode === 'step') steps.push(clean.replace(NUMBERED, ''));
      // text before any header (intro) is ignored
    } else {
      if (NUMBERED.test(line) && line.length > 25) steps.push(line.replace(NUMBERED, ''));
      else if (QTY_START.test(clean) || (BULLET.test(line) && clean.length < 60)) ingredients.push(clean);
      else if (clean.length > 40) steps.push(clean);
      else ingredients.push(clean);
    }
  }
  return { title, ingredients, steps, category: guessCategory(raw) };
}

// ── Old JSON format (Claude-made files / old app export) ──────────────────────
export function normalizeImported(r) {
  if (!r || typeof r !== 'object') return null;
  const arr = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n') : []).map((s) => String(s).trim()).filter(Boolean);
  const title = String(r.title || r.name || '').trim();
  if (!title) return null;
  return {
    title,
    category: r.category || guessCategory(title),
    source_url: r.source_url || r.url || '',
    photo_url: r.photo_url || r.image || '',
    ingredients: arr(r.ingredients),
    steps: arr(r.steps || r.instructions),
    servings: +r.servings || 2,
    prep_time: r.prep_time || '',
    cook_time: r.cook_time || '',
    rating: +r.rating || 0,
    is_favourite: !!r.is_favourite,
    notes: r.notes || '',
  };
}

// ── Servings scaling ──────────────────────────────────────────────────────────
const FRAC = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
const fmt = (n) => {
  if (n >= 10) return String(Math.round(n));
  const r = Math.round(n * 4) / 4;
  const whole = Math.floor(r), f = r - whole;
  const fs = f === 0.25 ? '¼' : f === 0.5 ? '½' : f === 0.75 ? '¾' : '';
  if (!fs) return String(Math.round(n * 10) / 10).replace('.', ',');
  return whole ? `${whole}${fs}` : fs;
};

export function scaleIngredient(text, factor) {
  if (factor === 1) return text;
  const re = /^(\s*)(\d+\s+\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?|\d+\s*\/\s*\d+|\d*\s*[½¼¾⅓⅔⅛])/;
  const m = text.match(re);
  if (!m) return text;
  const tok = m[2];
  const toNum = (s) => {
    s = s.trim();
    const uni = s.match(/^(\d*)\s*([½¼¾⅓⅔⅛])$/);
    if (uni) return (+uni[1] || 0) + FRAC[uni[2]];
    const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixed) return +mixed[1] + mixed[2] / mixed[3];
    if (s.includes('/')) { const [a, b] = s.split('/').map(Number); return a / b; }
    return parseFloat(s.replace(',', '.'));
  };
  let out;
  if (/[-–]/.test(tok) && !tok.includes('/')) {
    const [a, b] = tok.split(/[-–]/);
    out = `${fmt(toNum(a) * factor)}-${fmt(toNum(b) * factor)}`;
  } else out = fmt(toNum(tok) * factor);
  return m[1] + out + text.slice(m[0].length);
}

// ── Vegetarian check ─────────────────────────────────────────────────────────
const MEAT = /\b(kip|kipfilet|kippendij|chicken|gehakt|rundergehakt|mince|beef|rund|biefstuk|steak|varken|pork|spek|spekjes|bacon|pancetta|ham|chorizo|salami|worst|sausage|lam|lamb|kalkoen|turkey|eend|duck|zalm|salmon|tonijn|tuna|vis|fish|kabeljauw|cod|garnalen|garnaal|shrimp|prawns?|ansjovis|anchov(?:y|ies)|mosselen|mussels)\b/i;
const VEG_OK = /\b(vega|vegan|vegetari|plantaardig|vleesvervanger|vivera|beyond|plant-based|veggie|quorn|tofu|tempeh|seitan|groenten?bouillon)/i;

export function meatWarnings(ingredients) {
  return ingredients.filter((i) => MEAT.test(i) && !VEG_OK.test(i));
}
