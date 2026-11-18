import { useEffect, useMemo, useState } from 'react';
import { useApp } from './App.jsx';
import { Icon, Logo, Photo, Sheet, Stars, Check } from './ui.jsx';
import { CATEGORIES, ymd, addDays, today, dayLabel, dateShort, shopGroup, SHOP_ORDER, hashKey } from './lib/util.js';
import { scaleIngredient } from './lib/parse.js';

const photoOf = (r) => r?.photo || r?.photo_url;
const timeOf = (r) => r?.cook_time || r?.prep_time || '';

// ── Library ─────────────────────────────────────────────────────────────────
export function Library() {
  const { recipes, byId, plan, loading, go, update, offline, error, planAdd } = useApp();
  const [q, setQ] = useState(() => sessionStorage.getItem('lib.q') || '');
  const [cat, setCat] = useState(() => sessionStorage.getItem('lib.cat') || 'All');
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState('new');
  const [picking, setPicking] = useState(false);
  useEffect(() => { sessionStorage.setItem('lib.q', q); sessionStorage.setItem('lib.cat', cat); }, [q, cat]);

  const tonightIds = (plan[ymd(today())] || []).filter((id) => byId[id]);
  const filtering = q || cat !== 'All' || favOnly;

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
          <h1 className="serif">Our Recipes</h1>
          <div className="sub">{recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}{offline ? ', offline for now' : ''}</div>
        </div>
      </div>
      <div className="screen stack">
        {error && <div className="banner">Can't reach the database ({error.code || error.message}). Check the Firestore rules.</div>}

        {!loading && recipes.length > 0 && !filtering && (
          tonightIds.length ? (
            <button className="tonight" onClick={() => go({ name: 'recipe', id: tonightIds[0] })}>
              <Photo src={photoOf(byId[tonightIds[0]])} iconSize={44} />
              <div className="cap">
                <span className="when">Tonight</span>
                <h2 className="serif">{byId[tonightIds[0]].title}</h2>
                <div className="more">
                  {timeOf(byId[tonightIds[0]]) || `${byId[tonightIds[0]].ingredients?.length || 0} ingredients`}
                  {tonightIds.length > 1 && `, plus ${tonightIds.length - 1} more`}
                </div>
              </div>
            </button>
          ) : (
            <button className="tonight-empty" onClick={() => setPicking(true)}>
              <span className="ic"><Icon name="moon" /></span>
              <span style={{ flex: 1 }}><b>Nothing planned for tonight</b><span className="small muted">Pick a recipe and it goes into the planner and shopping list.</span></span>
              <Icon name="chevR" size={20} />
            </button>
          )
        )}

        <div className="row">
          <div className="search">
            <Icon name="search" size={18} />
            <input className="input" type="search" placeholder="Search by name or ingredient" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className={`icon-btn ${favOnly ? 'on' : ''}`} style={{ width: 48, height: 48 }} onClick={() => setFavOnly(!favOnly)}
            aria-pressed={favOnly} aria-label="Show favourites only">
            <Icon name="heart" fill={favOnly} />
          </button>
        </div>
        <div className="chips" role="tablist" aria-label="Category">
          {['All', ...CATEGORIES].map((c) => (
            <button key={c} role="tab" aria-selected={cat === c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>

        {loading ? <div className="empty"><div className="spin" style={{ margin: '0 auto' }} /></div>
          : !recipes.length ? (
            <div className="empty">
              <div className="serif">Your cookbook is empty</div>
              <p>Add a recipe from a link, a caption or a photo.</p>
              <button className="btn primary" onClick={() => go({ name: 'add' })}><Icon name="plus" size={18} /> Add your first recipe</button>
              <p className="small" style={{ marginTop: 16 }}>Recipes in the old app? Import them under Settings.</p>
            </div>
          ) : (
            <>
              <div className="section-label" style={{ marginTop: 6 }}>
                <span>{favOnly ? 'Favourites' : cat === 'All' ? 'All recipes' : cat}</span>
                <span className="count">{list.length}</span>
                <span className="spacer" />
                <select className="select" style={{ width: 'auto', minHeight: 38, padding: '6px 34px 6px 12px', fontSize: 14, backgroundPosition: 'calc(100% - 18px) 16px, calc(100% - 13px) 16px' }}
                  value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
                  <option value="new">Newest first</option><option value="az">A to Z</option><option value="rating">Best rated</option>
                </select>
              </div>
              {!list.length ? <div className="empty">No recipes match. Try another word or category.</div> : (
                <div className="cards">
                  {list.map((r) => (
                    <div key={r.id} className="rcard" role="button" tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && go({ name: 'recipe', id: r.id })}
                      onClick={() => go({ name: 'recipe', id: r.id })}>
                      <Photo src={photoOf(r)} />
                      <button className={`fav ${r.is_favourite ? 'on' : ''}`} aria-label={r.is_favourite ? 'Remove from favourites' : 'Add to favourites'}
                        onClick={(e) => { e.stopPropagation(); update(r.id, { is_favourite: !r.is_favourite }); }}>
                        <Icon name="heart" size={18} fill={r.is_favourite} />
                      </button>
                      <div className="body">
                        <div className="t">{r.title}</div>
                        <div className="m">
                          {timeOf(r) ? <span className="row" style={{ gap: 4 }}><Icon name="clock" size={14} />{timeOf(r)}</span> : <span>{r.category}</span>}
                          {r.rating > 0 && <span className="star">★ {r.rating}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
      </div>
      {picking && <RecipePicker title="Cook tonight" onClose={() => setPicking(false)} onPick={(id) => { planAdd(ymd(today()), id); setPicking(false); }} />}
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
  if (!r) return <div className="screen no-nav"><div className="topbar"><button className="icon-btn" onClick={back} aria-label="Back"><Icon name="back" /></button></div><div className="empty">This recipe was deleted.</div></div>;

  const factor = servings / (r.servings || 2);
  const ings = (r.ingredients || []).map((i) => scaleIngredient(i, factor));

  return (
    <div className="screen no-nav">
      <div className="hero">
        <Photo src={photoOf(r)} iconSize={52} />
        <div className="hero-bar">
          <button className="icon-btn" onClick={back} aria-label="Back"><Icon name="back" /></button>
          <span className="spacer" />
          <button className="icon-btn" style={r.is_favourite ? { color: 'var(--heart)' } : null}
            onClick={() => update(r.id, { is_favourite: !r.is_favourite })} aria-label={r.is_favourite ? 'Remove from favourites' : 'Add to favourites'}>
            <Icon name="heart" fill={r.is_favourite} />
          </button>
          <button className="icon-btn" onClick={() => setSheet('more')} aria-label="Recipe options"><Icon name="dots" /></button>
        </div>
      </div>
      <div className="stack" style={{ position: 'relative', zIndex: 2, marginTop: -18 }}>
        <div className="meta">
          <span className="tag">{r.category}</span>
          {r.prep_time && <span className="tag"><Icon name="clock" size={14} /> Prep {r.prep_time}</span>}
          {r.cook_time && <span className="tag"><Icon name="pot" size={14} /> {r.cook_time}</span>}
        </div>
        <h1 className="serif r-title">{r.title}</h1>
        <Stars value={r.rating || 0} onChange={(v) => update(r.id, { rating: v })} size={24} />
        <div className="actions">
          <button className="primary" onClick={() => go({ name: 'cook', id: r.id, servings })} disabled={!r.steps?.length}><Icon name="play" size={20} />Start cooking</button>
          <button onClick={() => setSheet('plan')}><Icon name="cal" />Plan</button>
          <button onClick={() => { shopAdd(ings); toast(`Added ${ings.length} items to shopping`); }} disabled={!ings.length}><Icon name="cart" />To list</button>
          <button onClick={() => go({ name: 'edit', id: r.id })}><Icon name="edit" />Edit</button>
        </div>

        <div className="r-section">
          <h2 className="serif">Ingredients</h2>
          <span className="stepper" aria-label="Servings">
            <button onClick={() => setServings(Math.max(1, servings - 1))} aria-label="Fewer servings">−</button>
            <b>{servings} {servings === 1 ? 'serving' : 'servings'}</b>
            <button onClick={() => setServings(servings + 1)} aria-label="More servings">+</button>
          </span>
        </div>
        {ings.length ? (
          <ul className="ing">
            {ings.map((t, i) => (
              <li key={i} className={done[i] ? 'done' : ''} onClick={() => setDone({ ...done, [i]: !done[i] })}>
                <Check on={done[i]} /><span>{t}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted">No ingredients yet. Tap Edit to add them.</p>}

        <div className="r-section"><h2 className="serif">Method</h2></div>
        {r.steps?.length ? <ol className="steps">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          : <p className="muted">No steps yet. Tap Edit to add them.</p>}

        <div className="r-section"><h2 className="serif">Our notes</h2></div>
        <textarea className="textarea" style={{ minHeight: 90 }} placeholder="What worked, what to change next time"
          value={notes} onChange={(e) => setNotes(e.target.value)}
          onBlur={() => { if (notes !== (r.notes || '')) { update(r.id, { notes }); toast('Notes saved'); } }} />
        {r.source_url && (
          <a className="btn outline block" href={r.source_url} target="_blank" rel="noreferrer"><Icon name="link" size={18} /> Open the original recipe</a>
        )}
      </div>

      {sheet === 'plan' && <PlanSheet recipe={r} onClose={() => setSheet(null)} />}
      {sheet === 'more' && (
        <Sheet title={r.title} onClose={() => setSheet(null)}>
          <button className="menu-item" onClick={() => { setSheet(null); go({ name: 'edit', id: r.id }); }}><Icon name="edit" /> Edit recipe</button>
          <button className="menu-item" onClick={() => setSheet('plan')}><Icon name="cal" /> Add to planner</button>
          <button className="menu-item danger" onClick={() => {
            if (confirm(`Delete "${r.title}"? This can't be undone.`)) { deleteRecipe(r); back(); toast('Recipe deleted'); }
          }}><Icon name="trash" /> Delete recipe</button>
        </Sheet>
      )}
    </div>
  );
}

function PlanSheet({ recipe, onClose }) {
  const { plan, planAdd, toast } = useApp();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today(), i));
  return (
    <Sheet title="Which day?" onClose={onClose}>
      <div className="grid3">
        {days.map((d) => {
          const key = ymd(d);
          const has = (plan[key] || []).includes(recipe.id);
          return (
            <button key={key} className={`btn ${has ? 'primary' : ''}`} style={{ flexDirection: 'column', gap: 0, padding: 10, minHeight: 60 }}
              onClick={() => { planAdd(key, recipe.id); toast(`Planned for ${dayLabel(d).toLowerCase()}, ${dateShort(d)}`); onClose(); }}>
              <span>{dayLabel(d)}</span><span className="small" style={{ opacity: .8, fontWeight: 500 }}>{dateShort(d)}</span>
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
      <div className="row" style={{ gap: 12 }}>
        <button className="icon-btn" onClick={back} aria-label="Stop cooking"><Icon name="x" /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>{r.title}</div>
          <div className="progress" style={{ marginTop: 7 }}><div style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
        </div>
        <button className="btn sm" onClick={() => setShowIng(true)}><Icon name="list" size={18} /> Ingredients</button>
      </div>
      <div className="cook-step" onClick={(e) => { if (e.clientX > window.innerWidth / 2) { if (!last) setI(i + 1); } else if (i > 0) setI(i - 1); }}>
        <div className="n">Step {i + 1} of {steps.length}</div>
        <p>{steps[i]}</p>
        {i === 0 && <div className="hint">Tap the right side for the next step, the left side to go back. The screen stays on.</div>}
      </div>
      <div className="grid2">
        <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}><Icon name="chevL" size={18} /> Previous</button>
        {last ? <button className="btn primary" onClick={back}><Icon name="check" size={18} /> Finished</button>
          : <button className="btn primary" onClick={() => setI(i + 1)}>Next step <Icon name="chevR" size={18} /></button>}
      </div>
      {showIng && (
        <Sheet title="Ingredients" onClose={() => setShowIng(false)}>
          <ul className="ing">{(r.ingredients || []).map((t, k) => <li key={k} style={{ cursor: 'default' }}>{scaleIngredient(t, factor)}</li>)}</ul>
        </Sheet>
      )}
    </div>
  );
}

// ── Planner ─────────────────────────────────────────────────────────────────
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function Planner() {
  const { plan, byId, go, planRemove, planAdd } = useApp();
  const [picking, setPicking] = useState(null);
  const [past, setPast] = useState(false);
  const start = past ? -7 : 0;
  const days = Array.from({ length: 14 - start }, (_, i) => addDays(today(), start + i));
  const t = ymd(today());
  const plannedCount = days.filter((d) => ymd(d) >= t && (plan[ymd(d)] || []).some((x) => byId[x])).length;
  return (
    <>
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h1 className="serif">Planner</h1>
          <div className="sub">{plannedCount ? `${plannedCount} of the next 14 days planned` : 'Nothing planned yet'}</div>
        </div>
        <button className="btn sm outline" onClick={() => setPast(!past)}>{past ? 'Hide last week' : 'Last week'}</button>
      </div>
      <div className="screen">
        {days.map((d) => {
          const key = ymd(d);
          const ids = (plan[key] || []).filter((x) => byId[x]);
          const rel = dayLabel(d);
          return (
            <div key={key} className={`day ${key === t ? 'today' : ''} ${key < t ? 'past' : ''}`}>
              <div className="date"><div className="dow">{DOW[d.getDay()]}</div><div className="dnum">{d.getDate()}</div></div>
              <div className="slot">
                {['Today', 'Tomorrow', 'Yesterday'].includes(rel) && <div className="rel">{rel}</div>}
                {ids.map((rid) => (
                  <div key={rid} className="planned">
                    <Photo src={photoOf(byId[rid])} iconSize={18} />
                    <button className="t" onClick={() => go({ name: 'recipe', id: rid })}>{byId[rid].title}</button>
                    <button className="icon-btn" style={{ width: 38, height: 38, background: 'transparent', borderColor: 'transparent' }}
                      onClick={() => planRemove(key, rid)} aria-label={`Remove ${byId[rid].title}`}>
                      <Icon name="x" size={18} />
                    </button>
                  </div>
                ))}
                {ids.length ? (
                  <button className="btn ghost sm" style={{ alignSelf: 'flex-start', paddingLeft: 4 }} onClick={() => setPicking(key)}>
                    <Icon name="plus" size={16} /> Add another
                  </button>
                ) : (
                  <button className="add-slot" onClick={() => setPicking(key)}><Icon name="plus" size={18} /> Add a recipe</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {picking && <RecipePicker title={`${dayLabel(picking)}, ${dateShort(picking)}`} onClose={() => setPicking(null)} onPick={(id) => { planAdd(picking, id); setPicking(null); }} />}
    </>
  );
}

function RecipePicker({ title = 'Pick a recipe', onPick, onClose }) {
  const { recipes } = useApp();
  const [q, setQ] = useState('');
  const l = recipes.filter((r) => r.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="search" style={{ marginBottom: 4 }}>
        <Icon name="search" size={18} />
        <input className="input" placeholder="Search recipes" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {l.map((r) => (
        <button key={r.id} className="planned" style={{ marginTop: 8 }} onClick={() => onPick(r.id)}>
          <Photo src={photoOf(r)} iconSize={18} /><span className="t">{r.title}</span><Icon name="plus" size={20} />
        </button>
      ))}
      {!l.length && <p className="muted center" style={{ padding: 20 }}>{recipes.length ? 'No recipes match.' : 'Add a recipe first.'}</p>}
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
        r?.ingredients?.forEach((ing, n) => items.push({ key: hashKey(`${key}|${rid}|${n}|${ing}`), text: ing, from: `${r.title}, ${dayLabel(key).toLowerCase()}` }));
      });
    }
    return items;
  }, [plan, byId, days]);

  // Same ingredient line from several planned meals becomes one row
  const merged = useMemo(() => {
    const m = new Map();
    planned.forEach((x) => {
      const k = x.text.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!m.has(k)) m.set(k, { id: k, text: x.text, keys: [], from: [] });
      const e = m.get(k); e.keys.push(x.key); e.from.push(x.from);
    });
    return [...m.values()];
  }, [planned]);
  const isOn = (e) => e.keys.every((k) => ticks.has(k));

  const groups = useMemo(() => {
    const g = {};
    merged.forEach((x) => (g[shopGroup(x.text)] ||= []).push(x));
    return SHOP_ORDER.filter((k) => g[k]).map((k) => [k, g[k]]);
  }, [merged]);

  const doneCount = merged.filter(isOn).length + manual.filter((m) => m.ticked).length;
  const total = merged.length + manual.length;

  const add = () => {
    const t = text.split(/\n|,\s*(?=\D)/).map((x) => x.trim()).filter(Boolean);
    if (t.length) shopAdd(t);
    setText('');
  };
  const clearDone = () => {
    const live = new Set(planned.map((x) => x.key));
    shopping.forEach((s) => { if ((s.tick && !live.has(s.id)) || (s.manual && s.ticked)) shopRemove(s.id); });
    toast('Removed ticked items');
  };

  return (
    <>
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h1 className="serif">Shopping</h1>
          <div className="sub">{total ? `${total - doneCount} left to get` : 'From your planner and your own items'}</div>
        </div>
      </div>
      <div className="screen stack">
        <div className="seg" role="tablist" aria-label="Plan period">
          {[3, 7, 14].map((n) => (
            <button key={n} role="tab" aria-selected={days === n} className={days === n ? 'on' : ''} onClick={() => setDays(n)}>Next {n} days</button>
          ))}
        </div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input className="input" placeholder="Add something, like milk or bread" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn primary" style={{ width: 52, padding: 0, flexShrink: 0 }} aria-label="Add item"><Icon name="plus" /></button>
        </form>
        {total > 0 && (
          <div className="shop-progress">
            <div className="progress"><div style={{ width: `${(doneCount / total) * 100}%` }} /></div>
            <span className="small muted">{doneCount} of {total}</span>
          </div>
        )}

        {!total && (
          <div className="empty">
            <div className="serif">Nothing to buy yet</div>
            <p>Plan a few dinners and their ingredients appear here, sorted by aisle.</p>
          </div>
        )}

        {manual.length > 0 && (
          <div className="shop-group">
            <h3>Your items <span className="count">{manual.length}</span></h3>
            <div className="shop-list">
              {manual.map((m) => (
                <div key={m.id} className={`shop-item ${m.ticked ? 'done' : ''}`}>
                  <button className="row" style={{ flex: 1, textAlign: 'left', gap: 12 }} onClick={() => shopSet(m.id, { ticked: !m.ticked })}>
                    <Check on={m.ticked} /><span className="txt">{m.text}</span>
                  </button>
                  <button className="icon-btn" style={{ width: 36, height: 36, background: 'transparent', borderColor: 'transparent', color: 'var(--faint)' }}
                    onClick={() => shopRemove(m.id)} aria-label={`Remove ${m.text}`}><Icon name="x" size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {groups.map(([g, items]) => (
          <div key={g} className="shop-group">
            <h3>{g} <span className="count">{items.length}</span></h3>
            <div className="shop-list">
              {items.map((x) => {
                const on = isOn(x);
                return (
                  <button key={x.id} className={`shop-item ${on ? 'done' : ''}`} onClick={() => x.keys.forEach((k) => shopToggle(k, !on))}>
                    <Check on={on} />
                    <span style={{ flex: 1 }}>
                      <span className="txt">{x.keys.length > 1 && <b style={{ color: 'var(--saffron)' }}>{x.keys.length}× </b>}{x.text}</span>
                      <span className="from">{x.from.length > 1 ? `For ${x.from.length} meals: ${x.from.map((f) => f.split(',')[0]).join(', ')}` : x.from[0]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {manual.some((m) => m.ticked) && <button className="btn outline block" style={{ marginTop: 20 }} onClick={clearDone}>Remove ticked items</button>}
      </div>
    </>
  );
}
