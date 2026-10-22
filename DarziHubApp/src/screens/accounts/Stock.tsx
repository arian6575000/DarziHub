import React, { useState } from 'react';
import { View } from 'react-native';
import { Avatar, Badge, Button, Card, Field, ListItem, Muted, NumField, Row, SelectField, Sheet, T } from '../../ui/kit';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import { STOCK_CATS, STOCK_UNITS, StockItem, StockLog } from '../../db/types';
import { useLoad } from '../../lib/hooks';
import { Fmt } from '../../lib/format';
import { C } from '../../lib/theme';

export function Stock() {
  const { t, lang, toast, confirm } = useApp();
  const [list, reload] = useLoad(() => Repo.listStock(), []);
  const [edit, setEdit] = useState<{ item?: StockItem } | null>(null);
  const [adj, setAdj] = useState<{ item: StockItem; log: StockLog[] } | null>(null);
  // edit form
  const [name, setName] = useState(''); const [cat, setCat] = useState<string>('fabric'); const [unit, setUnit] = useState<string>('meter');
  const [qty, setQty] = useState(''); const [min, setMin] = useState('');
  // adjust form
  const [aq, setAq] = useState(''); const [an, setAn] = useState('');

  const openEdit = (item?: StockItem) => {
    setName(item?.name || ''); setCat(item?.category || 'fabric'); setUnit(item?.unit || 'meter'); setQty(''); setMin(item?.minQty ? String(item.minQty) : '');
    setEdit({ item });
  };
  const openAdj = async (item: StockItem) => { setAq(''); setAn(''); setAdj({ item, log: await Repo.stockLogFor(item.id) }); };
  const saveEdit = async () => {
    if (!name.trim()) { toast(t('nameRequired'), 'error'); return; }
    await Repo.saveStock({ id: edit?.item?.id, name: name.trim(), category: cat, unit, qty, minQty: min });
    setEdit(null); toast(t('saved'), 'success'); reload();
  };
  const apply = async (sign: 1 | -1) => {
    const q = Number(aq);
    if (!(q > 0) || !adj) { toast(t('amountRequired'), 'error'); return; }
    await Repo.adjustStock(adj.item.id, sign * q, an);
    setAdj(null); toast(t('saved'), 'success'); reload();
  };
  const del = async () => {
    if (!adj) return; const item = adj.item; setAdj(null);
    if (!(await confirm(t('deleteStockMsg'), { danger: true, okLabel: t('delete') }))) return;
    await Repo.deleteStock(item.id); toast(t('deleted'), 'success'); reload();
  };
  const items = list || [];
  const low = items.filter((s) => s.minQty > 0 && s.qty <= s.minQty);
  return (
    <>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Muted>{t('stockItems')}</Muted>
            <Row gap={8}><T bold size={22}>{items.length}</T>{low.length ? <Badge status="cancelled" label={`${low.length} ${t('lowStock')}`} /> : null}</Row>
          </View>
          <Button small icon="add" label={t('addStock')} onPress={() => openEdit()} />
        </Row>
      </Card>
      <Card flush>
        {items.length ? items.map((s, i) => {
          const isLow = s.minQty > 0 && s.qty <= s.minQty;
          return (
            <ListItem key={s.id} last={i === items.length - 1} onPress={() => openAdj(s)} left={<Avatar icon="cube" />} title={s.name} sub={t('sc_' + (s.category || 'other'))}
              trail={<><T bold size={14} color={isLow ? C.danger : C.ink}>{`${s.qty} ${t('u_' + (s.unit || 'piece'))}`}</T>{isLow ? <T size={11} color={C.danger}>{t('lowStock')}</T> : null}</>} />
          );
        }) : <Muted center style={{ paddingVertical: 22 }}>{t('noStock')}</Muted>}
      </Card>

      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit?.item ? t('editStock') : t('addStock')} scroll>
        <Field label={`${t('name')} *`} value={name} onChangeText={setName} placeholder={t('stockNamePh')} />
        <Row align="flex-start">
          <SelectField label={t('category')} value={cat} onChange={setCat} options={STOCK_CATS.map((k) => ({ value: k, label: t('sc_' + k) }))} />
          <SelectField label={t('unit')} value={unit} onChange={setUnit} options={STOCK_UNITS.map((k) => ({ value: k, label: t('u_' + k) }))} />
        </Row>
        <Row align="flex-start">
          {edit?.item ? null : <NumField label={t('openingQty')} value={qty} onChangeText={setQty} style={{ flex: 1 }} />}
          <NumField label={t('minQty')} value={min} onChangeText={setMin} style={{ flex: 1 }} />
        </Row>
        <Row><Button block variant="ghost" label={t('cancel')} onPress={() => setEdit(null)} /><Button block label={t('save')} onPress={saveEdit} /></Row>
      </Sheet>

      <Sheet visible={!!adj} onClose={() => setAdj(null)} title={adj ? `${adj.item.name} · ${adj.item.qty} ${t('u_' + (adj.item.unit || 'piece'))}` : ''} scroll>
        <Row align="flex-start">
          <NumField label={t('quantity')} value={aq} onChangeText={setAq} style={{ flex: 1 }} />
          <Field label={t('note')} value={an} onChangeText={setAn} style={{ flex: 1 }} />
        </Row>
        <Row style={{ marginBottom: 14 }}>
          <Button block icon="add" label={t('stockIn')} onPress={() => apply(1)} />
          <Button block variant="ghost" icon="remove" label={t('stockOut')} onPress={() => apply(-1)} />
        </Row>
        {adj?.log.length ? (
          <>
            <Muted style={{ fontWeight: '700', marginBottom: 4 }}>{t('history')}</Muted>
            {adj.log.map((l) => (
              <Row key={l.id} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
                <Muted>{`${Fmt.date(l.date, lang, true)}${l.note ? ' · ' + (l.note === 'opening' ? t('openingQty') : l.note) : ''}`}</Muted>
                <T bold size={14} color={l.delta < 0 ? C.danger : C.success}>{`${l.delta > 0 ? '+' : ''}${l.delta}`}</T>
              </Row>
            ))}
          </>
        ) : null}
        <Row style={{ marginTop: 14 }}>
          <Button block variant="ghost" icon="pencil" label={t('edit')} onPress={() => { const it = adj!.item; setAdj(null); setTimeout(() => openEdit(it), 250); }} />
          <Button block variant="danger" icon="trash" label={t('delete')} onPress={del} />
        </Row>
      </Sheet>
    </>
  );
}
