import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { t } from './i18n.js';

export const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Other'];

// ── Dates ───────────────────────────────────────────────────────────────────
export const ymd = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const today = () => { const x = new Date(); x.setHours(0, 0, 0, 0); return x; };
const toDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) : new Date(d));
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dayLabel(d) {
  d = toDate(d);
  const diff = Math.round((new Date(d) - today()) / 864e5);
  if (diff === 0) return t('Today');
  if (diff === 1) return t('Tomorrow');
  if (diff === -1) return t('Yesterday');
  return t(DAY[d.getDay()]);
}
export const dateShort = (d) => `${toDate(d).getDate()} ${t(MON[toDate(d).getMonth()])}`;

// ── Fetch a web page (native HTTP in the app avoids CORS) ───────────────────
export async function fetchPage(url) {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({
      url,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'nl,en;q=0.8',
      },
      responseType: 'text',
      connectTimeout: 15000,
      readTimeout: 20000,
    });
    if (res.status >= 400) throw new Error(t('The site answered {n}', { n: res.status }));
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(t('The site answered {n}', { n: res.status }));
  return res.text();
}

export const extractUrl = (text) => text.match(/https?:\/\/[^\s"'<>]+/)?.[0] || '';

// ── Images: shrink before storing so sync stays fast ────────────────────────
export function compressImage(file, max = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('Could not read that image'))); };
    img.src = url;
  });
}

// ── Shopping list grouping (Dutch + English keywords) ───────────────────────
const GROUPS = [
  ['Meat substitutes', 'vega|vegetarisch|vleesvervanger|vivera|tofu|tempeh|seitan|beyond|quorn|kipstukjes|schnitzel|burger|gehakt|garnalen|falafel'],
  ['Fruit & veg', 'ui|uien|onion|knoflook|garlic|tomaat|tomaten|tomato|paprika|pepper|wortel|carrot|aardappel|potato|krieltjes|sla|lettuce|spinazie|spinach|rucola|rocket|avocado|citroen|lemon|limoen|lime|komkommer|cucumber|champignon|mushroom|courgette|broccoli|bloemkool|cauliflower|koriander|coriander|peterselie|parsley|basilicum|basil|munt|mint|bieslook|gember|ginger|lente-?ui|spring onion|prei|leek|selder|celery|aubergine|pompoen|pumpkin|zoete aardappel|sweet potato|mais|corn|erwt|peas|boon|boontjes|beans|appel|apple|banaan|banana|bes|berries|aardbei|strawberr|mango|ananas|pineapple|sinaasappel|orange|kool|cabbage|boerenkool|kale|radijs|biet|beet|venkel|fennel|asperge|asparagus|peen|chili|rode peper|jalape|tijm|thyme|rozemarijn|rosemary|dille|dill'],
  ['Dairy & eggs', 'ei\\b|eieren|egg|melk|milk|room|cream|boter|butter|kaas|cheese|parmezaan|parmesan|feta|mozzarella|yoghurt|yogurt|kwark|brie|ricotta|cheddar|geitenkaas|crème fraîche|creme fraiche|mascarpone|halloumi|burrata|skyr|zuivel'],
  ['Pasta, rice & bread', 'pasta|spaghetti|penne|macaroni|tagliatelle|lasagne|rijst|rice|noedel|noodle|orzo|gnocchi|quinoa|couscous|bulgur|brood|bread|bloem|flour|haver|oat|tortilla|wrap|pita|naan|bladerdeeg|puff pastry|deeg|crackers|panko|paneermeel'],
  ['Tins & jars', 'groentebouillon|bouillonblok|blik|tin\\b|canned|gepelde tomaten|passata|tomatenpuree|tomato paste|bouillon|stock|saus|sauce|mayo|ketchup|mosterd|mustard|azijn|vinegar|jam|honing|honey|siroop|syrup|soja|soy|harissa|miso|tahin|pesto|sriracha|sambal|kokosmelk|coconut milk|kikkererwt|chickpea|linzen|lentil|kidneybonen|olijven|olives|kappertjes|capers|pindakaas|peanut butter|curry'],
  ['Herbs & pantry', 'olijfolie|zonnebloemolie|olie|oil|zout|salt|peper\\b|kruiden|spice|komijn|cumin|kurkuma|turmeric|kaneel|cinnamon|suiker|sugar|maizena|cornflour|bakpoeder|baking|oregano|nootmuskaat|nutmeg|chilivlokken|chili flakes|knoflookpoeder|paprikapoeder|gerookt|smoked|garam|ras el hanout|vanille|vanilla|cacao|cocoa|chocola|noten|nuts|walnoot|amandel|almond|cashew|pijnboom|pine nut|sesam|sesame|zaden|seeds|rozijn'],
  ['Frozen', 'diepvries|frozen|bevroren'],
];
const GROUP_RE = GROUPS.map(([g, k]) => [g, new RegExp(`(?:^|[^\\p{L}])(${k})`, 'iu')]);
export function shopGroup(text) {
  for (const [g, re] of GROUP_RE) if (re.test(text)) return g;
  return 'Other';
}
export const SHOP_ORDER = [...GROUPS.map((g) => g[0]), 'Other'];

export function hashKey(s) {
  let h = 5381;
  const t = s.toLowerCase().replace(/\s+/g, ' ').trim();
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return 't' + (h >>> 0).toString(36);
}
