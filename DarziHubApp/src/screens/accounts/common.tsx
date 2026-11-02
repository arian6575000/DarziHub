import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { IconButton, Row, T } from '../../ui/kit';
import { Fmt } from '../../lib/format';
import { useApp } from '../../ctx/AppContext';

export interface YM { y: number; m: number }
export const currentYM = (): YM => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; };
export const shiftYM = (c: YM, n: number): YM => { const d = new Date(c.y, c.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; };

export function MonthNav({ ym, onChange }: { ym: YM; onChange: (v: YM) => void }) {
  const { lang, rtl } = useApp();
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
      <IconButton icon={rtl ? 'chevron-forward' : 'chevron-back'} onPress={() => onChange(shiftYM(ym, -1))} />
      <T bold size={16}>{Fmt.monthYear(ym.y, ym.m, lang)}</T>
      <IconButton icon={rtl ? 'chevron-back' : 'chevron-forward'} onPress={() => onChange(shiftYM(ym, 1))} />
    </Row>
  );
}
export { Ionicons };
