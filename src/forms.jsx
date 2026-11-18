import { useMemo, useRef, useState } from 'react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
import { useApp } from './App.jsx';
import { Icon, Logo, Photo } from './ui.jsx';
import { CATEGORIES, fetchPage, extractUrl, compressImage } from './lib/util.js';
import { parseRecipeHtml, parseRecipeText, normalizeImported, meatWarnings } from './lib/parse.js';
import { parseConfigSnippet, saveConfig, clearConfig, setMode, isBaked, getMode, newId } from './lib/db.js';

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
    } catch { setMsg({ kind: 'warn', text: 'Could not read the clipboard — long-press the box and paste.' }); }
  };

  const toEditor = (draft, note) => replace({ name: 'edit', draft, note, key: newId() });

  const go = async () => {
    const t = text.trim();
    if (!t) return;
    const url = extractUrl(t);
    const onlyUrl = url && t.replace(url, '').trim().length < 40;
    setMsg(null);
    if (url && onlyUrl && SOCIAL.test(url)) {
      setMsg({ kind: 'warn', text: "Instagram/TikTok don't give the recipe text to other apps. Open the post, copy the caption (tap ⋯ › Copy or long-press the text) and paste it here.", url });
      return;
    }
    if (url && onlyUrl) {
      setBusy(true);
      try {
        const html = await fetchPage(url);
        const r = parseRecipeHtml(html, url);
        if (!r) throw new Error('No recipe found on that page');
        toEditor(r, r.partial ? "We couldn't find the recipe on that page. Title and photo are filled in; add the rest." : null);
      } catch (e) {
        setMsg({ kind: 'warn', text: `${e.message || 'That link did not work'}. ${Capacitor.isNativePlatform() ? '' : 'Link import works in the Android app. In the browser, paste the recipe text instead.'}`, url });
      } finally { setBusy(false); }
      return;
    }
    const r = parseRecipeText(t);
    toEditor({ ...r, source_url: url || '' }, 'Check the split between ingredients and steps.');
  };

  const pickPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const photoData = await compressImage(f, 1600, 0.8);
      toEditor({ photoData }, 'Type the recipe from the photo. The photo is kept with it.');
    } catch (err) { setMsg({ kind: 'warn', text: err.message }); }
  };

  return (
    <>
      <div className="topbar">
        <button className="icon-btn" onClick={back} aria-label="Back"><Icon name="back" /></button>
        <h1 className="serif">Add a recipe</h1>
      </div>
      <div className="screen no-nav stack">
        <div className="card stack">
          <label className="field">
            <span>Paste a link or recipe text</span>
            <textarea className="textarea" style={{ minHeight: 130 }} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={'https://kookmutsjes.com/…\n\nor paste an Instagram/TikTok caption, a WhatsApp message, notes…'} />
          </label>
          <div className="grid2">
            <button className="btn" onClick={paste}><Icon name="clip" size={18} /> Paste</button>
            <button className="btn primary" onClick={go} disabled={!text.trim() || busy}>
              {busy ? <span className="spin" /> : <Icon name="chevR" size={18} />} {busy ? 'Reading…' : 'Continue'}
            </button>
          </div>
          {msg && (
            <div className="banner">
              {msg.text}
              {msg.url && <div style={{ marginTop: 10 }}>
                <button className="btn sm" onClick={() => toEditor({ source_url: msg.url })}>Fill in by hand instead</button>
              </div>}
            </div>
          )}
        </div>

        <button className="option" onClick={() => fileRef.current.click()}>
          <span className="ic"><Icon name="camera" /></span>
          <span><b>Photo or screenshot</b><span className="small muted">Recipe card, cookbook page or screenshot. Type it over with the photo next to it.</span></span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
        <button className="option" onClick={() => toEditor({})}>
          <span className="ic"><Icon name="pen" /></span>
          <span><b>Start from scratch</b><span className="small muted">Just a title and ingredients is enough. Add steps later.</span></span>
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
  const preview = f.photoData || f.photo || f.photo_url;

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setF({ ...f, photoData: await compressImage(file) }); } catch (err) { toast(err.message); }
  };

  const save = async () => {
    if (!f.title.trim()) { toast('Give it a title first'); return; }
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
        ...(existing ? {} : { rating: 0, is_favourite: false }),
      });
      toast(existing ? 'Saved' : 'Recipe added');
      if (existing) back(); else replace({ name: 'recipe', id: savedId });
    } catch (e) { toast('Could not save: ' + e.message); setSaving(false); }
  };

  return (
    <>
      <div className="topbar">
        <button className="icon-btn" onClick={back} aria-label="Cancel"><Icon name="x" /></button>
        <h1 className="serif" style={{ fontSize: 24 }}>{existing ? 'Edit recipe' : 'New recipe'}</h1>
        <button className="btn primary sm" onClick={save} disabled={saving}>{saving ? <span className="spin" /> : 'Save'}</button>
      </div>
      <div className="screen no-nav stack">
        {note && <div className="banner ok">{note}</div>}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <Photo src={preview} fit={f.photoData ? 'contain' : 'cover'} style={{ aspectRatio: '4/3' }} />
          <div className="row" style={{ padding: 10, flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={() => fileRef.current.click()}><Icon name="camera" size={16} /> {preview ? 'Change photo' : 'Add photo'}</button>
            <button className="btn sm ghost" onClick={() => {
              const u = prompt('Image link (https://…)', f.photo_url);
              if (u != null) setF({ ...f, photo_url: u.trim(), photo: u.trim() ? '' : f.photo, photoData: null });
            }}><Icon name="link" size={16} /> Image link</button>
            {preview && <button className="btn sm ghost" onClick={() => setF({ ...f, photo: '', photo_url: '', photoData: null })}>Remove</button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
        </div>

        <label className="field"><span>Title</span><input className="input" value={f.title} onChange={set('title')} placeholder="Romige orzo met spinazie" /></label>
        <div className="grid2">
          <label className="field"><span>Category</span>
            <select className="select" value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label className="field"><span>Servings</span><input className="input" type="number" inputMode="numeric" min="1" value={f.servings} onChange={set('servings')} /></label>
          <label className="field"><span>Prep time</span><input className="input" value={f.prep_time} onChange={set('prep_time')} placeholder="10 min" /></label>
          <label className="field"><span>Cook time</span><input className="input" value={f.cook_time} onChange={set('cook_time')} placeholder="30 min" /></label>
        </div>

        <label className="field"><span>Ingredients · one per line</span>
          <textarea className="textarea" style={{ minHeight: 170 }} value={f.ingredients} onChange={set('ingredients')} placeholder={'300 g orzo\n1 ui\n2 tenen knoflook'} />
        </label>
        {meat.length > 0 && (
          <div className="banner">
            <b>Not vegetarian yet:</b> {meat.join(', ')}. Swap it for a vegetarian alternative (e.g. vegetarische kipstukjes, Vivera schnitzels, vegetarische garnalen) and keep the swap visible in the ingredient.
          </div>
        )}
        <label className="field"><span>Steps · blank line between steps</span>
          <textarea className="textarea" style={{ minHeight: 200 }} value={f.steps} onChange={set('steps')} placeholder={'Snipper de ui en knoflook.\n\nKook de orzo…'} />
        </label>
        <label className="field"><span>Source link</span><input className="input" inputMode="url" value={f.source_url} onChange={set('source_url')} placeholder="https://" /></label>
        <label className="field"><span>Notes</span><textarea className="textarea" style={{ minHeight: 80 }} value={f.notes} onChange={set('notes')} /></label>
        <button className="btn primary block" onClick={save} disabled={saving}>{existing ? 'Save changes' : 'Add recipe'}</button>
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
  const { db, user, recipes, back, toast } = useApp();
  const [busy, setBusy] = useState('');
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
    } catch (err) { setResult({ ok: false, text: 'Could not read that file: ' + err.message }); }
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
      <div className="topbar">
        <button className="icon-btn" onClick={back} aria-label="Back"><Icon name="back" /></button>
        <h1 className="serif">Settings</h1>
      </div>
      <div className="screen no-nav stack">
        <div className="card stack">
          <div className="row">
            <span className="ic"><Icon name="cloud" /></span>
            <div style={{ flex: 1 }}>
              <b>{db.kind === 'firebase' ? 'Synced' : 'This phone only'}</b>
              <div className="small muted">{db.kind === 'firebase' ? `${user.email} · ${db.projectId}` : 'Recipes are not shared yet'}</div>
            </div>
          </div>
          {db.kind === 'local' && (
            <button className="btn primary block" onClick={() => { clearConfig(); location.reload(); }}>Connect Firebase to share between phones</button>
          )}
          {db.kind === 'firebase' && <button className="btn block" onClick={() => db.signOut()}><Icon name="out" size={18} /> Sign out</button>}
        </div>

        <h2 className="serif section-h" style={{ marginTop: 10 }}>Bring recipes in</h2>
        {hasLocal && <button className="option" onClick={moveLocal} disabled={!!busy}>
          <span className="ic">{busy === 'local' ? <span className="spin" /> : <Icon name="cloud" />}</span>
          <span><b>Move recipes from “this phone only”</b><span className="small muted">Recipes you added before connecting Firebase.</span></span>
        </button>}
        <button className="option" onClick={importOld} disabled={!!busy}>
          <span className="ic">{busy === 'old' ? <span className="spin" /> : <Icon name="upload" />}</span>
          <span><b>Import from the old app</b><span className="small muted">Copies every recipe (with ratings, favourites, notes) from the old Supabase database. Runs once; duplicates are skipped.</span></span>
        </button>
        <button className="option" onClick={() => fileRef.current.click()} disabled={!!busy}>
          <span className="ic">{busy === 'json' ? <span className="spin" /> : <Icon name="text" />}</span>
          <span><b>Import JSON files</b><span className="small muted">The .json recipe files from before. Pick several at once.</span></span>
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" multiple hidden onChange={importJson} />
        {result && <div className={`banner ${result.ok ? 'ok' : ''}`}>{result.text}</div>}

        {!Capacitor.isNativePlatform() && recipes.length > 0 && (
          <button className="btn block" onClick={exportJson}>Download a backup (JSON)</button>
        )}

        {db.kind === 'firebase' && !isBaked() && (
          <button className="btn danger block" style={{ marginTop: 24 }} onClick={() => {
            if (confirm('Disconnect this phone from the database? Your recipes stay in Firebase.')) { db.signOut(); clearConfig(); location.reload(); }
          }}>Disconnect database</button>
        )}
        <p className="small muted center" style={{ marginTop: 18 }}>Our Recipes 2.0 · DataIsCool</p>
      </div>
    </>
  );
}

// ── First-run setup ─────────────────────────────────────────────────────────
export function Setup({ onReady }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [help, setHelp] = useState(false);
  const connect = () => {
    const cfg = parseConfigSnippet(text);
    if (!cfg) { setErr("That doesn't look like a Firebase config. It should contain apiKey, projectId and appId."); return; }
    saveConfig(cfg); setMode('firebase'); onReady();
  };
  return (
    <div className="app"><div className="auth stack">
      <Logo size={56} />
      <h1 className="serif">Our<br />Recipes</h1>
      <p className="muted">Connect your shared database once. After that, both phones see the same recipes, planner and shopping list, also offline.</p>
      <label className="field"><span>Firebase config</span>
        <textarea className="textarea" value={text} onChange={(e) => { setText(e.target.value); setErr(''); }}
          placeholder={'const firebaseConfig = {\n  apiKey: "…",\n  projectId: "…",\n  appId: "…"\n};'} />
      </label>
      {err && <div className="banner">{err}</div>}
      <button className="btn primary block" onClick={connect} disabled={!text.trim()}>Connect</button>
      <button className="btn ghost block" onClick={() => setHelp(!help)}>Where do I find this?</button>
      {help && (
        <div className="card small stack">
          <p>In the Firebase console: <b>Project settings</b> (gear icon) › <b>Your apps</b> › your web app › <b>SDK setup and configuration</b> › <b>Config</b>. Copy the whole block and paste it above.</p>
          <p className="muted">Both phones need this once. Or ask Claude to build it into the app so nobody has to paste anything.</p>
        </div>
      )}
      <button className="btn ghost block small" onClick={() => { setMode('local'); onReady(); }}>Try it first without an account (this phone only)</button>
    </div></div>
  );
}

export function Login({ db }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await db.signIn(email, pw); } catch (e2) {
      const c = e2.code || '';
      setErr(c.includes('invalid') || c.includes('wrong-password') || c.includes('user-not-found') ? 'Wrong email or password.'
        : c.includes('network') ? 'No internet connection. You need it the first time you sign in.'
          : c.includes('operation-not-allowed') ? 'Email/password sign-in is not switched on in Firebase (Authentication › Sign-in method).'
            : c.includes('too-many') ? 'Too many tries. Wait a minute and try again.' : e2.message);
      setBusy(false);
    }
  };
  return (
    <div className="app"><form className="auth stack" onSubmit={submit}>
      <Logo size={56} />
      <h1 className="serif">Our<br />Recipes</h1>
      <p className="muted">Sign in once on this phone. You stay signed in.</p>
      <label className="field"><span>Email</span><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="field"><span>Password</span><input className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
      {err && <div className="banner">{err}</div>}
      <button className="btn primary block" disabled={busy || !email || !pw}>{busy ? <span className="spin" /> : 'Sign in'}</button>
      {!isBaked() && <button type="button" className="btn ghost block small" onClick={() => { clearConfig(); location.reload(); }}>Use a different database</button>}
    </form></div>
  );
}
