// Import inbox: things shared to the app (links, captions, screenshots) are queued on this phone,
// read in the background, and wait for a quick check before they're saved to the shared cookbook.
import { useEffect, useState } from 'react';
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { fetchPage, compressImage } from './util.js';
import { parseRecipeHtml, parseRecipeText } from './parse.js';
import { t } from './i18n.js';

const ShareInbox = registerPlugin('ShareInbox');
const KEY = 'or.inbox';
const listeners = new Set();
let items = load();
let working = false;

function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {
    // storage full: drop photos from finished items rather than losing the queue
    items = items.map((x) => (x.status === 'pending' ? x : { ...x, draft: x.draft && { ...x.draft, photoData: null } }));
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* give up */ }
  }
  listeners.forEach((fn) => fn(items));
}
const update = (id, patch) => { items = items.map((x) => (x.id === id ? { ...x, ...patch } : x)); persist(); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function useInbox() {
  const [list, setList] = useState(items);
  useEffect(() => { listeners.add(setList); return () => listeners.delete(setList); }, []);
  return list;
}
export const inboxCount = () => items.length;
export function removeItem(id) { items = items.filter((x) => x.id !== id); persist(); }
export function retryItem(id) { update(id, { status: 'pending', error: null }); work(); }

const URL_RE = /https?:\/\/[^\s"'<>]+/g;

/** Turn raw shared text into queue items: lone links become link items, captions become text items. */
function fromText(text) {
  const urls = [...new Set(text.match(URL_RE) || [])];
  const rest = text.replace(URL_RE, '').trim();
  if (rest.length > 60) return [{ kind: 'text', value: text, source: urls[0] || '' }];
  return urls.map((u) => ({ kind: 'link', value: u.replace(/[).,]+$/, '') }));
}

/** Add things to the queue. inputs: [{ kind: 'link'|'text'|'images', value?, images? }] or raw text. */
export function addToInbox(inputs) {
  const list = typeof inputs === 'string' ? fromText(inputs) : inputs.flatMap((x) => (x.kind === 'raw' ? fromText(x.value) : [x]));
  const fresh = list.filter((x) => x.kind === 'images' ? x.images?.length : x.value)
    .map((x) => ({ ...x, id: uid(), status: 'pending', at: Date.now() }));
  if (!fresh.length) return 0;
  items = [...items, ...fresh];
  persist();
  work();
  return fresh.length;
}

/** Collect anything shared to the app from other apps. Returns how many items were added. */
export async function pullShared() {
  if (!Capacitor.isNativePlatform()) return 0;
  try {
    const { items: shared = [] } = await ShareInbox.getPending();
    const inputs = [];
    for (const s of shared) {
      if (s.images?.length) inputs.push({ kind: 'images', images: s.images.map((p) => Capacitor.convertFileSrc(p)), source: (s.texts || []).join('\n').match(URL_RE)?.[0] || '' });
      else (s.texts || []).forEach((txt) => inputs.push({ kind: 'raw', value: txt }));
    }
    return addToInbox(inputs);
  } catch (e) { console.error(e); return 0; }
}
export function onShared(fn) {
  if (!Capacitor.isNativePlatform()) return () => {};
  const h = ShareInbox.addListener('shared', fn);
  return () => { h.then((x) => x.remove()); };
}

// ── Reading ─────────────────────────────────────────────────────────────────
const SOCIAL = /instagram\.com|tiktok\.com|facebook\.com|fb\.watch|youtube\.com|youtu\.be|pinterest\./i;

const decodeKeepLines = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');

function meta(html, prop) {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i'))?.[0];
  return tag ? decodeKeepLines(tag.match(/content=["']([\s\S]*?)["']\s*\/?>/i)?.[1] || tag.match(/content="([^"]*)"/i)?.[1] || '') : '';
}

export function captionFromHtml(html) {
  let caption = meta(html, 'og:description') || meta(html, 'description');
  // Instagram: '123 likes, 4 comments - user on 1 Nov 2025: "caption…"'
  const q = caption.match(/:\s*["“]([\s\S]+)["”]\s*\.?\s*$/);
  return q ? q[1] : caption;
}

/** Instagram/TikTok don't hand out captions to apps, but their link previews often contain them. */
async function readSocial(url) {
  if (!Capacitor.isNativePlatform()) throw new Error(t('Instagram and TikTok links can only be read in the Android app.'));
  const res = await CapacitorHttp.get({ url, headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'Accept-Language': 'nl,en' }, responseType: 'text', connectTimeout: 15000, readTimeout: 20000 });
  const html = typeof res.data === 'string' ? res.data : '';
  const caption = captionFromHtml(html);
  const image = meta(html, 'og:image');
  if (caption.replace(/\s/g, '').length < 60) {
    throw new Error(t("Couldn't read the caption from this post. Open it, copy the caption text and share or paste that instead."));
  }
  const r = parseRecipeText(caption);
  return { ...r, title: r.title || meta(html, 'og:title'), photo_url: image, source_url: url };
}

async function toDataUrl(src, max, quality) {
  const blob = await (await fetch(src)).blob();
  return compressImage(blob, max, quality);
}

async function readImages(images) {
  const photoData = await toDataUrl(images[0], 900, 0.72);
  if (!Capacitor.isNativePlatform()) {
    return { draft: { photoData }, error: t('Reading text from screenshots works in the Android app. Type the recipe in, with the photo above.') };
  }
  let text = '';
  for (const src of images) {
    const big = await toDataUrl(src, 1800, 0.85);
    const { text: part } = await ShareInbox.recognize({ data: big });
    text += part + '\n';
  }
  const r = parseRecipeText(cleanOcr(text));
  return { draft: { ...r, photoData } };
}

/** Drop phone/app chrome that screenshots pick up (clock, battery, like counts, buttons). */
export function cleanOcr(text) {
  const FOLLOW = /^(volgen|follow|following|gevolgd|abonneren|subscribe)$/i;
  const lines = text.split('\n');
  // the account name sits right before the Follow button
  const isHandle = (i) => { const n = lines.slice(i + 1).find((x) => x.trim()); return n && FOLLOW.test(n.trim()) && !/\s/.test(lines[i].trim()); };
  return lines.filter((l, i) => {
    if (isHandle(i)) return false;
    const s = l.trim();
    if (!s) return true;
    if (/^\d{1,2}[:.]\d{2}(\s|$)/.test(s) && s.length < 12) return false;             // status bar time
    if (/^\d+\s*%$|^[\d.,]+\s*(k|m|mln|likes?|vind-ik-leuks|comments?|reacties)?$/i.test(s)) return false;
    if (/^(volgen|follow|following|bericht|message|reply|antwoord|meer|more|liked by|vind ik leuk)$/i.test(s)) return false;
    if (/^@\w+$/.test(s)) return false;
    return true;
  }).join('\n');
}

const quality = (d) => (d?.title && d.ingredients?.length >= 2 && d.steps?.length >= 1 ? 'ready' : 'check');

async function processItem(it) {
  if (it.kind === 'link') {
    if (SOCIAL.test(it.value)) return { draft: await readSocial(it.value) };
    const html = await fetchPage(it.value);
    const r = parseRecipeHtml(html, it.value);
    if (!r) throw new Error(t('No recipe found on that page'));
    return { draft: r };
  }
  if (it.kind === 'text') return { draft: { ...parseRecipeText(it.value), source_url: it.source || '' } };
  if (it.kind === 'images') { const res = await readImages(it.images); res.draft.source_url = it.source || ''; return res; }
  throw new Error('Unknown item');
}

async function work() {
  if (working) return;
  working = true;
  try {
    let next;
    while ((next = items.find((x) => x.status === 'pending'))) {
      update(next.id, { status: 'working' });
      try {
        const { draft, error } = await processItem(next);
        update(next.id, { status: error ? 'check' : quality(draft), draft, error: error || null, images: undefined });
      } catch (e) {
        const msg = e.message || String(e);
        update(next.id, { status: 'failed', error: /failed to fetch|network|timeout|unable to resolve|timed out/i.test(msg) ? t("Couldn't open this link. Check your internet connection and try again.") : msg });
      }
    }
  } finally { working = false; }
}

// Resume anything that was interrupted (app closed mid-read)
items = items.map((x) => (x.status === 'working' ? { ...x, status: 'pending' } : x));
setTimeout(work, 1500);
