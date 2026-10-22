import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Muted, NumField, Field, Screen } from '../../ui/kit';
import { View } from 'react-native';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import { byKey, fieldLabel, garmentName } from '../../lib/garments';

export default function Measure() {
  const { id, garment } = useLocalSearchParams<{ id: string; garment: string }>();
  const { t, lang, toast } = useApp();
  const g = byKey[garment];
  const [name, setName] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [style, setStyle] = useState('');

  useEffect(() => {
    (async () => {
      const c = await Repo.getCustomer(Number(id));
      if (!c) { router.back(); return; }
      setName(c.name);
      const m = c.measurements?.[garment];
      if (m) { setVals(Object.fromEntries(Object.entries(m.values).map(([k, v]) => [k, String(v)]))); setStyle(m.style || ''); }
    })();
  }, [id, garment]);

  if (!g) return null;
  const save = async () => {
    const values: Record<string, string> = {};
    Object.entries(vals).forEach(([k, v]) => { if (String(v).trim() !== '') values[k] = v.trim(); });
    await Repo.saveMeasurement(Number(id), g.key, values, style);
    toast(t('saved'), 'success'); router.back();
  };
  return (
    <Screen back title={garmentName(g.key, lang)}>
      <Muted style={{ marginHorizontal: 4, marginBottom: 12 }}>{name} · {t('inches')}</Muted>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 }}>
          {g.fields.map((f) => (
            <NumField key={f} label={fieldLabel(f, lang)} value={vals[f] ?? ''} onChangeText={(v) => setVals((p) => ({ ...p, [f]: v }))} style={{ width: '47.5%' }} />
          ))}
        </View>
        <Field label={t('styleNotes')} value={style} onChangeText={setStyle} multiline placeholder={t('styleNotesPh')} style={{ marginBottom: 0 }} />
      </Card>
      <Button icon="checkmark" label={t('saveMeasurements')} onPress={save} />
    </Screen>
  );
}
