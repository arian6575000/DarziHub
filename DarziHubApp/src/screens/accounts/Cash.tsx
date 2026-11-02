import React, { useEffect, useState } from 'react';
import { Button, Card, DateField, Muted, NumField, SectionLabel, KV, T } from '../../ui/kit';
import { Row } from '../../ui/kit';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import { todayStr } from '../../lib/dates';
import { useLoad } from '../../lib/hooks';
import { Fmt } from '../../lib/format';
import { C } from '../../lib/theme';

export function Cash() {
  const { t, lang, toast } = useApp();
  const [date, setDate] = useState(todayStr());
  const [opening, setOpening] = useState('');
  const [closing, setClosing] = useState('');
  const [d] = useLoad(async () => {
    const [x, cm] = await Promise.all([Repo.cashDayData(date), Repo.customerMap()]);
    return { x, cm };
  }, [date]);
  useEffect(() => {
    if (d) { setOpening(String(d.x.opening)); setClosing(d.x.closing == null ? '' : String(d.x.closing)); }
  }, [d]);
  if (!d) return null;
  const { x, cm } = d;
  const expected = (Number(opening) || 0) + x.cashIn - x.out;
  const diff = closing === '' ? null : Number(closing) - expected;
  const save = async () => {
    await Repo.saveCashDay({ date, opening: Number(opening) || 0, closing: closing === '' ? null : Number(closing) });
    toast(t('saved'), 'success');
  };
  return (
    <>
      <Card><DateField label={t('date')} value={date} onChange={(v) => v && setDate(v)} /></Card>
      <Card>
        <NumField label={t('openingCash')} value={opening} onChangeText={setOpening} />
        <KV k={t('cashReceived')} v={`+ ${Fmt.money(x.cashIn)}`} vColor={C.success} />
        <KV k={t('expenses')} v={`- ${Fmt.money(x.out)}`} vColor={C.danger} />
        <KV k={t('expectedCash')} v={Fmt.money(expected)} />
        <KV k={t('onlineReceived')} v={Fmt.money(x.onlineIn)} />
        <NumField style={{ marginTop: 14 }} label={t('countedCash')} value={closing} onChangeText={setClosing} />
        {diff !== null ? <T bold color={diff === 0 ? C.success : C.danger} style={{ marginBottom: 12 }}>{diff === 0 ? t('cashMatches') : `${t('cashDiff')}: ${diff > 0 ? '+' : ''}${Fmt.money(diff)}`}</T> : null}
        <Row><Button block icon="checkmark" label={t('save')} onPress={save} /></Row>
      </Card>
      <SectionLabel>{t('todaysEntries')}</SectionLabel>
      <Card>
        {x.payments.length + x.expenses.length ? (
          <>
            {x.payments.map((p) => <KV key={`p${p.id}`} k={`${cm[p.customerId]?.name || '—'}${p.method === 'online' ? ' · ' + (lang === 'ur' ? 'آن لائن' : 'Online') : ''}`} v={`+ ${Fmt.money(p.amount)}`} vColor={C.success} />)}
            {x.expenses.map((e) => <KV key={`e${e.id}`} k={`${t('cat_' + e.category)}${e.note ? ' · ' + e.note : ''}`} v={`- ${Fmt.money(e.amount)}`} vColor={C.danger} />)}
          </>
        ) : <Muted>{t('noData')}</Muted>}
      </Card>
    </>
  );
}
