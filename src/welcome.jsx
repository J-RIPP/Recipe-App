import { useState } from 'react';
import { useApp } from './App.jsx';
import { Icon, Mark } from './ui.jsx';
import { t, getLang, setLang } from './lib/i18n.js';

/** First-run tour: language, who uses this phone, then four short slides. Re-open from Settings. */
export function Welcome({ onDone }) {
  const { targets, personIdx, setPersonIdx } = useApp();
  const [i, setI] = useState(0);
  const lang = getLang();

  const slides = [
    {
      art: <div className="art" style={{ background: 'var(--leaf-deep)' }}><Mark size={110} className="" animated /></div>,
      title: t('Welcome to Our Recipes'),
      body: t('Your shared cookbook. Everything you add shows up on both phones straight away.'),
      extra: (
        <div className="choice" role="radiogroup" aria-label="Language">
          {[['nl', 'Nederlands'], ['en', 'English']].map(([k, l]) => (
            <button key={k} role="radio" aria-checked={lang === k} className={lang === k ? 'on' : ''} onClick={() => lang !== k && setLang(k)}>
              {l}{lang === k && <span className="tick"><Icon name="check" /></span>}
            </button>
          ))}
        </div>
      ),
    },
    targets.people.length > 1 && {
      art: <Art main="users" a="heart" b="leaf" />,
      title: t('Who uses this phone?'),
      body: t('So calories and protein are compared with your own targets.'),
      extra: (
        <div className="choice" role="radiogroup">
          {targets.people.map((p, k) => (
            <button key={k} role="radio" aria-checked={personIdx === k} className={personIdx === k ? 'on' : ''} onClick={() => setPersonIdx(k)}>
              {p.name}{personIdx === k && <span className="tick"><Icon name="check" /></span>}
            </button>
          ))}
        </div>
      ),
    },
    {
      art: <Art main="plus" a="link" b="camera" />,
      title: t('Add recipes your way'),
      body: t('Tap the green + at the bottom.'),
      points: [['link', t('Paste a link from a recipe website')], ['text', t('Paste the text of an Instagram or TikTok post')], ['camera', t('Take a photo of a recipe card')]],
    },
    {
      art: <Art main="cal" a="shuffle" b="moon" />,
      title: t('Plan the week in one tap'),
      body: t('Tap Plan my week and the app picks dinners for you: no recipe two days in a row, and close to your calorie and protein targets. Swap anything you don\'t fancy.'),
    },
    {
      art: <Art main="cart" a="check" b="list" />,
      title: t('The shopping list fills itself'),
      body: t('Everything you plan ends up on the list, sorted by aisle. Tick things off in the shop; the other phone sees it too.'),
    },
    {
      art: <Art main="play" a="clock" b="users" />,
      title: t('Cook step by step'),
      body: t('Open a recipe and tap Start cooking. Big text, one step at a time, and the screen stays on.'),
    },
  ].filter(Boolean);

  const s = slides[i];
  const last = i === slides.length - 1;
  return (
    <div className="welcome" role="dialog" aria-label={t('How the app works')}>
      <button className="skip" onClick={onDone}>{last ? '' : t('Skip')}</button>
      <div className="slide" key={i}>
        {s.art}
        <h1 className="serif">{s.title}</h1>
        <p>{s.body}</p>
        {s.points && <div className="points">{s.points.map(([ic, txt]) => <div key={ic}><span className="ic"><Icon name={ic} size={20} /></span>{txt}</div>)}</div>}
        {s.extra}
      </div>
      <div className="dots" aria-hidden="true">{slides.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
      <div className="row" style={{ gap: 10 }}>
        {i > 0 && <button className="btn" style={{ width: 56, padding: 0 }} onClick={() => setI(i - 1)} aria-label={t('Back')}><Icon name="chevL" /></button>}
        <button className="btn primary" style={{ flex: 1 }} onClick={() => (last ? onDone() : setI(i + 1))}>
          {last ? t("Let's cook") : t('Next')} {!last && <Icon name="chevR" size={18} />}
        </button>
      </div>
    </div>
  );
}

function Art({ main, a, b }) {
  return (
    <div className="art" style={{ background: 'var(--sage-soft)', color: 'var(--leaf)' }}>
      <Icon name={main} size={64} stroke={1.7} />
      <span className="bub" style={{ top: -10, right: -14, color: 'var(--saffron)' }}><Icon name={a} size={24} /></span>
      <span className="bub" style={{ bottom: -8, left: -16, color: 'var(--heart)' }}><Icon name={b} size={24} /></span>
    </div>
  );
}

/** Signed in, but the database rules don't include this email yet. */
export function NoAccess({ db, user }) {
  return (
    <div className="app"><div className="auth stack">
      <Mark size={64} />
      <h1 className="serif">{t('Almost there')}</h1>
      <p className="muted">{t('Your account works, but it hasn\'t been added to the cookbook yet. Ask the person who set it up to add this email:')}</p>
      <div className="code" style={{ fontSize: 16, fontFamily: 'inherit', fontWeight: 700, textAlign: 'center' }}>{user.email}</div>
      <p className="small muted">{t('They add it in Firebase under Firestore › Rules. Then close and reopen the app.')}</p>
      <button className="btn primary block" onClick={() => location.reload()}><Icon name="check" size={18} /> {t('Try again')}</button>
      <button className="btn ghost block" onClick={() => db.signOut()}>{t('Sign out')}</button>
    </div></div>
  );
}
