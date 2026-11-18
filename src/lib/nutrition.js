// Macro estimation from ingredient lines (Dutch + English).
// Values per 100 g (or 100 ml): kcal, protein, carbs, fat. Approximate, NEVO/USDA-style averages.
// opts: piece = grams per piece, pack = grams per pack/bag, can = drained grams per tin,
//       density = g per ml (default 1), el = grams per tablespoon (overrides 15 ml × density)

const T = [
  // Meat substitutes (before generic words like "kip", "burger")
  ['vega(?:tarische)?\\s*kip(?:stukjes|reepjes|blokjes)?|kipstukjes|chick.?n pieces|plant.?based chicken', 175, 22, 4, 7, { pack: 160 }],
  ['vega(?:tarische)?\\s*gehakt|vegan mince|plant.?based mince|gehakt', 190, 18, 6, 10, { pack: 200 }],
  ['schnitzel', 230, 14, 17, 11, { piece: 90 }],
  ['vega(?:tarische)?\\s*garnalen|vegan shrimp', 95, 8, 9, 2.5, { pack: 160 }],
  ['vega(?:tarische)?\\s*(?:worst|worstjes)|vegan sausage', 230, 15, 6, 16, { piece: 60 }],
  ['(?:vega\\w*|vegan)\\s*spekjes', 230, 14, 10, 15, { pack: 150 }],
  ['burger', 230, 15, 10, 14, { piece: 100 }],
  ['tofu', 120, 13, 1.5, 7, { pack: 375, piece: 375 }],
  ['tempeh', 195, 19, 9, 11, { pack: 200, piece: 200 }],
  ['seitan', 140, 25, 6, 2, { pack: 200 }],
  ['falafel', 330, 13, 32, 18, { piece: 20 }],

  // Dairy & eggs
  ['eieren|eitjes|\\bei\\b|eggs?\\b|eidooiers?|egg yolks?', 140, 12.5, 0.7, 10, { piece: 55 }],
  ['kokosmelk light|light kokosmelk|light coconut milk', 75, 0.8, 2, 7, { can: 400 }],
  ['kokosmelk|coconut milk|kokosroom|coconut cream', 190, 1.8, 3, 19, { can: 400 }],
  ['havermelk|oat milk|haverdrink', 45, 0.6, 6.5, 1.5],
  ['sojamelk|soy milk|sojadrink', 40, 3.5, 1.5, 1.8],
  ['amandelmelk|almond milk|amandeldrink', 15, 0.5, 0.5, 1.1],
  ['volle melk|whole milk', 63, 3.3, 4.6, 3.5],
  ['melk|milk', 46, 3.4, 4.8, 1.5],
  ['kookroom|cooking cream', 180, 2.5, 4, 17],
  ['light cr[eè]me fra[iî]che|cr[eè]me fra[iî]che light', 160, 3, 4, 15, { el: 15 }],
  ['cr[eè]me fra[iî]che', 290, 2.4, 3, 30, { el: 15 }],
  ['zure room|sour cream', 190, 2.7, 3.5, 19, { el: 15 }],
  ['slagroom|room\\b|cream\\b|double cream|heavy cream', 340, 2, 3, 35],
  ['roomkaas|cream cheese|philadelphia', 250, 6, 4, 23, { el: 15 }],
  ['cottage cheese|h[uü]ttenk[aä]se', 100, 11, 3, 4.5],
  ['magere kwark|low.?fat quark|skyr', 60, 11.5, 3.8, 0.2],
  ['kwark|quark', 95, 9, 3.5, 5],
  ['griekse yoghurt|greek yogh?urt', 120, 4, 3.5, 10],
  ['magere yoghurt', 36, 4, 4, 0.1],
  ['yoghurt|yogurt', 50, 4, 4.5, 1.5],
  ['mascarpone', 430, 5, 4, 44],
  ['ricotta', 150, 9, 3, 11],
  ['burrata', 300, 15, 2, 26, { piece: 125 }],
  ['mozzarella', 250, 18, 2, 19, { piece: 125, pack: 125 }],
  ['halloumi', 320, 22, 2, 25, { pack: 225, piece: 225 }],
  ['feta', 260, 15, 1, 21, { pack: 200 }],
  ['geitenkaas|goat.?s? cheese', 300, 18, 1, 24],
  ['parmezaan|parmigiano|parmesan|grana padano|pecorino', 400, 35, 0, 28, { el: 6 }],
  ['kaas|cheese|cheddar|gouda|gruy[eè]re|emmentaler', 380, 25, 0, 31, { piece: 20, el: 7 }],
  ['boter|butter|margarine|roomboter', 740, 0.7, 0.6, 82, { el: 14 }],

  // Oils & fats
  ['\\p{L}*olie|oil\\b', 900, 0, 0, 100, { density: 0.9 }],

  // Grains & starch
  ['volkoren\\s*(?:pasta|spaghetti|penne|fusilli)|wholewheat pasta', 345, 13, 63, 2.5],
  ['orzo|risoni|pasta|spaghetti|penne|macaroni|tagliatelle|fusilli|farfalle|linguine|rigatoni|lasagne|lasagna|conchiglie|paccheri', 355, 12.5, 71, 1.5],
  ['rijstnoedels|rice noodles', 360, 6, 80, 0.6],
  ['noedels|noodles|mie\\b|udon|ramen', 360, 12, 70, 3, { pack: 250 }],
  ['gnocchi', 150, 4, 32, 0.5, { pack: 500 }],
  ['zilvervliesrijst|bruine rijst|brown rice', 350, 7.5, 74, 2.5],
  ['risottorijst|arborio|basmati|jasmijnrijst|rijst|rice', 350, 7, 78, 0.6],
  ['couscous', 360, 12.5, 72, 1.5],
  ['bulgur|bulgh?ur', 345, 12, 69, 1.5],
  ['quinoa', 370, 14, 64, 6],
  ['havermout|oats|havervlokken', 370, 13, 60, 7, { el: 8 }],
  ['bladerdeeg|puff pastry', 400, 6, 35, 26, { piece: 45 }],
  ['filodeeg|filo', 300, 8, 60, 3, { piece: 20 }],
  ['pizzadeeg|pizza dough', 250, 8, 48, 3, { pack: 400 }],
  ['tortilla|wraps?\\b', 300, 8.5, 50, 7, { piece: 60 }],
  ['pita|pitabroodjes?', 270, 9, 55, 1.2, { piece: 70 }],
  ['naan', 290, 9, 50, 6, { piece: 90 }],
  ['panko|paneermeel|breadcrumbs', 380, 12, 75, 3, { el: 8 }],
  ['volkorenbrood|volkoren brood', 240, 10, 40, 3.5, { piece: 35 }],
  ['brood|bread|stokbrood|ciabatta|bolletjes?|baguette|zuurdesem', 260, 9, 48, 3, { piece: 35 }],
  ['bloem|meel|flour', 350, 10, 73, 1.2, { el: 10 }],
  ['maizena|ma[iï]zena|cornstarch|cornflour|zetmeel', 360, 0.3, 88, 0.1, { el: 8 }],
  ['zoete aardappel|sweet potato', 86, 1.6, 20, 0.1, { piece: 250 }],
  ['aardappel|krieltjes|potato', 80, 2, 17, 0.1, { piece: 150 }],

  // Legumes & tins
  ['linzen uit blik|blik linzen|canned lentils', 90, 7, 13, 0.5, { can: 265 }],
  ['linzen|lentils', 330, 24, 50, 1.5],
  ['kikkererwten|chickpeas|garbanzo', 120, 7, 15, 2.5, { can: 240 }],
  ['kidneybonen|kidney beans|zwarte bonen|black beans|witte bonen|cannellini|bruine bonen|borlotti|butter beans|boterbonen|bonenmix', 100, 7, 14, 0.5, { can: 240 }],
  ['edamame', 120, 11, 9, 5],
  ['sperziebonen|haricots|green beans', 31, 1.8, 7, 0.2],
  ['doperwten|erwten|peas', 80, 5.4, 14, 0.4],
  ['tomatenpuree|tomato paste|tomato pur[eé]e', 85, 4.3, 15, 0.5, { el: 16, can: 70 }],
  ['gepelde tomaten|tomatenblokjes|tomaten uit blik|chopped tomatoes|canned tomatoes|passata|tomatensaus|tomato sauce|polpa', 25, 1.2, 4, 0.2, { can: 400, pack: 500 }],
  ['zongedroogde tomaten|sun.?dried tomato', 210, 5, 23, 14, { piece: 6 }],
  ['ma[iï]s\\b|corn\\b|sweetcorn', 86, 3.3, 19, 1.4, { can: 285 }],
  ['olijven|olives', 145, 1, 4, 15, { piece: 4 }],
  ['\\p{L}*bouillon\\s*(?:blok|tablet)\\p{L}*|stock cubes?|stock tablets?', 250, 10, 20, 15, { piece: 10 }],
  ['\\p{L}*bouillon|stock|broth', 3, 0.2, 0.3, 0.1],
  ['pesto', 450, 5, 6, 45, { el: 15, pack: 190 }],
  ['ketjap', 280, 2, 68, 0, { el: 18 }],
  ['sojasaus|soy sauce|tamari', 60, 8, 6, 0.1, { el: 16 }],
  ['pindakaas|peanut butter', 600, 25, 15, 50, { el: 16 }],
  ['tahin[ia]?|tahini', 600, 18, 20, 53, { el: 15 }],
  ['honing|honey|ahornsiroop|maple syrup|agave', 305, 0.3, 82, 0, { el: 21 }],
  ['basterdsuiker|bruine suiker|suiker|sugar', 400, 0, 100, 0, { el: 12 }],
  ['mayonaise|mayo', 700, 1, 1, 76, { el: 14 }],
  ['ketchup', 110, 1.5, 25, 0.2, { el: 17 }],
  ['mosterd|mustard', 140, 7, 8, 9, { el: 15 }],
  ['currypasta|curry paste|rode curry|groene curry', 150, 3, 15, 9, { el: 16 }],
  ['sambal|sriracha|harissa|gochujang|chilisaus|chili sauce', 100, 2, 15, 3, { el: 16 }],
  ['miso', 200, 12, 26, 6, { el: 17 }],

  // Vegetables
  ['lente.?ui|bosui|spring onions?|scallions?', 30, 1.8, 6, 0.2, { piece: 15 }],
  ['sjalot|shallots?', 70, 2.5, 17, 0.1, { piece: 30 }],
  ['uien|\\bui\\b|onions?', 40, 1.1, 9, 0.1, { piece: 100 }],
  ['knoflook|garlic', 150, 6.4, 33, 0.5, { piece: 5 }],
  ['cherrytomaat|cherrytomaatjes|cherry tomato|snoeptomaat', 18, 0.9, 3.9, 0.2, { piece: 15, pack: 250 }],
  ['tomaat|tomaten|tomato', 18, 0.9, 3.9, 0.2, { piece: 100 }],
  ['paprika(?!poeder)|bell pepper|puntpaprika', 30, 1, 6, 0.3, { piece: 150 }],
  ['courgette|zucchini', 17, 1.2, 3, 0.3, { piece: 250 }],
  ['aubergine|eggplant', 25, 1, 6, 0.2, { piece: 300 }],
  ['spinazie|spinach', 23, 2.9, 3.6, 0.4, { pack: 300 }],
  ['broccoli', 34, 2.8, 7, 0.4, { piece: 400 }],
  ['bloemkool|cauliflower', 25, 1.9, 5, 0.3, { piece: 600 }],
  ['wortel|wortels|peen|carrots?', 41, 0.9, 10, 0.2, { piece: 80 }],
  ['champignons?|paddenstoelen|mushrooms?|kastanjechampignons', 22, 3.1, 3.3, 0.3, { pack: 250 }],
  ['prei|leeks?', 31, 1.5, 7, 0.3, { piece: 200 }],
  ['rucola|rocket|veldsla|sla|lettuce|ijsbergsla|spinaziemix|salad leaves', 20, 2, 3, 0.4, { pack: 75 }],
  ['komkommer|cucumber', 12, 0.6, 2, 0.1, { piece: 350 }],
  ['avocado', 160, 2, 9, 15, { piece: 150 }],
  ['pompoen|butternut|squash|pumpkin', 26, 1, 6.5, 0.1, { piece: 1000 }],
  ['boerenkool|kale', 49, 4.3, 9, 0.9, { pack: 300 }],
  ['spitskool|rode kool|witte kool|savooiekool|kool\\b|cabbage', 25, 1.3, 6, 0.1, { piece: 800 }],
  ['venkel|fennel', 31, 1.2, 7, 0.2, { piece: 250 }],
  ['selderij|bleekselderij|celery', 16, 0.7, 3, 0.2, { piece: 40 }],
  ['asperges|asparagus', 20, 2.2, 3.9, 0.1, { piece: 20 }],
  ['bietjes|biet|beetroot', 43, 1.6, 10, 0.2, { piece: 100 }],
  ['gember|ginger', 80, 1.8, 18, 0.8, { piece: 20 }],
  ['rode peper|chilipeper|chili pepper|jalape[nñ]o|peper(?:tje)?s?\\b(?=.*(?:rood|groen))', 40, 2, 9, 0.4, { piece: 10 }],
  ['citroen|lemon', 29, 1.1, 9, 0.3, { piece: 100 }],
  ['limoen|lime', 30, 0.7, 10, 0.2, { piece: 60 }],

  // Fruit
  ['banaan|bananen|bananas?', 89, 1.1, 23, 0.3, { piece: 120 }],
  ['appel|apples?', 52, 0.3, 14, 0.2, { piece: 180 }],
  ['frambozen|bessen|blauwe bessen|aardbeien|berries|raspberries|strawberries|blueberries|rood fruit', 40, 1, 8, 0.4, { pack: 150 }],
  ['mango', 60, 0.8, 15, 0.4, { piece: 300 }],
  ['dadels|dates', 280, 2.5, 75, 0.4, { piece: 8 }],
  ['rozijnen|raisins|cranberries', 300, 3, 79, 0.5],

  // Nuts & seeds
  ['walnoten|walnuts|pecannoten|pecans', 650, 15, 14, 65],
  ['amandelen|almonds', 580, 21, 22, 50],
  ['cashewnoten|cashews?', 580, 18, 30, 44],
  ['pijnboompitten|pine nuts', 670, 14, 13, 68, { el: 9 }],
  ['pinda|pindas|pinda\'s|peanuts', 590, 26, 16, 49],
  ['sesamzaad|sesam|sesame', 570, 18, 23, 50, { el: 9 }],
  ['chiazaad|chia', 490, 17, 42, 31, { el: 12 }],
  ['lijnzaad|flaxseed|linseed', 534, 18, 29, 42, { el: 10 }],
  ['zonnebloempitten|pompoenpitten|sunflower seeds|pumpkin seeds', 580, 24, 15, 49, { el: 9 }],
  ['kokosrasp|desiccated coconut', 660, 6, 24, 62, { el: 6 }],
  ['pure chocolade|chocolade|chocolate', 550, 8, 46, 38],
  ['cacao|cocoa', 230, 20, 58, 14, { el: 7 }],

  // Negligible: count as matched, zero macros
  ['zout|salt|peper\\b|pepper\\b|paprikapoeder|gerookte paprika|smoked paprika|komijn|cumin|kerrie|curry powder|garam masala|kaneel|cinnamon|oregano|tijm|thyme|rozemarijn|rosemary|basilicum|basil|peterselie|parsley|koriander|coriander|munt|mint|bieslook|chives|dille|dill|chilivlokken|chili flakes|cayenne|nootmuskaat|nutmeg|kurkuma|turmeric|laurier|bay lea|bakpoeder|baking powder|baking soda|gist|yeast|vanille|vanilla|azijn|vinegar|water|ijsblokjes|kruiden|italiaanse kruiden|herbs|spices|specerijen|ras el hanout|za.?atar|sumak|knoflookpoeder|uienpoeder|limoensap|citroensap|lemon juice|lime juice|rasp|zest', 0, 0, 0, 0],
];

const TABLE = T.map(([re, kcal, p, c, f, o = {}]) => ({ re: new RegExp(`(?:^|[^\\p{L}])(?:${re})`, 'iu'), kcal, p, c, f, ...o }));

const FRAC = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
const WORDNUM = { een: 1, één: 1, a: 1, an: 1, one: 1, half: 0.5, halve: 0.5, twee: 2, two: 2, drie: 3, three: 3, vier: 4, four: 4, vijf: 5, five: 5, zes: 6, six: 6 };

function parseQty(s) {
  s = s.trim();
  let m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (m) return [+m[1] + m[2] / m[3], s.slice(m[0].length)];
  m = s.match(/^(\d*)\s*([½¼¾⅓⅔])/);
  if (m) return [(+m[1] || 0) + FRAC[m[2]], s.slice(m[0].length)];
  m = s.match(/^(\d+)\s*\/\s*(\d+)/);
  if (m) return [m[1] / m[2], s.slice(m[0].length)];
  m = s.match(/^(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?/);
  if (m) {
    const a = parseFloat(m[1].replace(',', '.')), b = m[2] ? parseFloat(m[2].replace(',', '.')) : a;
    return [(a + b) / 2, s.slice(m[0].length)];
  }
  m = s.match(/^([a-zé]+)\s/i);
  if (m && WORDNUM[m[1].toLowerCase()] != null) return [WORDNUM[m[1].toLowerCase()], s.slice(m[0].length)];
  return [null, s];
}

const UNITS = [
  [/^(lbs?|pounds?)\b\.?/i, 'lb'], [/^(oz|ounces?)\b\.?/i, 'oz'], [/^(pints?)\b/i, 'pint'],
  [/^(kg|kilo(?:gram)?)\b/i, 'kg'], [/^(g|gr|gram|grams)\b\.?/i, 'g'], [/^(mg)\b/i, 'mg'],
  [/^(l|liter|litre)\b/i, 'l'], [/^(dl|deciliter)\b/i, 'dl'], [/^(cl)\b/i, 'cl'], [/^(ml|milliliter)\b/i, 'ml'],
  [/^(el|eetlepels?|eetl\.?|tbsp|tablespoons?|tbs)\b\.?/i, 'el'], [/^(tl|theelepels?|theel\.?|tsp|teaspoons?)\b\.?/i, 'tl'],
  [/^(kopjes?|cups?)\b/i, 'cup'], [/^(blik(?:je|jes|ken)?|cans?|tins?)\b/i, 'can'],
  [/^(pak(?:je|jes|ken)?|packs?|bakjes?|zak(?:je|jes|ken)?|bags?|netjes?|potjes?|pots?|jars?)\b/i, 'pack'],
  [/^(snuf(?:je)?|pinch|mespunt(?:je)?)\b/i, 'pinch'], [/^(handje|handjes|handvol|handful)\b/i, 'handful'],
  [/^(tenen|teentjes?|teen|cloves?)\b/i, 'piece'], [/^(stuks?|pieces?|st\.)\b/i, 'piece'],
  [/^(plakjes?|plakken|slices?)\b/i, 'slice'], [/^(bos(?:je|jes)?|bunch(?:es)?)\b/i, 'bunch'], [/^(scheut(?:je)?|splash|dash)\b/i, 'splash'],
];

/** Estimate one ingredient line. Returns { grams, kcal, p, c, f } or null when not recognised. */
export function estimateLine(line) {
  const clean = line.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const entry = TABLE.find((e) => e.re.test(clean));
  if (!entry) return null;
  if (!entry.kcal) return { grams: 0, kcal: 0, p: 0, c: 0, f: 0 };
  let [qty, rest] = parseQty(clean);
  rest = rest.trim();
  let unit = null;
  for (const [re, u] of UNITS) { const m = rest.match(re); if (m) { unit = u; break; } }
  const density = entry.density || 1;
  const spoon = entry.el || 15 * density;
  if (qty == null) qty = unit ? 1 : null;
  if (qty == null) return null; // "olijfolie" without amount: can't tell
  const grams = {
    kg: qty * 1000, g: qty, mg: qty / 1000, lb: qty * 453.6, oz: qty * 28.35, pint: qty * 300,
    l: qty * 1000 * density, dl: qty * 100 * density, cl: qty * 10 * density, ml: qty * density,
    el: qty * spoon, tl: qty * spoon / 3, cup: qty * 240 * density,
    can: qty * (entry.can || 240), pack: qty * (entry.pack || entry.piece || 200),
    pinch: qty * 0.5, handful: qty * 30, slice: qty * (entry.piece && entry.piece < 60 ? entry.piece : 20),
    bunch: qty * 30, splash: qty * 10 * density,
    piece: qty * (entry.piece || 100),
  }[unit] ?? (entry.piece ? qty * entry.piece : qty > 20 ? qty : null); // bare "300 orzo" → grams
  if (grams == null) return null;
  const k = grams / 100;
  return { grams, kcal: entry.kcal * k, p: entry.p * k, c: entry.c * k, f: entry.f * k };
}

/** Per-serving estimate for a recipe. */
export function estimateMacros(ingredients = [], servings = 2) {
  let kcal = 0, p = 0, c = 0, f = 0, matched = 0;
  for (const line of ingredients) {
    const e = estimateLine(line);
    if (!e) continue;
    matched++; kcal += e.kcal; p += e.p; c += e.c; f += e.f;
  }
  const s = Math.max(1, servings || 2);
  return {
    kcal: Math.round(kcal / s), protein: Math.round(p / s), carbs: Math.round(c / s), fat: Math.round(f / s),
    matched, total: ingredients.length, source: 'estimate',
  };
}

/** Macros to show for a recipe: stored (site/manual) first, otherwise estimated. */
export function macrosOf(r) {
  if (r?.macros && r.macros.kcal > 0) return r.macros;
  if (!r?.ingredients?.length) return null;
  const e = estimateMacros(r.ingredients, r.servings);
  return e.matched && e.kcal > 0 ? e : null;
}
