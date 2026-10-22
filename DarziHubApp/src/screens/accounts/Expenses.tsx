import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, DateField, Field, ListItem, Muted, NumField, Row, SelectField, Sheet, T } from '../../ui/kit';
import { MonthNav, YM } from './common';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import { EXPENSE_CATS } from '../../db/types';
import { todayStr } from '../../lib/dates';
import { useLoad } from '../../lib/hooks';
import { Fmt } from '../../lib/format';

export function Expenses({ ym, setYm, openAdd }: { ym: YM; setYm: (v: YM) => void; openAdd?: string }) {
  const { t, lang, toast, confirm } = useApp();
  const [sheet, setSheet] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [cat, setCat] = useState<string>('cloth');
  const [note, setNote] = useState('');
  const [list, reload] = useLoad(() => Repo.listExpenses(ym.y, ym.m), [ym.y, ym.m]);

  const open = () => { setAmount(''); setDate(todayStr()); setCat('cloth'); setNote(''); setSheet(true); };
  useEffect(() => { if (openAdd) open(); }, [openAdd]);

  const save = async () => {
    const a = Number(amount);
    if (!(a > 0)) { toast(t('amountRequired'), 'error'); return; }
    await Repo.addExpense({ amount: a, date: date || todayStr(), category: cat, note });
    setSheet(false); toast(t('saved'), 'success'); reload();
  };
  const del = async (id: number) => {
    if (!(await confirm(t('deleteExpenseMsg'), { danger: true, okLabel: t('delete') }))) return;
    await Repo.deleteExpense(id); toast(t('deleted'), 'success'); reload();
  };
  const total = (list || []).reduce((a, e) => a + e.amount, 0);
  return (
    <>
      <MonthNav ym={ym} onChange={setYm} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Total label={t('totalExpenses')} value={Fmt.money(total)} />
          <Button small icon="add" label={t('addExpense')} onPress={open} />
        </Row>
      </Card>
      <Card flush>
        {list && list.length ? list.map((e, i) => (
          <ListItem key={e.id} last={i === list.length - 1} onPress={() => del(e.id)} title={t('cat_' + e.category)}
            sub={`${Fmt.date(e.date, lang, true)}${e.note ? ' · ' + e.note : ''}`} trail={<T bold size={14}>{Fmt.money(e.amount)}</T>} />
        )) : <Muted center style={{ paddingVertical: 22 }}>{t('noExpenses')}</Muted>}
      </Card>
      <Sheet visible={sheet} onClose={() => setSheet(false)} title={t('addExpense')} scroll>
        <Row align="flex-start">
          <NumField label={`${t('amount')} *`} value={amount} onChangeText={setAmount} style={{ flex: 1 }} />
          <DateField label={t('date')} value={date} onChange={setDate} />
        </Row>
        <SelectField label={t('category')} value={cat} onChange={setCat} options={EXPENSE_CATS.map((k) => ({ value: k, label: t('cat_' + k) }))} />
        <Field label={t('note')} value={note} onChangeText={setNote} />
        <Row><Button block variant="ghost" label={t('cancel')} onPress={() => setSheet(false)} /><Button block label={t('save')} onPress={save} /></Row>
      </Sheet>
    </>
  );
}
function Total({ label, value }: { label: string; value: string }) {
  return <View><Muted>{label}</Muted><T bold size={22}>{value}</T></View>;
}
