import { useEffect, useMemo, useState } from 'react';
import { useApp } from './App.jsx';
import { Icon, Logo, Photo, Sheet, Stars, Check } from './ui.jsx';
import { CATEGORIES, ymd, addDays, today, dayLabel, dateShort, shopGroup, SHOP_ORDER, hashKey } from './lib/util.js';
import { scaleIngredient } from './lib/parse.js';

// ── Library ─────────────────────────────────────────────────────────────────
export function Library() {
  const { recipes, loading, go, update, offline, error } = useApp();
  const [q, setQ] = useState(() => sessionStorage.getItem('lib.q') || '');
  const [cat, setCat] = useState(() => sessionStorage.getItem('lib.cat') || 'All');
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState('new');
  useEffect(() => { sessionStorage.setItem('lib.q', q); sessionStorage.setItem('lib.cat', cat); }, [q, cat]);

  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    let l = recipes.filter((r) =>
      (cat === 'All' || r.category === cat) && (!favOnly || r.is_favourite) &&
      words.every((w) => (r.title + ' ' + (r.ingredients || []).join(' ')).toLowerCase().includes(w)));
    if (sort === 'az') l = [...l].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'rating') l = [...l].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return l;
  }, [recipes, q, cat, favOnly, sort]);

  return (
    <>
      <div className="topbar">
        <Logo />
        <div style={{ flex: 1 }}>
          <h1 className="serif" style={{ fontSize: 26, lineHeight: 1 }}>Our Recipes</h1>
          <div className="sub">{recipes.length} recipes{offline ? ' · offline' : ''}</div>
        </div>
        <button className={`icon-btn ${favOnly ? 'on' : ''}`} onClick={() => setFavOnly(!favOnly)} aria-label="Favourites">
          <Icon name="heart" fill={favOnly} />
        </button>
      </div>
      <div className="screen stack" style={{ paddingTop: 8 }}>
        {error && <div className="banner">Can't reach the database: {error.code || error.message}. Check the Firestore rules (see Settings).</div>}
        <div className="row">
          <div className="search" style={{ flex: 1 }}>
            <Icon name="search" size={18} />
            <input className="input" placeholder="Search recipes or ingredients" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="select" style={{ width: 'auto', paddingRight: 14 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            <option value="new">Newest</option><option value="az">A–Z</option><option value="rating">Rating</option>
          </select>
        </div>
        <div className="chips">
          {['All', ...CATEGORIES].map((c) => (
            <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        {loading ? <div className="empty"><div className="spin" style={{ margin: '0 auto' }} /></div>
          : !recipes.length ? (
            <div className="empty">
              <div className="serif">No recipes yet</div>
              <p>Tap + to add one from a link, pasted text or by hand.</p>
              <p className="small" style={{ marginTop: 10 }}>Got recipes in the old app? Import them in Settings.</p>
            </div>
          ) : !list.length ? <div className="empty">Nothing matches.</div> : (
            <div className="cards">
              {list.map((r) => (
                <div key={r.id} className="rcard" role="button" tabIndex={0} onClick={() => go({ name: 'recipe', id: r.id })}>
                  <Photo src={r.photo || r.photo_url} />
                  <button className={`fav ${r.is_favourite ? 'on' : ''}`} aria-label="Favourite"
                    onClick={(e) => { e.stopPropagation(); update(r.id, { is_favourite: !r.is_favourite }); }}>
                    <Icon name="heart" size={17} fill={r.is_favourite} />
                  </button>
                  <div className="body">
                    <div className="t">{r.title}</div>
                    <div className="m">
                      <span>{r.category}</span>
                      {r.rating > 0 && <span style={{ color: 'var(--gold)' }}>★ {r.rating}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </>
  );
}

// ── Recipe detail ───────────────────────────────────────────────────────────
export function RecipeView({ id }) {
  const { byId, back, go, update, deleteRecipe, shopAdd, toast } = useApp();
  const r = byId[id];
  const [servings, setServings] = useState(r?.servings || 2);
  const [done, setDone] = useState({});
  const [sheet, setSheet] = useState(null);
  const [notes, setNotes] = useState(r?.notes || '');
  useEffect(() => { setNotes(r?.notes || ''); }, [r?.notes]);
  if (!r) return <div className="screen no-nav"><button className="icon-btn" onClick={back}><Icon name="back" /></button><div className="empty">This recipe was deleted.</div></div>;

  const base = r.servings || 2;
  const factor = servings / base;
  const ings = (r.ingredients || []).map((i) => scaleIngredient(i, factor));

  return (
    <div className="screen no-nav">
      <div className="hero">
        <Photo src={r.photo || r.photo_url} iconSize={48} />
        <div className="hero-bar">
          <button className="icon-btn" onClick={back} aria-label="Back"><Icon name="back" /></button>
          <span className="spacer" />
          <button className={`icon-btn ${r.is_favourite ? 'on' : ''}`} style={r.is_favourite ? { color: '#ff8a80' } : null}
            onClick={() => update(r.id, { is_favourite: !r.is_favourite })} aria-label="Favourite">
            <Icon name="heart" fill={r.is_favourite} />
          </button>
          <button className="icon-btn" onClick={() => setSheet('more')} aria-label="More"><Icon name="dots" /></button>
        </div>
      </div>
      <div className="stack" style={{ position: 'relative', zIndex: 2, marginTop: -30 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          <span className="tag">{r.category}</span>
          {r.prep_time && <span className="tag"><Icon name="clock" size={13} /> prep {r.prep_time}</span>}
          {r.cook_time && <span className="tag"><Icon name="clock" size={13} /> {r.cook_time}</span>}
        </div>
        <h1 className="serif r-title">{r.title}</h1>
        <Stars value={r.rating || 0} onChange={(v) => update(r.id, { rating: v })} />
        <div className="actions">
          <button className="primary" onClick={() => go({ name: 'cook', id: r.id, servings })} disabled={!r.steps?.length}><Icon name="play" />Cook</button>
          <button onClick={() => setSheet('plan')}><Icon name="cal" />Plan</button>
          <button onClick={() => { shopAdd(ings); toast(`${ings.length} items added to shopping`); }}><Icon name="cart" />Shop</button>
          <button onClick={() => go({ name: 'edit', id: r.id })}><Icon name="edit" />Edit</button>
        </div>

        <h2 className="serif section-h">Ingredients <span className="spacer" />
          <span className="stepper">
            <button onClick={() => setServings(Math.max(1, servings - 1))} aria-label="Fewer servings">−</button>
            <b><Icon name="users" size={14} /> {servings}</b>
            <button onClick={() => setServings(servings + 1)} aria-label="More servings">+</button>
          </span>
        </h2>
        {ings.length ? (
          <ul className="ing">
            {ings.map((t, i) => (
              <li key={i} className={done[i] ? 'done' : ''} onClick={() => setDone({ ...done, [i]: !done[i] })}>
                <Check on={done[i]} /><span>{t}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted">No ingredients yet.</p>}

        <h2 className="serif section-h">Steps</h2>
        {r.steps?.length ? <ol className="steps">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          : <p className="muted">No steps yet — tap Edit to add them.</p>}

        <h2 className="serif section-h">Notes</h2>
        <textarea className="textarea" style={{ minHeight: 80 }} placeholder="Tweaks, what worked, what to change next time…"
          value={notes} onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (r.notes || '') && update(r.id, { notes })} />
        {r.source_url && (
          <a className="btn ghost block" href={r.source_url} target="_blank" rel="noreferrer"><Icon name="link" size={18} /> Original recipe</a>
        )}
      </div>

      {sheet === 'plan' && <PlanSheet recipe={r} onClose={() => setSheet(null)} />}
      {sheet === 'more' && (
        <Sheet onClose={() => setSheet(null)}>
          <div className="stack">
            <button className="btn block" onClick={() => { setSheet(null); go({ name: 'edit', id: r.id }); }}><Icon name="edit" size={18} /> Edit recipe</button>
            <button className="btn danger block" onClick={() => {
              if (confirm(`Delete "${r.title}"? This can't be undone.`)) { deleteRecipe(r); back(); toast('Recipe deleted'); }
            }}><Icon name="trash" size={18} /> Delete recipe</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function PlanSheet({ recipe, onClose }) {
  const { plan, planAdd, toast } = useApp();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today(), i));
  return (
    <Sheet title="Plan for…" onClose={onClose}>
      <div className="grid3">
        {days.map((d) => {
          const key = ymd(d);
          const has = (plan[key] || []).includes(recipe.id);
          return (
            <button key={key} className={`btn ${has ? 'primary' : ''}`} style={{ flexDirection: 'column', gap: 0, padding: 10 }}
              onClick={() => { planAdd(key, recipe.id); toast(`Planned for ${dayLabel(d).toLowerCase()} ${dateShort(d)}`); onClose(); }}>
              <span>{dayLabel(d)}</span><span className="small" style={{ opacity: .75, fontWeight: 400 }}>{dateShort(d)}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

// ── Cook mode ───────────────────────────────────────────────────────────────
export function Cook({ id, servings }) {
  const { byId, back } = useApp();
  const r = byId[id];
  const [i, setI] = useState(0);
  const [showIng, setShowIng] = useState(false);
  useEffect(() => {
    let lock;
    navigator.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, []);
  if (!r) return null;
  const steps = r.steps || [];
  const factor = (servings || r.servings || 2) / (r.servings || 2);
  const last = i >= steps.length - 1;
  return (
    <div className="cook">
      <div className="row">
        <button className="icon-btn" onClick={back} aria-label="Close"><Icon name="x" /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
          <div className="progress" style={{ marginTop: 6 }}><div style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
        </div>
        <button className={`icon-btn ${showIng ? 'on' : ''}`} onClick={() => setShowIng(true)} aria-label="Ingredients"><Icon name="list" /></button>
      </div>
      <div className="cook-step" onClick={(e) => { if (e.clientX > window.innerWidth / 2) !last && setI(i + 1); else i > 0 && setI(i - 1); }}>
        <div className="n">Step {i + 1} of {steps.length}</div>
        <p>{steps[i]}</p>
      </div>
      <div className="grid2">
        <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}><Icon name="chevL" size={18} /> Back</button>
        {last ? <button className="btn primary" onClick={back}><Icon name="check" size={18} /> Done</button>
          : <button className="btn primary" onClick={() => setI(i + 1)}>Next <Icon name="chevR" size={18} /></button>}
      </div>
      {showIng && (
        <Sheet title="Ingredients" onClose={() => setShowIng(false)}>
          <ul className="ing">{(r.ingredients || []).map((t, k) => <li key={k}>{scaleIngredient(t, factor)}</li>)}</ul>
        </Sheet>
      )}
    </div>
  );
}

// ── Planner ─────────────────────────────────────────────────────────────────
export function Planner() {
  const { plan, byId, go, planRemove, planAdd } = useApp();
  const [picking, setPicking] = useState(null);
  const [past, setPast] = useState(false);
  const start = past ? -7 : 0;
  const days = Array.from({ length: 14 - start }, (_, i) => addDays(today(), start + i));
  const t = ymd(today());
  return (
    <>
      <div className="topbar">
        <h1 className="serif">Planner</h1>
        <button className="btn sm ghost" onClick={() => setPast(!past)}>{past ? 'Hide past' : 'Show past week'}</button>
      </div>
      <div className="screen stack" style={{ paddingTop: 8 }}>
        {days.map((d) => {
          const key = ymd(d);
          const ids = (plan[key] || []).filter((x) => byId[x]);
          return (
            <div key={key} className={`day ${key === t ? 'today' : ''} ${key < t ? 'past' : ''}`}>
              <div className="day-h">
                <b>{dayLabel(d)}</b><span className="muted small">{dateShort(d)}</span>
                <span className="spacer" />
                <button className="btn sm ghost" onClick={() => setPicking(key)}><Icon name="plus" size={16} /> Add</button>
              </div>
              {ids.map((rid) => (
                <div key={rid} className="planned">
                  <Photo src={byId[rid].photo || byId[rid].photo_url} iconSize={18} />
                  <button className="t" onClick={() => go({ name: 'recipe', id: rid })}>{byId[rid].title}</button>
                  <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => planRemove(key, rid)} aria-label="Remove">
                    <Icon name="x" size={16} />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {picking && <RecipePicker onClose={() => setPicking(null)} onPick={(id) => { planAdd(picking, id); setPicking(null); }} />}
    </>
  );
}

function RecipePicker({ onPick, onClose }) {
  const { recipes } = useApp();
  const [q, setQ] = useState('');
  const l = recipes.filter((r) => r.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet title="Pick a recipe" onClose={onClose}>
      <div className="search" style={{ marginBottom: 10 }}>
        <Icon name="search" size={18} />
        <input className="input" autoFocus placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {l.map((r) => (
        <button key={r.id} className="planned" style={{ width: '100%' }} onClick={() => onPick(r.id)}>
          <Photo src={r.photo || r.photo_url} iconSize={18} /><span className="t">{r.title}</span>
        </button>
      ))}
      {!l.length && <p className="muted center" style={{ padding: 20 }}>No recipes found.</p>}
    </Sheet>
  );
}

// ── Shopping list ───────────────────────────────────────────────────────────
export function Shopping() {
  const { plan, byId, shopping, shopToggle, shopAdd, shopSet, shopRemove, toast } = useApp();
  const [days, setDays] = useState(() => +(localStorage.getItem('shop.days') || 7));
  const [text, setText] = useState('');
  useEffect(() => localStorage.setItem('shop.days', days), [days]);

  const ticks = useMemo(() => new Set(shopping.filter((s) => s.tick).map((s) => s.id)), [shopping]);
  const manual = shopping.filter((s) => s.manual).sort((a, b) => (a.at || 0) - (b.at || 0));

  const planned = useMemo(() => {
    const items = [];
    for (let i = 0; i < days; i++) {
      const key = ymd(addDays(today(), i));
      (plan[key] || []).forEach((rid) => {
        const r = byId[rid];
        r?.ingredients?.forEach((ing, n) => items.push({ key: hashKey(`${key}|${rid}|${n}|${ing}`), text: ing, from: `${r.title} · ${dayLabel(key)}` }));
      });
    }
    return items;
  }, [plan, byId, days]);

  const groups = useMemo(() => {
    const g = {};
    planned.forEach((x) => (g[shopGroup(x.text)] ||= []).push(x));
    return SHOP_ORDER.filter((k) => g[k]).map((k) => [k, g[k]]);
  }, [planned]);

  const doneCount = planned.filter((x) => ticks.has(x.key)).length + manual.filter((m) => m.ticked).length;
  const total = planned.length + manual.length;

  const add = () => {
    const t = text.split(/\n|,\s*(?=\D)/).map((x) => x.trim()).filter(Boolean);
    if (t.length) shopAdd(t);
    setText('');
  };
  const clearDone = () => {
    const live = new Set(planned.map((x) => x.key));
    shopping.forEach((s) => { if ((s.tick && !live.has(s.id)) || (s.manual && s.ticked)) shopRemove(s.id); });
    toast('Cleared ticked items');
  };

  return (
    <>
      <div className="topbar">
        <h1 className="serif">Shopping</h1>
        {total > 0 && <span className="pill">{doneCount}/{total}</span>}
      </div>
      <div className="screen stack" style={{ paddingTop: 8 }}>
        <div className="chips">
          {[3, 7, 14].map((n) => (
            <button key={n} className={`chip ${days === n ? 'on' : ''}`} onClick={() => setDays(n)}>Next {n} days</button>
          ))}
        </div>
        <div className="row">
          <input className="input" placeholder="Add an item (milk, bread…)" value={text}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="icon-btn" onClick={add} aria-label="Add item" style={{ height: 46, width: 46 }}><Icon name="plus" /></button>
        </div>

        {!total && (
          <div className="empty">
            <div className="serif">List is empty</div>
            <p>Plan recipes in the planner and their ingredients show up here. Or add items above.</p>
          </div>
        )}

        {manual.length > 0 && (
          <div className="shop-group">
            <h3>Added by you</h3>
            {manual.map((m) => (
              <div key={m.id} className={`shop-item ${m.ticked ? 'done' : ''}`}>
                <button className="row" style={{ flex: 1, textAlign: 'left', gap: 12 }} onClick={() => shopSet(m.id, { ticked: !m.ticked })}>
                  <Check on={m.ticked} /><span className="txt">{m.text}</span>
                </button>
                <button className="muted" onClick={() => shopRemove(m.id)} aria-label="Remove"><Icon name="x" size={16} /></button>
              </div>
            ))}
          </div>
        )}

        {groups.map(([g, items]) => (
          <div key={g} className="shop-group">
            <h3>{g}</h3>
            {items.map((x) => {
              const on = ticks.has(x.key);
              return (
                <button key={x.key} className={`shop-item ${on ? 'done' : ''}`} onClick={() => shopToggle(x.key, !on)}>
                  <Check on={on} />
                  <span style={{ flex: 1 }}><span className="txt">{x.text}</span><br /><span className="from">{x.from}</span></span>
                </button>
              );
            })}
          </div>
        ))}

        {manual.some((m) => m.ticked) && <button className="btn ghost block" onClick={clearDone}>Remove ticked items you added</button>}
      </div>
    </>
  );
}
