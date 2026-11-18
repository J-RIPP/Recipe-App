import { useMemo, useState } from 'react';
import { useApp } from './App.jsx';
import { Icon, Photo, MacroBars, MacroLine } from './ui.jsx';
import { CATEGORIES, ymd, addDays, today, dayLabel, dateShort } from './lib/util.js';
import { generatePlan, mealTarget, macroFit, summarize, nextDates } from './lib/planner.js';
import { macrosOf } from './lib/nutrition.js';
import { t } from './lib/i18n.js';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FOCUS = [['balanced', 'Balanced'], ['protein', 'Protein'], ['favourites', 'Favourites'], ['variety', 'Variety']];
const fitClass = (f) => (f == null ? '' : f >= 0.7 ? 'good' : f >= 0.4 ? 'ok' : 'off');

function startDate(kind) {
  const t = today();
  if (kind === 'today') return t;
  if (kind === 'tomorrow') return addDays(t, 1);
  const d = (8 - t.getDay()) % 7 || 7; // next Monday
  return addDays(t, d);
}

export function WeekPlan() {
  const { recipes, byId, plan, back, planMany, toast, targets, personIdx, setPersonIdx, go } = useApp();
  const [start, setStart] = useState('tomorrow');
  const [len, setLen] = useState(7);
  const [cats, setCats] = useState(['Dinner']);
  const [prefer, setPrefer] = useState('balanced');
  const [gap, setGap] = useState(() => +(localStorage.getItem('wp.gap') || 1));
  const [picks, setPicks] = useState(null);
  const [notes, setNotes] = useState([]);

  const dates = useMemo(() => nextDates(startDate(start), len), [start, len]);
  const target = mealTarget(targets, personIdx);
  const lockedDates = dates.filter((d) => (plan[d] || []).some((id) => byId[id]));
  const openDates = dates.filter((d) => !lockedDates.includes(d));

  const run = (fixed = {}, only = openDates, avoid = []) => {
    localStorage.setItem('wp.gap', gap);
    const res = generatePlan({ recipes, plan, dates: only, gap, categories: cats, prefer, target, fixed, avoid, seed: Math.floor(Math.random() * 1e9) });
    return res;
  };
  const make = () => { const r = run(); setPicks(r.picks); setNotes(r.notes); };
  const swap = (date) => {
    const rest = { ...picks }; const cur = rest[date]; delete rest[date];
    const r = run(rest, [date], cur ? [cur] : []);
    if (r.picks[date]) setPicks(r.picks); else toast(t("No other recipe fits that day"));
  };
  const drop = (date) => { const p = { ...picks }; delete p[date]; setPicks(p); };
  const confirm = () => {
    planMany(picks);
    toast(t('Planned {n} meals', { n: Object.keys(picks).length }));
    back();
  };

  const sum = picks ? summarize(picks, byId) : null;
  const toggleCat = (c) => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c]);

  return (
    <>
      <div className="topbar compact">
        <button className="icon-btn" onClick={back} aria-label={t("Back")}><Icon name="back" /></button>
        <h1 className="serif">{t("Plan a week")}</h1>
      </div>
      <div className="screen no-nav stack" style={{ paddingTop: 16 }}>
        {!picks ? (
          <>
            <div className="card stack">
              <div className="field"><span>{t("Starting")}</span>
                <div className="seg">
                  {[['today', 'Today'], ['tomorrow', 'Tomorrow'], ['monday', 'Next Monday']].map(([k, l]) => (
                    <button key={k} className={start === k ? 'on' : ''} onClick={() => setStart(k)}>{t(l)}</button>
                  ))}
                </div>
              </div>
              <div className="field"><span>{t("How many days")}</span>
                <div className="seg">
                  {[3, 5, 7].map((n) => <button key={n} className={len === n ? 'on' : ''} onClick={() => setLen(n)}>{t('{n} days', { n })}</button>)}
                </div>
              </div>
            </div>

            <details className="more card">
              <summary><Icon name="chevR" size={18} /> {t("More options")}</summary>
              <div className="stack" style={{ marginTop: 10 }}>
                <div className="field"><span>{t("Meals from")}</span>
                  <div className="chips" style={{ margin: 0, padding: 0, flexWrap: 'wrap' }}>
                    {CATEGORIES.map((c) => <button key={c} className={`chip ${cats.includes(c) ? 'on' : ''}`} onClick={() => toggleCat(c)}>{t(c)}</button>)}
                  </div>
                </div>
                <div className="field"><span>{t("Focus")}</span>
                  <div className="chips" style={{ margin: 0, padding: 0, flexWrap: 'wrap' }}>
                    {FOCUS.map(([k, l]) => <button key={k} className={`chip ${prefer === k ? 'on' : ''}`} onClick={() => setPrefer(k)}>{t(l)}</button>)}
                  </div>
                </div>
                <div className="opt-row">
                  <span>{t("Days between repeats")}<em>{t("The same recipe never comes back sooner")}</em></span>
                  <span className="stepper">
                    <button onClick={() => setGap(Math.max(1, gap - 1))} aria-label={t("Fewer days")}>−</button>
                    <b>{gap === 1 ? t('1 day') : t('{n} days', { n: gap })}</b>
                    <button onClick={() => setGap(Math.min(13, gap + 1))} aria-label={t("More days")}>+</button>
                  </span>
                </div>
                <div className="macro-card" style={{ boxShadow: 'none', background: 'var(--bg)' }}>
                  <div className="head">
                    <b>{t("Target per dinner")}</b>
                    {targets.people.length > 1 && (
                      <span className="person-seg">
                        {targets.people.map((p, i) => <button key={i} className={personIdx === i ? 'on' : ''} onClick={() => setPersonIdx(i)}>{p.name}</button>)}
                      </span>
                    )}
                  </div>
                  <MacroBars m={target} t={null} />
                  <div className="macro-src">{t('{n}% of the daily targets.', { n: targets.dinnerShare })} <button className="btn ghost sm" style={{ padding: 0, minHeight: 0 }} onClick={() => go({ name: 'settings' })}>{t("Change targets")}</button></div>
                </div>
              </div>
            </details>

            {lockedDates.length > 0 && (
              <div className="banner ok">{lockedDates.length === dates.length ? t('All these days are already planned.') : t('{n} of these days already have a recipe. Those stay as they are.', { n: lockedDates.length })}</div>
            )}
            {recipes.length < 2 && <div className="banner">{t("Add at least two recipes to make a plan.")}</div>}
            <button className="btn primary block" onClick={make} disabled={recipes.length < 2 || !openDates.length}><Icon name="cal" size={18} /> {t("Make a plan")}</button>
          </>
        ) : (
          <>
            {sum && (
              <div className="macro-card">
                <div className="head"><b>{t("Average per dinner")}</b><span className="small muted">{t("{a} of {b} with macros", { a: sum.counted, b: Object.keys(picks).length })}</span></div>
                <MacroBars m={sum} t={target} />
              </div>
            )}
            {notes.map((n, i) => <div key={i} className="banner">{n}</div>)}
            <div>
              {dates.map((d) => {
                const dt = new Date(d + 'T12:00');
                const locked = lockedDates.includes(d) ? (plan[d] || []).filter((id) => byId[id]) : null;
                const id = picks[d];
                const r = id && byId[id];
                const m = r && macrosOf(r);
                const f = m ? macroFit(m, target) : null;
                return (
                  <div key={d} className="wp-day">
                    <div className="date" style={{ textAlign: 'center' }}>
                      <div className="small muted" style={{ fontWeight: 600 }}>{t(DOW[dt.getDay()])}</div>
                      <div className="serif" style={{ fontSize: 24, lineHeight: 1.1 }}>{dt.getDate()}</div>
                    </div>
                    {locked ? (
                      <div className="wp-row locked">
                        <Photo src={byId[locked[0]].photo || byId[locked[0]].photo_url} iconSize={18} />
                        <div className="info"><div className="t">{byId[locked[0]].title}</div><div className="small muted">{t("Already planned")}</div></div>
                      </div>
                    ) : r ? (
                      <div className="wp-row">
                        <Photo src={r.photo || r.photo_url} iconSize={18} />
                        <div className="info">
                          <div className="t">{r.title}</div>
                          <div className="row" style={{ gap: 6, marginTop: 2 }}>
                            {m ? <><span className={`fit-dot ${fitClass(f)}`} /><MacroLine m={m} /></> : <span className="small muted">{t("No macros")}</span>}
                          </div>
                        </div>
                        <button className="icon-btn" style={{ width: 40, height: 40 }} onClick={() => swap(d)} aria-label={`Swap ${r.title}`}><Icon name="shuffle" size={18} /></button>
                        <button className="icon-btn" style={{ width: 40, height: 40, background: 'transparent', borderColor: 'transparent' }} onClick={() => drop(d)} aria-label={t("Leave this day empty")}><Icon name="x" size={18} /></button>
                      </div>
                    ) : (
                      <button className="wp-row empty" onClick={() => swap(d)}><Icon name="plus" size={16} /> {t("Leave empty, or tap to pick something")}</button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="small muted">{t("Green dot: close to the target. Yellow: a bit off. Red: far off. Don't fancy one? Tap the swap button for another.")}</div>
            <div className="sticky-bar">
              <button className="btn" onClick={make}><Icon name="shuffle" size={18} /> {t("Shuffle")}</button>
              <button className="btn primary" style={{ flex: 1 }} onClick={confirm} disabled={!Object.keys(picks).length}>
                <Icon name="check" size={18} /> {t("Add {n} to the planner", { n: Object.keys(picks).length })}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
