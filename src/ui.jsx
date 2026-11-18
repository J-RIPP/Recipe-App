import { useEffect, useState } from 'react';
import { getBackend } from './lib/db.js';

const P = {
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zm0 16a2 2 0 0 1 2-2h13',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  cart: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2M9 20.5h.01M17 20.5h.01',
  plus: 'M12 5v14M5 12h14',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  back: 'M15 18l-6-6 6-6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 3l-4.3-4.3',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  play: 'M7 5v14l11-7z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  text: 'M5 6h14M5 10h14M5 14h10M5 18h7',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  pen: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-13v4.5l3 2',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14a6.5 6.5 0 0 1 3.5 6',
  leaf: 'M5 19c0-9 6-14 15-14 0 9-5 15-14 15M5 19c3-4 6-6.5 9-8',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  chevR: 'M9 6l6 6-6 6',
  chevL: 'M15 6l-6 6 6 6',
  clip: 'M9 4h6v3H9zM8 5.5H6v15h12v-15h-2',
  dots: 'M12 6h.01M12 12h.01M12 18h.01',
  out: 'M15 4h4v16h-4M10 16l4-4-4-4M14 12H4',
  cloud: 'M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z',
  shuffle: 'M16 4h4v4M4 20L20 4M20 16v4h-4M15 15l5 5M4 4l5 5',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  pot: 'M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2 10h20M9 6.5c0-1 1-1.5 1-2.5M14 6.5c0-1 1-1.5 1-2.5',
};

export function Icon({ name, size = 22, fill = false, stroke = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  );
}

export function Logo({ size = 36 }) {
  // DataIsCool glasses with a bar chart + gold trend line
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 48 48" aria-label="DataIsCool">
      <rect x="2" y="2" width="44" height="44" rx="12" fill="#27382f" stroke="#435a4c" />
      <g fill="none" stroke="#8ed18b" strokeWidth="2.4">
        <rect x="7" y="17" width="14" height="12" rx="4" />
        <rect x="27" y="17" width="14" height="12" rx="4" />
        <path d="M21 21.5c1.8-1.4 4.2-1.4 6 0" />
      </g>
      <g fill="#8ed18b">
        <rect x="10" y="23" width="2.4" height="4" rx="1" />
        <rect x="13.6" y="21" width="2.4" height="6" rx="1" />
        <rect x="30" y="22" width="2.4" height="5" rx="1" />
        <rect x="33.6" y="20" width="2.4" height="7" rx="1" />
      </g>
      <path d="M9 34l8-3 7 2 8-5 8-3" fill="none" stroke="#f0c05a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Forest() {
  return (
    <>
      <div className="glow" />
      <svg className="forest" viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden="true">
        <path fill="#25362d" opacity=".7" d="M0 220V150l60-30 30 15 40-50 30 25 40-60 30 35 40-45 30 30 40-55 30 35 40-40 30 30 40 30 30-30 40 40 40-55 30 30 40-50 40 35 40-60 30 40 40-30 30 30 40-50 40 40 40-35 30 30 40-60 40 45 40-40 30 25 40-30 40 40 40-55 30 35 40-25 40 30 40-45 30 30v120z" />
        <path fill="#18241e" d="M0 220v-40l20-15 20 15 15-30 15 20 15-35 15 25 15-30 15 20 20-25 20 30 20-20 20 30 25-35 20 25 20-15 25 30 20-40 20 30 25-25 20 20 25-35 20 30 20-15 25 25 20-30 20 25 25-35 20 30 25-20 20 25 25-30 25 30 20-25 25 30 20-35 20 30 25-20 25 25 20-35 25 30 20-15 25 25 20-30 20 25 25-35 20 30 25-20 20 25 25-30 20 25 25-35 20 30v60z" />
      </svg>
    </>
  );
}

// Photo: remote URL, or an image stored in the database ("img:<id>")
const imgCache = new Map();
export function Photo({ src, className = 'ph', style, iconSize = 28, fit = 'cover' }) {
  const [url, setUrl] = useState(() => (src?.startsWith('img:') ? imgCache.get(src) || '' : src || ''));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (!src) return setUrl('');
    if (!src.startsWith('img:')) return setUrl(src);
    if (imgCache.has(src)) return setUrl(imgCache.get(src));
    let alive = true;
    getBackend()?.get('images', src.slice(4)).then((d) => {
      if (d?.data) { imgCache.set(src, d.data); if (alive) setUrl(d.data); }
    }).catch(() => {});
    return () => { alive = false; };
  }, [src]);
  return (
    <div className={className} style={style}>
      <Icon name="leaf" size={iconSize} stroke={1.6} />
      {url && !failed && <img src={url} alt="" loading="lazy" style={{ objectFit: fit }} referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
    </div>
  );
}
export const cacheImage = (key, data) => imgCache.set(key, data);

export function Sheet({ title, onClose, children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {title && (
          <div className="sheet-h">
            <h2 className="serif">{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={20} /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function Stars({ value = 0, onChange, size = 22 }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} className={n <= value ? 'on' : ''} onClick={() => onChange?.(n === value ? 0 : n)} aria-label={`${n} stars`}>
          <Icon name="star" size={size} fill stroke={1} />
        </button>
      ))}
    </div>
  );
}

export function Check({ on }) {
  return <span className={`check ${on ? 'on' : ''}`}>{on && <Icon name="check" size={14} stroke={3} />}</span>;
}

// ── Macros ──────────────────────────────────────────────────────────────────
const MACROS = [['kcal', 'Calories', ''], ['protein', 'Protein', 'g'], ['carbs', 'Carbs', 'g'], ['fat', 'Fat', 'g']];

/** Compact one-liner, e.g. "620 kcal  38 g protein" */
export function MacroLine({ m, className = 'macro-line' }) {
  if (!m) return null;
  return <span className={className}><b>{m.kcal}</b> kcal <span className="sep" /> <b>{m.protein} g</b> protein</span>;
}

/** Four bars against a per-meal target. Protein bar is good when full; fat/kcal turn warm when over. */
export function MacroBars({ m, t }) {
  return (
    <div className="macro-bars">
      {MACROS.map(([k, label, unit]) => {
        const v = m?.[k] ?? 0, goal = t?.[k] || 0;
        const pct = goal ? Math.min(100, (v / goal) * 100) : 0;
        const over = goal && v > goal * 1.15 && k !== 'protein';
        const good = k === 'protein' ? v >= goal * 0.9 : goal && Math.abs(v - goal) <= goal * 0.15;
        return (
          <div key={k} className="mb">
            <div className="mb-top"><span>{label}</span><b>{v}{unit && ` ${unit}`}</b></div>
            <div className="mb-bar"><div className={over ? 'over' : good ? 'good' : ''} style={{ width: `${pct}%` }} /></div>
            {goal > 0 && <div className="mb-goal">of {goal}{unit && ` ${unit}`}</div>}
          </div>
        );
      })}
    </div>
  );
}
