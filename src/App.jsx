import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { getBackend, newId } from './lib/db.js';
import { Forest, Icon, Intro, cacheImage } from './ui.jsx';
import { Home, Library, RecipeView, Cook, Planner, Shopping } from './screens.jsx';
import { AddScreen, Editor, Settings, Setup, Login } from './forms.jsx';
import { WeekPlan } from './weekplan.jsx';
import { Welcome, NoAccess } from './welcome.jsx';
import { t } from './lib/i18n.js';
import { DEFAULT_TARGETS } from './lib/planner.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export default function App() {
  const [db, setDb] = useState(() => getBackend());
  if (!db) return <><Forest /><Setup onReady={() => setDb(getBackend())} /></>;
  return <Authed db={db} />;
}

function Authed({ db }) {
  const [user, setUser] = useState(undefined);
  useEffect(() => db.onAuth(setUser), [db]);
  if (user === undefined) return <div className="auth center"><div className="spin" style={{ margin: '0 auto' }} /></div>;
  if (!user) return <><Forest /><Login db={db} /></>;
  return <Main db={db} user={user} />;
}

function useCollection(db, name) {
  const [state, setState] = useState({ items: null, offline: false, error: null });
  useEffect(() => db.subscribe(name,
    (items, offline) => setState({ items, offline, error: null }),
    (error) => setState((s) => ({ ...s, items: s.items || [], error }))), [db, name]);
  return state;
}

function Main({ db, user }) {
  const r = useCollection(db, 'recipes');
  const p = useCollection(db, 'plan');
  const s = useCollection(db, 'shopping');
  const st = useCollection(db, 'settings');
  const [stack, setStack] = useState([{ name: 'tabs', tab: 'home' }]);
  const [welcomed, setWelcomed] = useState(() => !!localStorage.getItem('or.welcomed'));
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef();

  // toast('Saved') or toast('Removed', { label: 'Undo', run: () => ... })
  const toast = useCallback((m, action) => {
    setToastMsg({ text: m, action }); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), action ? 5000 : 2600);
  }, []);
  const go = useCallback((screen) => setStack((st) => [...st, screen]), []);
  const back = useCallback(() => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st)), []);
  const setTab = (tab) => setStack([{ name: 'tabs', tab }]);
  const replace = useCallback((screen) => setStack((st) => [...st.slice(0, -1), screen]), []);

  // Android back button
  const stackRef = useRef(stack); stackRef.current = stack;
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const h = CapApp.addListener('backButton', () => {
      if (document.querySelector('.overlay')) { document.querySelector('.overlay').click(); return; }
      const st = stackRef.current;
      if (st.length > 1) back();
      else if (st[0].tab !== 'home') setTab('home');
      else CapApp.minimizeApp();
    });
    return () => { h.then((x) => x.remove()); };
  }, [back]);

  const recipes = useMemo(() => [...(r.items || [])].sort((a, b) => (b.created_at || 0) - (a.created_at || 0)), [r.items]);
  const byId = useMemo(() => Object.fromEntries(recipes.map((x) => [x.id, x])), [recipes]);
  const plan = useMemo(() => Object.fromEntries((p.items || []).map((d) => [d.id, d.recipes || []])), [p.items]);
  const targets = useMemo(() => {
    const t = (st.items || []).find((x) => x.id === 'macros');
    return t?.people?.length ? { people: t.people, dinnerShare: t.dinnerShare ?? DEFAULT_TARGETS.dinnerShare } : DEFAULT_TARGETS;
  }, [st.items]);
  const [personIdx, setPersonIdx] = useState(() => +(localStorage.getItem('or.person') || 0));
  useEffect(() => localStorage.setItem('or.person', personIdx), [personIdx]);

  const actions = useMemo(() => ({
    async saveRecipe(draft) {
      const id = draft.id || newId();
      const { photoData, id: _, ...rest } = draft;
      let photo = rest.photo || '';
      if (photoData) {
        const imgId = newId();
        await db.set('images', imgId, { data: photoData }, false);
        cacheImage('img:' + imgId, photoData);
        if (photo.startsWith('img:')) db.remove('images', photo.slice(4));
        photo = 'img:' + imgId;
      }
      const data = { ...rest, photo, updated_at: Date.now() };
      if (!draft.id) data.created_at = Date.now();
      db.set('recipes', id, data, true);
      return id;
    },
    update: (id, patch) => db.set('recipes', id, { ...patch, updated_at: Date.now() }, true),
    // Photo is kept so Undo can bring the recipe back complete
    deleteRecipe(rec) {
      const { id, ...data } = rec;
      const planned = Object.entries(plan).filter(([, ids]) => ids.includes(id));
      db.remove('recipes', id);
      planned.forEach(([date, ids]) => db.set('plan', date, { recipes: ids.filter((x) => x !== id) }, true));
      return () => {
        db.set('recipes', id, data, false);
        planned.forEach(([date, ids]) => db.set('plan', date, { recipes: ids }, true));
      };
    },
    planAdd(date, id) {
      const cur = plan[date] || [];
      if (!cur.includes(id)) db.set('plan', date, { recipes: [...cur, id] }, true);
    },
    planRemove(date, id) {
      const before = plan[date] || [];
      db.set('plan', date, { recipes: before.filter((x) => x !== id) }, true);
      return () => db.set('plan', date, { recipes: before }, true);
    },
    shopToggle(key, on) {
      if (on) db.set('shopping', key, { tick: true, at: Date.now() }, true);
      else db.remove('shopping', key);
    },
    shopAdd(texts) {
      texts.forEach((text) => db.set('shopping', newId(), { text, manual: true, ticked: false, at: Date.now() }, false));
    },
    shopSet: (id, data) => db.set('shopping', id, data, true),
    shopRemove: (id) => db.remove('shopping', id),
    shopRestore: (items) => items.forEach(({ id, ...d }) => db.set('shopping', id, d, false)),
    saveTargets: (t) => db.set('settings', 'macros', t, false),
    planMany(picks) {
      Object.entries(picks).forEach(([date, id]) => {
        const cur = plan[date] || [];
        if (!cur.includes(id)) db.set('plan', date, { recipes: [...cur, id] }, true);
      });
    },
  }), [db, plan]);

  const ctx = {
    db, user, recipes, byId, plan, shopping: s.items || [], targets, personIdx: Math.min(personIdx, targets.people.length - 1), setPersonIdx, loading: r.items === null,
    offline: r.offline, error: r.error, go, back, replace, toast, ...actions,
  };

  if (r.error?.code === 'permission-denied') return <NoAccess db={db} user={user} />;
  const replayWelcome = () => setWelcomed(false);
  ctx.replayWelcome = replayWelcome;

  const top = stack[stack.length - 1];
  const tab = stack[0].tab;
  let screen;
  switch (top.name) {
    case 'recipe': screen = <RecipeView id={top.id} />; break;
    case 'cook': screen = <Cook id={top.id} servings={top.servings} />; break;
    case 'edit': screen = <Editor key={top.key || top.id || 'new'} id={top.id} draft={top.draft} note={top.note} />; break;
    case 'add': screen = <AddScreen />; break;
    case 'settings': screen = <Settings />; break;
    case 'weekplan': screen = <WeekPlan />; break;
    default:
      screen = tab === 'plan' ? <Planner /> : tab === 'shop' ? <Shopping /> : tab === 'library' ? <Library /> : <Home setTab={setTab} />;
  }
  const showNav = top.name === 'tabs';

  return (
    <Ctx.Provider value={ctx}>
      <Forest />
      <div className="app">{screen}</div>
      {showNav && (
        <nav className="nav"><div className="nav-inner">
          <NavBtn on={tab === 'home'} icon="home" label={t('Home')} onClick={() => setTab('home')} />
          <NavBtn on={tab === 'library'} icon="book" label={t('Recipes')} onClick={() => setTab('library')} />
          <button className="add-btn" onClick={() => go({ name: 'add' })} aria-label={t('Add recipe')}>
            <span className="pill-ic"><Icon name="plus" size={26} stroke={2.6} /></span>
          </button>
          <NavBtn on={tab === 'plan'} icon="cal" label={t('Planner')} onClick={() => setTab('plan')} />
          <NavBtn on={tab === 'shop'} icon="cart" label={t('Shopping')} onClick={() => setTab('shop')} />
        </div></nav>
      )}
      <Intro />
      {toastMsg && (
        <div className="toast" role="status" style={showNav ? null : { bottom: 92 }}>
          {toastMsg.text}
          {toastMsg.action && <button className="toast-action" onClick={() => { toastMsg.action.run(); setToastMsg(''); }}>{toastMsg.action.label}</button>}
        </div>
      )}
      {!welcomed && <Welcome onDone={() => { localStorage.setItem('or.welcomed', '1'); setWelcomed(true); }} />}
    </Ctx.Provider>
  );
}

function NavBtn({ on, icon, label, onClick }) {
  return (
    <button className={on ? 'on' : ''} onClick={onClick} aria-current={on ? 'page' : undefined}>
      <span className="pill-ic"><Icon name={icon} size={22} /></span>{label}
    </button>
  );
}
