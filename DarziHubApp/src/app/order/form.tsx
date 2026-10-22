import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Button, Card, CheckRow, DateField, Empty, Field, IconButton, Muted, NumField, Row, Screen, SectionLabel, SelectField, Sheet, T } from '../../ui/kit';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import type { Customer, MeasurementMap } from '../../db/types';
import { calcOrder } from '../../lib/calc';
import { todayStr } from '../../lib/dates';
import { Fmt } from '../../lib/format';
import { LIST, garmentName } from '../../lib/garments';
import { deletePhotoFiles, photoUri, pickImages, storePickedImage } from '../../lib/photos';
import { C } from '../../lib/theme';

interface ItemState { garment: string; qty: string; rate: string; fabricAmount: string; notes: string }

export default function OrderForm() {
  const { id, customerId } = useLocalSearchParams<{ id?: string; customerId?: string }>();
  const isEdit = !!id;
  const { t, lang, settings, toast, refreshReminders } = useApp();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const knownMax = useRef<number | null>(null);
  const [cust, setCust] = useState(customerId || '');
  const [orderDate, setOrderDate] = useState(todayStr());
  const [deliveryDate, setDeliveryDate] = useState('');
  const [trialDate, setTrialDate] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [items, setItems] = useState<ItemState[]>([]);
  const [discount, setDiscount] = useState('');
  const [advance, setAdvance] = useState('');
  const [notes, setNotes] = useState('');
  const [fabricReceived, setFabricReceived] = useState('');
  const [fabricMeters, setFabricMeters] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const original = useRef<{ photos: string[]; orderNumber?: string; status?: string }>({ photos: [] });
  const [photoSheet, setPhotoSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const rate = useCallback((g: string) => (settings.rates && settings.rates[g] ? String(settings.rates[g]) : ''), [settings.rates]);

  // initial state (edit → load order; create → one default item)
  useEffect(() => {
    (async () => {
      if (id) {
        const o = await Repo.getOrder(Number(id));
        if (!o) { router.back(); return; }
        setCust(String(o.customerId)); setOrderDate(o.orderDate); setDeliveryDate(o.deliveryDate); setTrialDate(o.trialDate); setUrgent(o.urgent);
        setItems(o.items.map((i) => ({ garment: i.garment, qty: String(i.qty), rate: String(i.rate), fabricAmount: i.fabricAmount ? String(i.fabricAmount) : '', notes: i.notes })));
        setDiscount(o.discount ? String(o.discount) : ''); setNotes(o.notes); setFabricReceived(o.fabricReceived);
        setFabricMeters(o.fabricMeters ? String(o.fabricMeters) : ''); setPhotos(o.photos);
        original.current = { photos: o.photos, orderNumber: o.orderNumber, status: o.status };
      } else {
        setItems([{ garment: 'qameez', qty: '1', rate: rate('qameez'), fabricAmount: '', notes: '' }]);
      }
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // reload customers whenever we come back (new customer added / measurements taken)
  useFocusEffect(useCallback(() => {
    (async () => {
      const list = await Repo.listCustomers();
      const full = await Promise.all(list.map(async (c) => (String(c.id) === cust ? (await Repo.getCustomer(c.id)) || c : c)));
      setCustomers(full);
      const max = list.reduce((m, c) => Math.max(m, c.id), 0);
      if (knownMax.current !== null && max > knownMax.current && !isEdit) setCust(String(max)); // just created via "add customer"
      knownMax.current = max;
    })();
  }, [cust, isEdit]));

  const custObj = customers.find((c) => String(c.id) === cust);
  const patch = (i: number, p: Partial<ItemState>) => setItems((arr) => arr.map((it, k) => (k === i ? { ...it, ...p } : it)));
  const calc = calcOrder({ items: items.map((i) => ({ qty: Number(i.qty), rate: Number(i.rate), fabricAmount: Number(i.fabricAmount) })), discount: Number(discount) });
  const adv = isEdit ? 0 : Number(advance) || 0;

  const addPhotos = async (source: 'gallery' | 'camera') => {
    setPhotoSheet(false);
    try {
      const uris = await pickImages(source, 6 - photos.length);
      const added: string[] = [];
      for (const u of uris) { if (photos.length + added.length >= 6) { toast(t('maxPhotos'), 'error'); break; } try { added.push(await storePickedImage(u)); } catch { toast(t('photoFailed'), 'error'); } }
      if (added.length) setPhotos((p) => [...p, ...added]);
    } catch (e: any) { toast(t(String(e.message) === 'photoPermission' ? 'photoPermission' : 'photoFailed'), 'error'); }
  };

  const save = async () => {
    if (!cust) { toast(t('selectCustomerErr'), 'error'); return; }
    const valid = items.filter((i) => i.garment && Number(i.qty) > 0);
    if (!valid.length) { toast(t('addItemErr'), 'error'); return; }
    setSaving(true);
    try {
      const full = custObj?.measurements || {};
      const snap: MeasurementMap = {};
      valid.forEach((i) => { if (full[i.garment]) snap[i.garment] = full[i.garment]; });
      const oid = await Repo.saveOrder({
        id: isEdit ? Number(id) : undefined,
        customerId: Number(cust), orderDate: orderDate || todayStr(), deliveryDate, trialDate, urgent, discount: Number(discount) || 0, notes,
        fabricReceived, fabricMeters: Number(fabricMeters) || 0, measurements: snap, photos,
        items: valid.map((i) => ({ garment: i.garment, qty: Number(i.qty), rate: Number(i.rate) || 0, fabricAmount: Number(i.fabricAmount) || 0, notes: i.notes })),
      }, adv);
      if (isEdit) deletePhotoFiles(original.current.photos.filter((p) => !photos.includes(p)));
      toast(t('saved'), 'success'); refreshReminders();
      if (isEdit) router.back(); else router.replace(`/order/${oid}`);
    } finally { setSaving(false); }
  };

  if (!loaded) return <Screen back title={isEdit ? t('editOrder') : t('newOrder')}><View /></Screen>;
  if (!customers.length && knownMax.current === 0) {
    return (
      <Screen back title={t('newOrder')}>
        <Empty icon="people" title={t('noCustomers')} text={t('needCustomerFirst')} action={<Button icon="person-add" label={t('addCustomer')} onPress={() => router.push({ pathname: '/customer/form', params: { next: 'back' } })} />} />
      </Screen>
    );
  }

  const garmentOptions = (['gents', 'ladies', 'other'] as const).flatMap((gr) => LIST.filter((g) => g.group === gr).map((g) => ({ value: g.key, label: garmentName(g.key, lang), group: t(gr) })));

  return (
    <Screen back title={isEdit ? t('editOrder') : t('newOrder')} padBottom={60}>
      <Card>
        <Row align="flex-end">
          <View style={{ flex: 1 }}>
            <SelectField label={`${t('customer')} *`} value={cust} searchable placeholder={t('selectCustomer')} onChange={setCust}
              options={customers.map((c) => ({ value: String(c.id), label: c.name, sub: c.phone }))} />
          </View>
          <IconButton icon="person-add" style={{ marginBottom: 14 }} onPress={() => router.push({ pathname: '/customer/form', params: { next: 'back' } })} />
        </Row>
        <Row align="flex-start">
          <DateField label={t('orderDate')} value={orderDate} onChange={setOrderDate} />
          <DateField label={t('deliveryDate')} value={deliveryDate} onChange={setDeliveryDate} clearable />
        </Row>
        <Row align="flex-start">
          <DateField label={t('trialDate')} value={trialDate} onChange={setTrialDate} clearable />
          <View style={{ flex: 1, justifyContent: 'center' }}><CheckRow label={t('urgent')} value={urgent} onChange={setUrgent} /></View>
        </Row>
      </Card>

      <SectionLabel>{t('items')}</SectionLabel>
      {items.map((it, i) => {
        const missing = custObj && !(custObj.measurements || {})[it.garment];
        return (
          <Card key={i}>
            <Row align="flex-start">
              <SelectField value={it.garment} options={garmentOptions} onChange={(g) => patch(i, { garment: g, ...(rate(g) ? { rate: rate(g) } : {}) })} />
              {items.length > 1 ? <IconButton icon="close" color={C.danger} onPress={() => setItems((arr) => arr.filter((_, k) => k !== i))} /> : null}
            </Row>
            <Row align="flex-start" gap={8}>
              <NumField label={t('qty')} value={it.qty} onChangeText={(v) => patch(i, { qty: v })} keyboardType="number-pad" style={{ flex: 1 }} />
              <NumField label={t('stitchRate')} value={it.rate} onChangeText={(v) => patch(i, { rate: v })} style={{ flex: 1 }} />
              <NumField label={t('fabricAmount')} value={it.fabricAmount} onChangeText={(v) => patch(i, { fabricAmount: v })} style={{ flex: 1 }} />
            </Row>
            <Field value={it.notes} onChangeText={(v) => patch(i, { notes: v })} placeholder={t('itemNotesPh')} style={{ marginBottom: missing ? 8 : 0 }} />
            {missing ? (
              <Row gap={6} wrap>
                <T size={13} color={C.danger}>{t('noMeasurementYet')}</T>
                <Pressable onPress={() => router.push({ pathname: '/customer/measure', params: { id: cust, garment: it.garment } })}><T bold size={13} color={C.primary}>{t('takeNow')}</T></Pressable>
              </Row>
            ) : null}
          </Card>
        );
      })}
      <Button variant="ghost" icon="add" label={t('addItem')} onPress={() => setItems((a) => [...a, { garment: 'qameez', qty: '1', rate: rate('qameez'), fabricAmount: '', notes: '' }])} />

      <SectionLabel>{t('billing')}</SectionLabel>
      <Card>
        <Row align="flex-start">
          <NumField label={t('discount')} value={discount} onChangeText={setDiscount} style={{ flex: 1 }} />
          {isEdit ? <View style={{ flex: 1 }} /> : <NumField label={t('advance')} value={advance} onChangeText={setAdvance} style={{ flex: 1 }} />}
        </Row>
        <TotalRow k={t('subtotal')} v={Fmt.money(calc.subtotal)} />
        {calc.discount ? <TotalRow k={t('discount')} v={`- ${Fmt.money(calc.discount)}`} /> : null}
        <TotalRow k={t('total')} v={Fmt.money(calc.total)} grand />
        {!isEdit ? <TotalRow k={t('balance')} v={Fmt.money(calc.total - adv)} color={calc.total - adv > 0 ? C.danger : C.success} /> : null}
      </Card>
      <Card><Field label={t('orderNotes')} value={notes} onChangeText={setNotes} multiline style={{ marginBottom: 0 }} /></Card>
      <Card>
        <Field label={t('customerFabric')} value={fabricReceived} onChangeText={setFabricReceived} placeholder={t('customerFabricPh')} />
        <NumField label={t('fabricMeters')} value={fabricMeters} onChangeText={setFabricMeters} style={{ marginBottom: 0 }} />
      </Card>
      <Card>
        <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <View style={{ flex: 1 }}><T size={12.5} bold color={C.soft}>{t('photos')}</T><Muted>{t('photosHint')}</Muted></View>
          <Button small variant="ghost" icon="camera" label={t('addPhoto')} disabled={photos.length >= 6} onPress={() => setPhotoSheet(true)} />
        </Row>
        <Row wrap gap={8}>
          {photos.map((p, i) => (
            <View key={p}>
              <Image source={{ uri: photoUri(p) }} style={{ width: 84, height: 84, borderRadius: 12 }} />
              <Pressable onPress={() => setPhotos((a) => a.filter((_, k) => k !== i))} style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={13} color="#fff" />
              </Pressable>
            </View>
          ))}
        </Row>
      </Card>
      <Button icon="checkmark" label={isEdit ? t('saveChanges') : t('saveOrder')} onPress={save} loading={saving} />

      <Sheet visible={photoSheet} onClose={() => setPhotoSheet(false)}>
        <Button variant="ghost" icon="camera" label={t('takePhoto')} onPress={() => addPhotos('camera')} style={{ marginBottom: 10 }} />
        <Button variant="ghost" icon="images" label={t('chooseGallery')} onPress={() => addPhotos('gallery')} />
      </Sheet>
    </Screen>
  );
}

function TotalRow({ k, v, grand, color }: { k: string; v: string; grand?: boolean; color?: string }) {
  return <Row style={{ justifyContent: 'space-between', paddingVertical: 5 }}><T size={grand ? 16 : 14} bold={grand} color={grand ? C.ink : C.soft}>{k}</T><T size={grand ? 18 : 14} bold color={color}>{v}</T></Row>;
}
