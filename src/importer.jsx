import { useApp } from './App.jsx';
import { Icon, Photo } from './ui.jsx';
import { t } from './lib/i18n.js';
import { useInbox, removeItem, retryItem } from './lib/inbox.js';
import { meatWarnings, guessCategory } from './lib/parse.js';

const finalDraft = (d) => ({
  title: (d.title || '').trim() || t('Untitled recipe'),
  category: d.category || guessCategory(d.title || ''),
  servings: d.servings || 2,
  prep_time: d.prep_time || '',
  cook_time: d.cook_time || '',
  source_url: d.source_url || '',
  photo: '', photo_url: d.photo_url || '', photoData: d.photoData || null,
  ingredients: d.ingredients || [],
  steps: d.steps || [],
  notes: '',
  macros: d.macros || null,
  rating: 0, is_favourite: false,
});

/** Everything shared to the app, read and waiting for a quick check. */
export function Inbox() {
  const { back, go, saveRecipe, toast } = useApp();
  const list = useInbox();
  const ready = list.filter((x) => x.status === 'ready' && !meatWarnings(x.draft?.ingredients || []).length);

  const save = async (it) => {
    await saveRecipe(finalDraft(it.draft));
    removeItem(it.id);
  };
  const saveAll = async () => {
    for (const it of ready) await save(it);
    toast(t('Saved {n} recipes', { n: ready.length }));
  };

  return (
    <>
      <div className="topbar compact">
        <button className="icon-btn" onClick={back} aria-label={t('Back')}><Icon name="back" /></button>
        <h1 className="serif">{t('Imported')}</h1>
        {ready.length > 1 && <button className="btn primary sm" onClick={saveAll}>{t('Save all ({n})', { n: ready.length })}</button>}
      </div>
      <div className="screen no-nav stack" style={{ paddingTop: 16 }}>
        {!list.length ? (
          <div className="empty">
            <div className="serif">{t('Nothing waiting')}</div>
            <p>{t('Share a recipe link, a post or screenshots to Our Recipes from any app. They show up here, ready to check and save.')}</p>
            <HowToShare />
          </div>
        ) : (
          <>
            <p className="muted small">{t('Check each recipe, then save it to your cookbook. Ready ones can be saved straight away.')}</p>
            {list.map((it) => <InboxCard key={it.id} it={it} onSave={() => save(it).then(() => toast(t('Recipe added')))}
              onReview={() => go({ name: 'edit', draft: { ...(it.draft || {}), source_url: it.draft?.source_url || (it.kind === 'link' ? it.value : ''), inboxId: it.id }, note: t('Check everything, then save.'), key: it.id })} />)}
            <HowToShare compact />
          </>
        )}
      </div>
    </>
  );
}

function InboxCard({ it, onSave, onReview }) {
  const d = it.draft || {};
  const busy = it.status === 'pending' || it.status === 'working';
  const meat = d.ingredients ? meatWarnings(d.ingredients) : [];
  const label = it.kind === 'link' ? it.value.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)
    : it.kind === 'images' ? t('Screenshots') : t('Pasted text');
  return (
    <div className="inbox-card">
      <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
        <Photo src={d.photoData || d.photo_url} className="ph thumb" iconSize={22} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t">{busy ? t('Reading…') : d.title || t('No title found')}</div>
          <div className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
          {!busy && it.status !== 'failed' && (
            <div className="small" style={{ marginTop: 4 }}>
              {t('{a} ingredients, {b} steps', { a: d.ingredients?.length || 0, b: d.steps?.length || 0 })}
            </div>
          )}
        </div>
        <button className="icon-btn" style={{ width: 36, height: 36, border: 0, background: 'transparent' }} onClick={() => removeItem(it.id)} aria-label={t('Remove')}><Icon name="x" size={18} /></button>
      </div>
      {busy && <div className="progress indet" style={{ marginTop: 12 }}><div /></div>}
      {it.status === 'ready' && !meat.length && <div className="status ok"><Icon name="check" size={16} /> {t('Looks complete')}</div>}
      {it.status === 'check' && <div className="status warn">{it.error || t('Some parts are missing. Have a quick look before saving.')}</div>}
      {meat.length > 0 && <div className="status warn">{t('Not vegetarian yet:')} {meat.join(', ')}</div>}
      {it.status === 'failed' && <div className="status bad">{it.error}</div>}
      {!busy && (
        <div className="row" style={{ marginTop: 12 }}>
          {it.status === 'failed' ? (
            <>
              <button className="btn sm" onClick={() => retryItem(it.id)}><Icon name="shuffle" size={16} /> {t('Try again')}</button>
              <button className="btn sm ghost" onClick={onReview}>{t('Fill in by hand')}</button>
            </>
          ) : (
            <>
              <button className="btn sm" onClick={onReview}><Icon name="edit" size={16} /> {t('Check & edit')}</button>
              {it.status === 'ready' && !meat.length && <button className="btn sm primary" onClick={onSave}><Icon name="check" size={16} /> {t('Save')}</button>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function HowToShare({ compact }) {
  return (
    <div className={`howto ${compact ? 'compact' : ''}`}>
      <b>{t('How to share a recipe')}</b>
      <ol>
        <li>{t('In Chrome, Instagram, TikTok or your gallery, tap Share.')}</li>
        <li>{t('Pick Our Recipes. Several screenshots at once become one recipe.')}</li>
        <li>{t('The app reads it. Check it here and save.')}</li>
      </ol>
    </div>
  );
}
