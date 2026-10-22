import type { Lang } from './i18n';
import { daysFromToday, parseYmd } from './dates';

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_UR = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];

export const Fmt = {
  currency: 'Rs',
  money(amount: number | string | null | undefined): string {
    const n = Math.round(Number(amount) || 0);
    const s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${n < 0 ? '-' : ''}${Fmt.currency} ${s}`;
  },
  /** Accepts 'YYYY-MM-DD' or a timestamp. */
  date(v: string | number | null | undefined, lang: Lang = 'en', short = false): string {
    if (!v) return '—';
    const d = typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) ? parseYmd(v) : new Date(v);
    if (isNaN(d.getTime())) return '—';
    const names = lang === 'ur' ? MONTHS_UR : MONTHS_EN;
    const mn = short && lang === 'en' ? names[d.getMonth()].slice(0, 3) : names[d.getMonth()];
    return `${d.getDate()} ${mn} ${d.getFullYear()}`;
  },
  monthYear(y: number, m: number, lang: Lang = 'en') {
    return `${(lang === 'ur' ? MONTHS_UR : MONTHS_EN)[m]} ${y}`;
  },
  initials(name?: string) {
    if (!name) return '?';
    return name.trim().split(/\s+/).slice(0, 2).map((w) => Array.from(w)[0]?.toUpperCase() || '').join('');
  },
  daysFromToday,
};

/** Phone → WhatsApp international digits (default country code from settings). */
export function waNumber(phone: string | undefined, cc = '92'): string {
  const d = String(phone || '').replace(/[^\d]/g, '');
  if (!d) return '';
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0')) return cc + d.slice(1);
  return d;
}
