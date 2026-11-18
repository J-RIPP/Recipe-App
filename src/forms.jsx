import { useMemo, useRef, useState } from 'react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
import { useApp } from './App.jsx';
import { Icon, Mark, Photo, Sheet } from './ui.jsx';
import { CATEGORIES, fetchPage, extractUrl, compressImage } from './lib/util.js';
import { parseRecipeHtml, parseRecipeText, normalizeImported, meatWarnings } from './lib/parse.js';
import { estimateMacros } from './lib/nutrition.js';
import { DEFAULT_TARGETS } from './lib/planner.js';
import { parseConfigSnippet, saveConfig, clearConfig, setMode, isBaked, getMode, newId, getConfig, makeInvite, readInvite } from './lib/db.js';
import { Share } from '@capacitor/share';
import { t, getLang, setLang } from './lib/i18n.js';

const SOCIAL = /instagram\.com|tiktok\.com|facebook\.com|fb\.watch|youtube\.com|youtu\.be|pinterest\./i;

// ── Add recipe ──────────────────────────────────────────────────────────────
export function AddScreen() {
  const { back, replace } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef();

  const paste = async () => {
    try {
      const { value } = Capacitor.isNativePlatform() ? await Clipboard.read() : { value: await navigator.clipboard.readText() };
      if (value) setText(value);
    } catch { setMsg({ kind: 'warn', text: t("Could not read the clipboard — long-press the box and paste.") }); }
  };

  const toEditor = (draft, note) => replace({ name: 'edit', draft, note, key: newId() });

  const go = async () => {
    const txt = text.trim();
    if (!txt) return;
    const url = extractUrl(txt);
    const onlyUrl = url && txt.replace(url, '').trim().length < 40;
    setMsg(null);
    if (url && onlyUrl && SOCIAL.test(url)) {
      setMsg({ kind: 'warn', text: t("Instagram/TikTok don't give the recipe text to other apps. Open the post, copy the caption (tap ⋯ › Copy or long-press the text) and paste it here."), url });
      return;
    }
    if (url && onlyUrl) {
      setBusy(true);
      try {
        const html = await fetchPage(url);
        const r = parseRecipeHtml(html, url);
        if (!r) throw new Error(t('No recipe found on that page'));
        toEditor(r, r.partial ? t("We couldn't find the recipe on that page. Title and photo are filled in; add the rest.") : null);
      } catch (e) {
        setMsg({ kind: 'warn', text: `${e.message || t('That link did not work')}. ${Capacitor.isNativePlatform() ? '' : t('Link import works in the Android app. In the browser, paste the recipe text instead.')}`, url });
      } finally { setBusy(false); }
      return;
    }
    const r = parseRecipeText(txt);
    toEditor({ ...r, source_url: url || '' }, t('Check the split between ingredients and steps.'));
  };

  const pickPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const photoData = await compressImage(f, 1600, 0.8);
      toEditor({ photoData }, t('Type the recipe from the photo. The photo is kept with it.'));
    } catch (err) { setMsg({ kind: 'warn', text: err.message }); }
  };

  return (
    <>
      <div className="topbar compact">
        <button className="icon-btn" onClick={back} aria-label={t("Back")}><Icon name="back" /></button>
        <h1 className="serif">{t("Add a recipe")}</h1>
      </div>
      <div className="screen no-nav stack" style={{ paddingTop: 16 }}>
        <div className="card stack">
          <label className="field">
            <span>{t("Paste a link or recipe text")} <em>{t("from a website, Instagram, TikTok, WhatsApp")}</em></span>
            <textarea className="textarea" style={{ minHeight: 130 }} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={'https://kookmutsjes.com/…\n\nor the full caption text of a post'} />
          </label>
          <div className="grid2">
            <button className="btn" onClick={paste}><Icon name="clip" size={18} /> {t("Paste")}</button>
            <button className="btn primary" onClick={go} disabled={!text.trim() || busy}>
              {busy ? <span className="spin" /> : <Icon name="chevR" size={18} />} {busy ? t('Reading the page') : t('Continue')}
            </button>
          </div>
          {msg && (
            <div className="banner">
              {msg.text}
              {msg.url && <div style={{ marginTop: 10 }}>
                <button className="btn sm" onClick={() => toEditor({ source_url: msg.url })}>{t("Fill in by hand instead")}</button>
              </div>}
            </div>
          )}
        </div>

        <button className="option" onClick={() => fileRef.current.click()}>
          <span className="ic"><Icon name="camera" /></span>
          <span><b>{t("Photo or screenshot")}</b><span className="small muted">{t("A recipe card, cookbook page or screenshot. You type it in with the photo above.")}</span></span>
          <span className="chev"><Icon name="chevR" size={20} /></span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
        <button className="option" onClick={() => toEditor({})}>
          <span className="ic"><Icon name="pen" /></span>
          <span><b>{t("Type it in")}</b><span className="small muted">{t("A title and ingredients are enough. Add the steps later.")}</span></span>
          <span className="chev"><Icon name="chevR" size={20} /></span>
        </button>
      </div>
    </>
  );
}

// ── Editor ──────────────────────────────────────────────────────────────────
export function Editor({ id, draft, note }) {
  const { byId, back, replace, saveRecipe, toast } = useApp();
  const existing = id ? byId[id] : null;
  const initial = existing || draft || {};
  const [f, setF] = useState(() => ({
    title: initial.title || '',
    category: initial.category || 'Dinner',
    servings: initial.servings || 2,
    prep_time: initial.prep_time || '',
    cook_time: initial.cook_time || '',
    source_url: initial.source_url || '',
    photo: initial.photo || '',
    photo_url: initial.photo_url || '',
    photoData: initial.photoData || null,
    ingredients: (initial.ingredients || []).join('\n'),
    steps: (initial.steps || []).join('\n\n'),
    notes: initial.notes || '',
    kcal: initial.macros?.kcal ?? '', protein: initial.macros?.protein ?? '', carbs: initial.macros?.carbs ?? '', fat: initial.macros?.fat ?? '',
    macroSource: initial.macros?.source || '',
  }));
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const lines = (s) => s.split('\n').map((x) => x.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
  const stepsOf = (s) => {
    // Steps separated by blank lines; if there are none, every line is a step
    const blocks = s.split(/\n\s*\n/).map((x) => x.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
    return (blocks.length > 1 ? blocks : lines(s)).map((x) => x.replace(/^\d{1,2}[.)]\s+/, ''));
  };
  const meat = useMemo(() => meatWarnings(lines(f.ingredients)), [f.ingredients]);
  const est = useMemo(() => estimateMacros(lines(f.ingredients), +f.servings || 2), [f.ingredients, f.servings]);
  const setMacro = (k) => (e) => setF({ ...f, [k]: e.target.value, macroSource: 'manual' });
  const hasMacros = +f.kcal > 0;
  const preview = f.photoData || f.photo || f.photo_url;

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setF({ ...f, photoData: await compressImage(file) }); } catch (err) { toast(err.message); }
  };

  const save = async () => {
    if (!f.title.trim()) { toast(t("Give it a title first")); return; }
    setSaving(true);
    try {
      const photoData = f.photoData && f.photoData.length > 400_000
        ? await shrinkDataUrl(f.photoData) : f.photoData;
      const savedId = await saveRecipe({
        id: existing?.id,
        title: f.title.trim(),
        category: f.category,
        servings: Math.max(1, +f.servings || 2),
        prep_time: f.prep_time.trim(),
        cook_time: f.cook_time.trim(),
        source_url: f.source_url.trim(),
        photo: f.photo, photo_url: f.photo_url.trim(), photoData,
        ingredients: lines(f.ingredients),
        steps: stepsOf(f.steps),
        notes: f.notes,
        macros: hasMacros ? { kcal: Math.round(+f.kcal), protein: Math.round(+f.protein || 0), carbs: Math.round(+f.carbs || 0), fat: Math.round(+f.fat || 0), source: f.macroSource || 'manual' } : null,
        ...(existing ? {} : { rating: 0, is_favourite: false }),
      });
      toast(existing ? t('Saved') : t('Recipe added'));
      if (existing) back(); else replace({ name: 'recipe', id: savedId });
    } catch (e) { toast('Could not save: ' + e.message); setSaving(false); }
  };

  return (
    <>
      <div className="topbar compact">
        <button className="icon-btn" onClick={back} aria-label={t("Cancel")}><Icon name="x" /></button>
        <h1 className="serif">{existing ? t('Edit recipe') : t('New recipe')}</h1>
        <button className="btn primary sm" style={{ minWidth: 72 }} onClick={save} disabled={saving}>{saving ? <span className="spin" /> : t('Save')}</button>
      </div>
      <div className="screen no-nav stack" style={{ paddingTop: 16 }}>
        {note && <div className="banner ok">{note}</div>}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <Photo src={preview} fit={f.photoData ? 'contain' : 'cover'} style={{ aspectRatio: preview ? '4/3' : '3/1' }} />
          <div className="row" style={{ padding: 10, flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={() => fileRef.current.click()}><Icon name="camera" size={16} /> {preview ? t('Change photo') : t('Add photo')}</button>
            <button className="btn sm ghost" onClick={() => {
              const u = prompt('Image link (https://…)', f.photo_url);
              if (u != null) setF({ ...f, photo_url: u.trim(), photo: u.trim() ? '' : f.photo, photoData: null });
            }}><Icon name="link" size={16} /> {t("Image link")}</button>
            {preview && <button className="btn sm ghost" onClick={() => setF({ ...f, photo: '', photo_url: '', photoData: null })}>{t("Remove")}</button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
        </div>

        <label className="field"><span>{t("Title")}</span><input className="input" value={f.title} onChange={set('title')} placeholder={t("Romige orzo met spinazie")} /></label>
        <div className="grid2">
          <label className="field"><span>{t("Category")}</span>
            <select className="select" value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label className="field"><span>{t("Servings")}</span><input className="input" type="number" inputMode="numeric" min="1" value={f.servings} onChange={set('servings')} /></label>
          <label className="field"><span>{t("Prep time")}</span><input className="input" value={f.prep_time} onChange={set('prep_time')} placeholder={t("10 min")} /></label>
          <label className="field"><span>{t("Cook time")}</span><input className="input" value={f.cook_time} onChange={set('cook_time')} placeholder={t("30 min")} /></label>
        </div>

        <label className="field"><span>{t("Ingredients")} <em>{t("one per line")}</em></span>
          <textarea className="textarea" style={{ minHeight: 170 }} value={f.ingredients} onChange={set('ingredients')} placeholder={'300 g orzo\n1 ui\n2 tenen knoflook'} />
        </label>
        {meat.length > 0 && (
          <div className="banner">
            <b>{t("Not vegetarian yet:")}</b> {meat.join(', ')}. Swap it for a vegetarian alternative (e.g. vegetarische kipstukjes, Vivera schnitzels, vegetarische garnalen) and keep the swap visible in the ingredient.
          </div>
        )}
        <label className="field"><span>{t("Method")} <em>{t("leave a blank line between steps")}</em></span>
          <textarea className="textarea" style={{ minHeight: 200 }} value={f.steps} onChange={set('steps')} placeholder={'Snipper de ui en knoflook.\n\nKook de orzo…'} />
        </label>
        <div className="field">
          <span>{t("Macros per serving")} <em>{hasMacros ? (f.macroSource === 'site' ? t('from the recipe website') : t('entered by you')) : t('leave empty to estimate from the ingredients')}</em></span>
          <div className="grid2" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[['kcal', 'kcal'], ['protein', t('Protein') + ' g'], ['carbs', t('Carbs') + ' g'], ['fat', t('Fat') + ' g']].map(([k, l]) => (
              <label key={k} className="field" style={{ minWidth: 0 }}>
                <input className="input" style={{ padding: '10px 8px', textAlign: 'center' }} type="number" inputMode="numeric" min="0"
                  value={f[k]} onChange={setMacro(k)} placeholder={est.matched ? String(est[k]) : '–'} aria-label={l} />
                <span className="small muted center" style={{ display: 'block', marginTop: 4, fontWeight: 500 }}>{l}</span>
              </label>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            <span className="small muted" style={{ flex: 1 }}>
              {est.matched ? t('Estimate: {kcal} kcal, {p} g protein (from {a} of {b} ingredients)', { kcal: est.kcal, p: est.protein, a: est.matched, b: est.total }) : t('Add amounts like "200 g" to the ingredients for an estimate.')}
            </span>
            {hasMacros && <button className="btn sm ghost" onClick={() => setF({ ...f, kcal: '', protein: '', carbs: '', fat: '', macroSource: '' })}>{t("Use estimate")}</button>}
          </div>
        </div>
        <label className="field"><span>{t("Original recipe link")} <em>{t("optional")}</em></span><input className="input" inputMode="url" value={f.source_url} onChange={set('source_url')} placeholder="https://" /></label>
        <label className="field"><span>{t("Notes")} <em>{t("optional")}</em></span><textarea className="textarea" style={{ minHeight: 80 }} value={f.notes} onChange={set('notes')} /></label>
        <button className="btn primary block" onClick={save} disabled={saving}>{existing ? t('Save changes') : t('Add recipe')}</button>
      </div>
    </>
  );
}

function shrinkDataUrl(dataUrl) {
  return fetch(dataUrl).then((r) => r.blob()).then((b) => compressImage(b, 1000, 0.7));
}

// ── Settings ────────────────────────────────────────────────────────────────
const OLD_SB = 'https://tkpwseiasagnzerodiwl.supabase.co';
const OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrcHdzZWlhc2Fnbnplcm9kaXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NzM4OTIsImV4cCI6MjA5NTE0OTg5Mn0.wWN7IXRcEmGiIisR0k9Gc4TkQT6CuLCNF7Qk8_Gl9qQ';

export function Settings() {
  const { db, user, recipes, back, toast, targets, personIdx, setPersonIdx, replayWelcome } = useApp();
  const [busy, setBusy] = useState('');
  const [inviting, setInviting] = useState(false);
  const lang = getLang();
  const [result, setResult] = useState(null);
  const fileRef = useRef();
  const hasLocal = db.kind === 'firebase' && Object.keys(JSON.parse(localStorage.getItem('or.local.recipes') || '{}')).length > 0;

  const importList = async (items, label) => {
    const have = new Set(recipes.map((r) => r.title.toLowerCase().trim()));
    const fresh = [];
    for (const raw of items) {
      const r = normalizeImported(raw);
      if (!r || have.has(r.title.toLowerCase())) continue;
      have.add(r.title.toLowerCase());
      const created = raw.created_at ? new Date(raw.created_at).getTime() || Date.now() : Date.now();
      fresh.push({ id: newId(), ...r, photo: raw.photo || '', created_at: created, updated_at: Date.now() });
    }
    if (fresh.length) await db.bulkSet('recipes', fresh);
    setResult({ ok: true, text: `${label}: ${fresh.length} added, ${items.length - fresh.length} skipped (already there or empty).` });
  };

  const importJson = async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setBusy('json');
    try {
      const all = [];
      for (const file of files) {
        const data = JSON.parse(await file.text());
        all.push(...(Array.isArray(data) ? data : data.recipes || [data]));
      }
      await importList(all, 'JSON import');
    } catch (err) { setResult({ ok: false, text: t("Could not read that file: ") + err.message }); }
    setBusy(''); e.target.value = '';
  };

  const importOld = async () => {
    setBusy('old'); setResult(null);
    try {
      const url = `${OLD_SB}/rest/v1/recipes?select=*`;
      const headers = { apikey: OLD_KEY, Authorization: `Bearer ${OLD_KEY}` };
      let data;
      if (Capacitor.isNativePlatform()) {
        const res = await CapacitorHttp.get({ url, headers, connectTimeout: 15000, readTimeout: 30000 });
        if (res.status >= 400) throw new Error(`status ${res.status}`);
        data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      } else {
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`status ${res.status}`);
        data = await res.json();
      }
      if (!Array.isArray(data)) throw new Error('unexpected answer');
      await importList(data, 'Old app');
    } catch (err) {
      setResult({ ok: false, text: `Couldn't reach the old database (${err.message}). It's probably paused: log in at supabase.com, open the project and press "Restore", wait a few minutes, then try again.` });
    }
    setBusy('');
  };

  const moveLocal = async () => {
    const data = JSON.parse(localStorage.getItem('or.local.recipes') || '{}');
    const imgs = JSON.parse(localStorage.getItem('or.local.images') || '{}');
    setBusy('local');
    await db.bulkSet('images', Object.entries(imgs).map(([id, v]) => ({ id, ...v })));
    await db.bulkSet('recipes', Object.entries(data).map(([id, v]) => ({ id, ...v })));
    localStorage.removeItem('or.local.recipes'); localStorage.removeItem('or.local.images');
    setBusy(''); toast(`${Object.keys(data).length} recipes moved`);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(recipes, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `recipes-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };

  return (
    <>
      <div className="topbar compact">
        <button className="icon-btn" onClick={back} aria-label={t("Back")}><Icon name="back" /></button>
        <h1 className="serif">{t("Settings")}</h1>
      </div>
      <div className="screen no-nav stack" style={{ paddingTop: 16 }}>
        <div className="card stack">
          <div className="row">
            <span className="icon-btn on" style={{ borderColor: 'transparent' }}><Icon name="cloud" /></span>
            <div style={{ flex: 1 }}>
              <b>{db.kind === 'firebase' ? t('Synced') : t('This phone only')}</b>
              <div className="small muted">{db.kind === 'firebase' ? `${user.email} · ${db.projectId}` : t('Recipes are not shared yet')}</div>
            </div>
          </div>
          {db.kind === 'local' && (
            <button className="btn primary block" onClick={() => { clearConfig(); location.reload(); }}>{t("Connect Firebase to share between phones")}</button>
          )}
          {db.kind === 'firebase' && <button className="btn block" onClick={() => db.signOut()}><Icon name="out" size={18} /> {t("Sign out")}</button>}
        </div>

        {db.kind === 'firebase' && (
          <button className="big-choice main" onClick={() => setInviting(true)}>
            <span className="ic"><Icon name="users" /></span>
            <span><b>{t('Invite someone')}</b><span className="d">{t('Send an invite so they see the same recipes, planner and list.')}</span></span>
          </button>
        )}

        <div className="section-label">{t('This phone')}</div>
        <div className="card stack">
          <div className="opt-row"><span>{t('Language')}</span>
            <span className="person-seg">
              {[['nl', 'Nederlands'], ['en', 'English']].map(([k, l]) => <button key={k} className={lang === k ? 'on' : ''} onClick={() => lang !== k && setLang(k)}>{l}</button>)}
            </span>
          </div>
          {targets.people.length > 1 && (
            <div className="opt-row"><span>{t('Who uses this phone?')}</span>
              <span className="person-seg">
                {targets.people.map((p, i) => <button key={i} className={personIdx === i ? 'on' : ''} onClick={() => setPersonIdx(i)}>{p.name}</button>)}
              </span>
            </div>
          )}
          <button className="btn outline block" onClick={replayWelcome}><Icon name="play" size={16} /> {t('How the app works')}</button>
        </div>

        <TargetsEditor key={JSON.stringify(targets)} />

        <div className="section-label">{t("Bring recipes in")}</div>
        {hasLocal && <button className="option" onClick={moveLocal} disabled={!!busy}>
          <span className="ic">{busy === 'local' ? <span className="spin" /> : <Icon name="cloud" />}</span>
          <span><b>{t("Move recipes from “this phone only”")}</b><span className="small muted">{t("Recipes you added before connecting Firebase.")}</span></span>
        </button>}
        <button className="option" onClick={importOld} disabled={!!busy}>
          <span className="ic">{busy === 'old' ? <span className="spin" /> : <Icon name="upload" />}</span>
          <span><b>{t("Import from the old app")}</b><span className="small muted">{t("Copies every recipe (with ratings, favourites, notes) from the old Supabase database. Runs once; duplicates are skipped.")}</span></span>
        </button>
        <button className="option" onClick={() => fileRef.current.click()} disabled={!!busy}>
          <span className="ic">{busy === 'json' ? <span className="spin" /> : <Icon name="text" />}</span>
          <span><b>{t("Import JSON files")}</b><span className="small muted">{t("The .json recipe files from before. Pick several at once.")}</span></span>
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" multiple hidden onChange={importJson} />
        {result && <div className={`banner ${result.ok ? 'ok' : ''}`}>{result.text}</div>}

        {!Capacitor.isNativePlatform() && recipes.length > 0 && (
          <button className="btn block" onClick={exportJson}>{t('Download a backup (JSON)')}</button>
        )}

        {db.kind === 'firebase' && !isBaked() && (
          <button className="btn danger block" style={{ marginTop: 24 }} onClick={() => {
            if (confirm(t("Disconnect this phone from the database? Your recipes stay in Firebase."))) { db.signOut(); clearConfig(); location.reload(); }
          }}>{t("Disconnect database")}</button>
        )}
        <p className="small muted center" style={{ marginTop: 18 }}>{t("Our Recipes 2.0")}</p>
      </div>
      {inviting && <InviteSheet onClose={() => setInviting(false)} />}
    </>
  );
}

const APK_URL = 'https://github.com/J-RIPP/Recipe-App/releases/latest/download/OurRecipes.apk';

function InviteSheet({ onClose }) {
  const { user, toast } = useApp();
  const code = makeInvite(getConfig() || {}, user.email);
  const message = t('Join our cookbook in Our Recipes!\n\n1. Install the app: {url}\n2. Open it and tap "Join our cookbook"\n3. Paste this code:\n\n{code}', { url: APK_URL, code });
  const share = async () => {
    try {
      if (Capacitor.isNativePlatform()) await Share.share({ title: t('Our Recipes'), text: message, dialogTitle: t('Send invite') });
      else if (navigator.share) await navigator.share({ text: message });
      else { await navigator.clipboard.writeText(message); toast(t('Invite copied')); }
    } catch { /* closed share sheet */ }
  };
  const copy = async () => {
    try { Capacitor.isNativePlatform() ? await Clipboard.write({ string: code }) : await navigator.clipboard.writeText(code); toast(t('Code copied')); } catch { /* ignore */ }
  };
  return (
    <Sheet title={t('Invite someone')} onClose={onClose}>
      <ol className="steps" style={{ marginTop: 4 }}>
        <li>{t('Send the invite. It has a download link for the app and a code.')}</li>
        <li>{t('They open the app, tap "Join our cookbook", paste the code and create an account with their email.')}</li>
        <li>{t('Add their email to the Firestore rules in Firebase (one time). Then they are in.')}</li>
      </ol>
      <div className="code">{code}</div>
      <div className="grid2" style={{ marginTop: 14 }}>
        <button className="btn" onClick={copy}><Icon name="clip" size={18} /> {t('Copy code')}</button>
        <button className="btn primary" onClick={share}><Icon name="upload" size={18} /> {t('Send invite')}</button>
      </div>
    </Sheet>
  );
}

function TargetsEditor() {
  const { targets, saveTargets, toast } = useApp();
  const [tt, setT] = useState(() => JSON.parse(JSON.stringify(targets)));
  const dirty = JSON.stringify(tt) !== JSON.stringify(targets);
  const setP = (i, k, v) => setT({ ...tt, people: tt.people.map((p, j) => (j === i ? { ...p, [k]: k === 'name' ? v : Math.max(0, +v || 0) } : p)) });
  return (
    <>
      <div className="section-label">{t("Macro targets")}</div>
      <div className="card stack">
        <p className="small muted">{t("Daily targets per person. The planner aims each dinner at a share of the day.")}</p>
        {tt.people.map((p, i) => (
          <div key={i} className="stack" style={{ paddingBottom: 12, borderBottom: '1px solid var(--line-soft)' }}>
            <div className="row">
              <input className="input" style={{ fontWeight: 600 }} value={p.name} onChange={(e) => setP(i, 'name', e.target.value)} aria-label={t("Name")} />
              {tt.people.length > 1 && <button className="icon-btn" onClick={() => setT({ ...tt, people: tt.people.filter((_, j) => j !== i) })} aria-label={`Remove ${p.name}`}><Icon name="trash" size={18} /></button>}
            </div>
            <div className="grid2" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[['kcal', 'kcal'], ['protein', t('Protein') + ' g'], ['carbs', t('Carbs') + ' g'], ['fat', t('Fat') + ' g']].map(([k, l]) => (
                <label key={k} style={{ minWidth: 0 }}>
                  <input className="input" style={{ padding: '10px 6px', textAlign: 'center' }} type="number" inputMode="numeric" value={p[k]} onChange={(e) => setP(i, k, e.target.value)} aria-label={`${p.name} ${l}`} />
                  <span className="small muted center" style={{ display: 'block', marginTop: 4 }}>{l}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        {tt.people.length < 4 && <button className="btn sm outline" onClick={() => setT({ ...tt, people: [...tt.people, { ...DEFAULT_TARGETS.people[0], name: t('Partner') }] })}><Icon name="plus" size={16} /> {t("Add a person")}</button>}
        <div className="opt-row">
          <span>{t("Dinner share of the day")}<em>{t('{n} kcal for {name}', { n: Math.round((tt.people[0]?.kcal || 0) * tt.dinnerShare / 100), name: tt.people[0]?.name })}</em></span>
          <span className="stepper">
            <button onClick={() => setT({ ...tt, dinnerShare: Math.max(10, tt.dinnerShare - 5) })} aria-label={t("Less")}>−</button>
            <b>{tt.dinnerShare}%</b>
            <button onClick={() => setT({ ...tt, dinnerShare: Math.min(70, tt.dinnerShare + 5) })} aria-label={t("More")}>+</button>
          </span>
        </div>
        {dirty && <button className="btn primary block" onClick={() => { saveTargets(tt); toast(t("Targets saved")); }}>{t("Save targets")}</button>}
      </div>
    </>
  );
}

// ── First-run setup ─────────────────────────────────────────────────────────
export function Setup({ onReady }) {
  const [mode, setMode2] = useState(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const connect = () => {
    const cfg = readInvite(text);
    if (!cfg) { setErr(mode === 'join' ? t("That code doesn't look right. Copy the whole invite code and try again.") : t("That doesn't look like a Firebase config. It should contain apiKey, projectId and appId.")); return; }
    saveConfig(cfg); setMode('firebase'); onReady();
  };
  const paste = async () => {
    try {
      const { value } = Capacitor.isNativePlatform() ? await Clipboard.read() : { value: await navigator.clipboard.readText() };
      if (value) { setText(value); setErr(''); }
    } catch { setErr(t('Could not read the clipboard. Long-press the box and paste.')); }
  };
  return (
    <div className="app"><div className="auth stack">
      <Mark size={64} />
      <h1 className="serif">Our<br />Recipes</h1>
      <p className="muted">{t('A shared cookbook for the two of you: recipes, a meal planner and a shopping list that stay in sync.')}</p>

      {mode !== 'new' && (
        <button className="big-choice main" onClick={() => { setMode2('join'); setErr(''); }}>
          <span className="ic"><Icon name="users" /></span>
          <span><b>{t('Join our cookbook')}</b><span className="d">{t('Got an invite code? Start here.')}</span></span>
        </button>
      )}
      {mode === 'join' && (
        <div className="card stack">
          <label className="field"><span>{t('Invite code')}</span>
            <textarea className="textarea" style={{ minHeight: 90 }} value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} placeholder={t("OR1.…")} />
          </label>
          <div className="grid2">
            <button className="btn" onClick={paste}><Icon name="clip" size={18} /> {t('Paste')}</button>
            <button className="btn primary" onClick={connect} disabled={!text.trim()}>{t('Join')}</button>
          </div>
          {err && <div className="banner">{err}</div>}
        </div>
      )}

      {mode !== 'join' && (
        <button className="big-choice" onClick={() => { setMode2('new'); setErr(''); }}>
          <span className="ic"><Icon name="sprig" /></span>
          <span><b>{t('Set up a new cookbook')}</b><span className="d">{t('Done once, by one of you. Needs a free Firebase project.')}</span></span>
        </button>
      )}
      {mode === 'new' && (
        <div className="card stack">
          <label className="field"><span>{t('Firebase config')}</span>
            <textarea className="textarea" value={text} onChange={(e) => { setText(e.target.value); setErr(''); }}
              placeholder={'const firebaseConfig = {\n  apiKey: "…",\n  projectId: "…",\n  appId: "…"\n};'} />
          </label>
          <p className="small muted">{t('In the Firebase console: Project settings › Your apps › your web app › Config. Copy the whole block and paste it here.')}</p>
          <button className="btn primary block" onClick={connect} disabled={!text.trim()}>{t('Connect')}</button>
          {err && <div className="banner">{err}</div>}
        </div>
      )}
      {mode && <button className="btn ghost block" onClick={() => { setMode2(null); setText(''); setErr(''); }}>{t('Back')}</button>}
      {!mode && <button className="btn ghost block small" onClick={() => { setMode('local'); onReady(); }}>{t('Just try it on this phone first')}</button>}
    </div></div>
  );
}

export function Login({ db }) {
  const [mode, setM] = useState('signin');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(''); setInfo('');
    try { await (mode === 'signup' ? db.signUp(email, pw) : db.signIn(email, pw)); } catch (e2) {
      const c = e2.code || '';
      setErr(c.includes('email-already-in-use') ? t('There is already an account with this email. Sign in instead.')
        : c.includes('weak-password') ? t('Use at least 6 characters for the password.')
          : c.includes('invalid-email') ? t('That email address doesn\'t look right.')
            : c.includes('invalid') || c.includes('wrong-password') || c.includes('user-not-found') ? t('Wrong email or password.')
              : c.includes('network') ? t('No internet connection. You need it the first time you sign in.')
                : c.includes('operation-not-allowed') ? t('Email sign-in is not switched on in Firebase (Authentication › Sign-in method).')
                  : c.includes('too-many') ? t('Too many tries. Wait a minute and try again.') : e2.message);
      setBusy(false);
    }
  };
  const reset = async () => {
    if (!email) { setErr(t('Fill in your email first.')); return; }
    try { await db.resetPassword(email); setInfo(t('Check your inbox for a link to set a new password.')); setErr(''); } catch (e2) { setErr(e2.message); }
  };
  const signup = mode === 'signup';
  return (
    <div className="app"><form className="auth stack" onSubmit={submit}>
      <Mark size={64} />
      <h1 className="serif">{signup ? t('Create your account') : t('Welcome back')}</h1>
      <p className="muted">{signup ? t('Use your own email. You only do this once; after that the app keeps you signed in.') : t('Sign in once on this phone. You stay signed in.')}</p>
      <div className="seg">
        <button type="button" className={!signup ? 'on' : ''} onClick={() => { setM('signin'); setErr(''); }}>{t('I have an account')}</button>
        <button type="button" className={signup ? 'on' : ''} onClick={() => { setM('signup'); setErr(''); }}>{t("I'm new")}</button>
      </div>
      <label className="field"><span>{t('Email')}</span><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="field"><span>{t('Password')} {signup && <em>{t('at least 6 characters')}</em>}</span>
        <div style={{ position: 'relative' }}>
          <input className="input" type={show ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} style={{ paddingRight: 70 }} />
          <button type="button" className="btn ghost sm" style={{ position: 'absolute', right: 4, top: 5 }} onClick={() => setShow(!show)}>{show ? t('Hide') : t('Show')}</button>
        </div>
      </label>
      {err && <div className="banner">{err}</div>}
      {info && <div className="banner ok">{info}</div>}
      <button className="btn primary block" disabled={busy || !email || !pw}>{busy ? <span className="spin" /> : signup ? t('Create account') : t('Sign in')}</button>
      {!signup && <button type="button" className="btn ghost block small" onClick={reset}>{t('Forgot your password?')}</button>}
      {!isBaked() && <button type="button" className="btn ghost block small" style={{ color: 'var(--muted)' }} onClick={() => { clearConfig(); location.reload(); }}>{t('Use a different cookbook')}</button>}
    </form></div>
  );
}
