import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Field, Screen, Segmented, T } from '../../ui/kit';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import type { Gender } from '../../db/types';

export default function CustomerForm() {
  const { id, headId, next } = useLocalSearchParams<{ id?: string; headId?: string; next?: string }>();
  const { t, toast } = useApp();
  const isEdit = !!id;
  const [f, setF] = useState({ name: '', phone: '', address: '', notes: '', gender: 'both' as Gender, headId: null as number | null });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (id) {
        const c = await Repo.getCustomer(Number(id));
        if (c) setF({ name: c.name, phone: c.phone, address: c.address, notes: c.notes, gender: c.gender, headId: c.headId });
      } else if (headId) {
        const h = await Repo.getCustomer(Number(headId));
        if (h) setF((p) => ({ ...p, headId: h.id, phone: h.phone, address: h.address }));
      }
    })();
  }, [id, headId]);

  const save = async () => {
    if (!f.name.trim()) { toast(t('nameRequired'), 'error'); return; }
    setSaving(true);
    try {
      const cid = await Repo.saveCustomer({ ...f, id: isEdit ? Number(id) : undefined });
      toast(t('saved'), 'success');
      if (next === 'back') router.back();
      else if (!isEdit && (next === 'order' || headId)) router.replace({ pathname: '/order/form', params: { customerId: String(cid) } });
      else if (isEdit) router.back();
      else router.replace(`/customer/${cid}`);
    } finally { setSaving(false); }
  };

  return (
    <Screen back title={isEdit ? t('editCustomer') : t('newCustomer')}>
      <Card>
        <Field label={`${t('name')} *`} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} placeholder={t('namePh')} />
        <Field label={t('phone')} value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} placeholder="03xx-xxxxxxx" keyboardType="phone-pad" ltr />
        <T size={12.5} bold color="#4B4F5E" style={{ marginBottom: 6 }}>{t('customerType')}</T>
        <Segmented value={f.gender} onChange={(g) => setF({ ...f, gender: g })} items={[['gents', t('gents')], ['ladies', t('ladies')], ['both', t('both')]]} />
        <Field style={{ marginTop: 14 }} label={t('address')} value={f.address} onChangeText={(v) => setF({ ...f, address: v })} multiline />
        <Field label={t('notes')} value={f.notes} onChangeText={(v) => setF({ ...f, notes: v })} multiline style={{ marginBottom: 0 }} />
      </Card>
      <Button icon="checkmark" label={isEdit ? t('saveChanges') : t('addCustomer')} onPress={save} loading={saving} />
    </Screen>
  );
}
