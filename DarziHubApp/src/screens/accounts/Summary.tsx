import React from 'react';
import { Button, Card, Grid, Hero, KV, Muted, Row, SectionLabel, StatCard } from '../../ui/kit';
import { MonthNav, YM } from './common';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import { calcOrder } from '../../lib/calc';
import { todayStr } from '../../lib/dates';
import { useLoad } from '../../lib/hooks';
import { Fmt } from '../../lib/format';
import { garmentName, itemsSummary } from '../../lib/garments';
import { shareTextFile } from '../../lib/backup';
import { C } from '../../lib/theme';

export function Summary({ ym, setYm }: { ym: YM; setYm: (v: YM) => void }) {
  const { t, lang, toast } = useApp();
  const [d] = useLoad(async () => {
    const [s, wl] = await Promise.all([Repo.monthSummary(ym.y, ym.m), Repo.workload(14)]);
    return { s, wl };
  }, [ym.y, ym.m]);

  const exportCsv = async () => {
    try {
      const x = await Repo.monthData(ym.y, ym.m);
      const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows: unknown[][] = [['Type', 'Date', 'Ref', 'Customer', 'Details', 'Amount']];
      x.orders.forEach((o) => rows.push(['Order', o.orderDate, o.orderNumber, x.customers[o.customerId]?.name, `${itemsSummary(o.items, 'en')} [${o.status}]`, calcOrder(o).total]));
      x.payments.forEach((p) => rows.push(['Payment', p.date, p.orderId || '', x.customers[p.customerId]?.name, `${p.method}${p.note ? ' ' + p.note : ''}`, p.amount]));
      x.expenses.forEach((e) => rows.push(['Expense', e.date, '', '', `${t('cat_' + e.category, 'en')}${e.note ? ' ' + e.note : ''}`, -Math.abs(e.amount)]));
      const csv = '﻿' + rows.map((r) => r.map(q).join(',')).join('\n');
      await shareTextFile(`darzihub-${ym.y}-${String(ym.m + 1).padStart(2, '0')}.csv`, csv, 'text/csv');
    } catch { toast(t('shareFailed'), 'error'); }
  };

  const s = d?.s;
  return (
    <>
      <MonthNav ym={ym} onChange={setYm} />
      {s ? (
        <>
          <Hero label={t('profit')} value={Fmt.money(s.profit)} hint={t('profitHint')} danger={s.profit < 0} />
          <Grid>
            <StatCard icon="cash" tone="green" small value={Fmt.money(s.income)} label={t('incomeReceived')} />
            <StatCard icon="receipt" tone="orange" small value={Fmt.money(s.expenses)} label={t('expenses')} />
            <StatCard icon="cut" tone="blue" value={s.orders} label={t('ordersTaken')} />
            <StatCard icon="checkmark-done" tone="violet" value={s.delivered} label={t('delivered')} />
          </Grid>
          <SectionLabel>{t('garmentsStitched')}</SectionLabel>
          <Card>{s.garments.length ? s.garments.map(([g, n]) => <KV key={g} k={garmentName(g, lang)} v={String(n)} />) : <Muted>{t('noData')}</Muted>}</Card>
          <SectionLabel>{t('workload')}</SectionLabel>
          <Card>
            {d!.wl.length ? d!.wl.map((w) => (
              <KV key={w.date} k={`${Fmt.date(w.date, lang, true)}${w.date === todayStr() ? ' · ' + t('today') : ''}`}
                v={`${w.pieces} ${t('pieces')} · ${w.orders} ${t('orders')}`} vColor={w.pieces >= 8 ? C.danger : undefined} />
            )) : <Muted>{t('noData')}</Muted>}
          </Card>
          <Row><Button block variant="ghost" icon="document-text" label="CSV" onPress={exportCsv} /></Row>
        </>
      ) : null}
    </>
  );
}
