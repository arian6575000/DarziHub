import { D } from './dict';
import { EXTRA } from './dictExtra';

export type Lang = 'ur' | 'en';
const ALL: Record<string, [string, string]> = { ...D, ...EXTRA };

export function translate(key: string, lang: Lang): string {
  const e = ALL[key];
  if (!e) return key;
  return e[lang === 'ur' ? 1 : 0] || e[0];
}
export type TFn = (key: string, lang?: Lang) => string;
