// Tiny i18n: English strings are the keys; Dutch translations below. t('Hello {name}', { name }) interpolates.
import { NL } from './nl.js';

const KEY = 'or.lang';
export const getLang = () => {
  try { return localStorage.getItem(KEY) || 'en'; } catch { return 'en'; }
};
let lang = typeof localStorage !== 'undefined' ? getLang() : 'en';
export function setLang(l) { localStorage.setItem(KEY, l); location.reload(); }
export function t(s, vars) {
  let out = (lang === 'nl' && NL[s]) || s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return out;
}
