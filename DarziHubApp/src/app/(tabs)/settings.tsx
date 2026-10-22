import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Button, Card, Field, ListItem, Muted, NumField, Row, Screen, SectionLabel, Segmented, SelectField, Sheet, T } from '../../ui/kit';
import { usePinPrompt } from '../../ui/PinPrompt';
import { useApp } from '../../ctx/AppContext';
import type { Settings } from '../../db/types';
import { LIST, garmentName } from '../../lib/garments';
import { hasPin, removePin, setPin, verifyPin } from '../../lib/lock';
import { cancelReminders, ensureNotifyPermission } from '../../lib/notify';
import { pickLogoDataUrl } from '../../lib/photos';
import { C } from '../../lib/theme';

export default function SettingsScreen() {
  const { t, lang, settings, saveSettings, setLang, toast, refreshReminders } = useApp();
  const [f, setF] = useState<Settings>(settings);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [pinOn, setPinOn] = useState(false);
  const [pinMenu, setPinMenu] = useState(false);
  const [pinEl, askPin] = usePinPrompt();

  useEffect(() => { setF(settings); setRates(Object.fromEntries(Object.entries(settings.rates || {}).map(([k, v]) => [k, String(v)]))); }, [settings]);
  useEffect(() => { hasPin().then(setPinOn); }, []);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    const r: Record<string, number> = {};
    Object.entries(rates).forEach(([k, v]) => { if (v !== '' && !isNaN(Number(v))) r[k] = Number(v); });
    await saveSettings({ ...f, rates: r });
    toast(t('saved'), 'success');
  };
  const chooseLogo = async () => { try { const u = await pickLogoDataUrl(); if (u) set('logo', u); } catch { toast(t('photoFailed'), 'error'); } };

  const toggleNotify = async () => {
    if (settings.notifyEnabled) { await saveSettings({ ...settings, notifyEnabled: false }); await cancelReminders(); toast(t('saved'), 'success'); return; }
    if (!(await ensureNotifyPermission())) { toast(t('notifDenied'), 'error'); return; }
    await saveSettings({ ...settings, notifyEnabled: true });
    setTimeout(refreshReminders, 100);
    toast(t('saved'), 'success');
  };

  const newPin = async () => {
    const a = await askPin(t('newPin')); if (!a) return;
    const b = await askPin(t('confirmPin')); if (!b) return;
    if (a !== b) { toast(t('pinMismatch'), 'error'); return; }
    await setPin(a); setPinOn(true); toast(t('pinSet'), 'success');
  };
  const pinAction = async () => {
    if (!pinOn) { await newPin(); return; }
    const cur = await askPin(t('enterCurrentPin')); if (!cur) return;
    if (!(await verifyPin(cur))) { toast(t('wrongPin'), 'error'); return; }
    setPinMenu(true);
  };

  return (
    <Screen title={t('navSettings')} padBottom={60}>
      <SectionLabel>{t('language')}</SectionLabel>
      <Card><Segmented value={lang} onChange={(l) => setLang(l)} items={[['ur', 'اردو'], ['en', 'English']]} /></Card>

      <SectionLabel>{t('shopInfo')}</SectionLabel>
      <Card>
        <Row gap={14} style={{ marginBottom: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: 'rgba(62,107,255,0.1)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {f.logo ? <Image source={{ uri: f.logo }} style={{ width: 64, height: 64 }} resizeMode="contain" /> : <Ionicons name="image" size={26} color={C.primary} />}
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Row gap={8}>
              <Button small variant="ghost" label={t('chooseLogo')} onPress={chooseLogo} />
              {f.logo ? <Button small variant="danger" label={t('removeLogo')} onPress={() => set('logo', null)} /> : null}
            </Row>
            <Muted>{t('logoHint')}</Muted>
          </View>
        </Row>
        <Field label={t('shopNameEn')} value={f.shopName} onChangeText={(v) => set('shopName', v)} ltr />
        <Field label={t('shopNameUr')} value={f.shopNameUr} onChangeText={(v) => set('shopNameUr', v)} />
        <Field label={t('ownerName')} value={f.ownerName} onChangeText={(v) => set('ownerName', v)} />
        <Field label={t('phone')} value={f.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" ltr />
        <Field label={t('address')} value={f.address} onChangeText={(v) => set('address', v)} multiline style={{ marginBottom: 0 }} />
      </Card>

      <SectionLabel>{t('billingSettings')}</SectionLabel>
      <Card>
        <Row align="flex-start" gap={8}>
          <Field label={t('currency')} value={f.currency} onChangeText={(v) => set('currency', v)} style={{ flex: 1, marginBottom: 0 }} ltr />
          <Field label={t('countryCode')} value={f.countryCode} onChangeText={(v) => set('countryCode', v.replace(/\D/g, ''))} keyboardType="number-pad" style={{ flex: 1, marginBottom: 0 }} ltr />
          <Field label={t('orderPrefix')} value={f.orderPrefix} onChangeText={(v) => set('orderPrefix', v)} style={{ flex: 1, marginBottom: 0 }} ltr />
        </Row>
      </Card>

      <SectionLabel>{t('receiptSettings')}</SectionLabel>
      <Card>
        <SelectField label={t('defaultFormat')} value={f.receiptFormat} onChange={(v) => set('receiptFormat', v as Settings['receiptFormat'])}
          options={[{ value: 'thermal80', label: t('thermal80') }, { value: 'thermal58', label: t('thermal58') }, { value: 'a4', label: 'A4' }]} />
        <Field label={t('footerEn')} value={f.footerEn} onChangeText={(v) => set('footerEn', v)} ltr />
        <Field label={t('footerUr')} value={f.footerUr} onChangeText={(v) => set('footerUr', v)} style={{ marginBottom: 0 }} />
      </Card>

      <SectionLabel>{t('securityNotify')}</SectionLabel>
      <Card flush>
        <ListItem title={t('pinLock')} sub={pinOn ? t('pinOn') : t('pinOff')} trail={<Button small variant="ghost" label={pinOn ? t('manage') : t('setPin')} onPress={pinAction} />} />
        <ListItem last title={t('dailyAlerts')} sub={settings.notifyEnabled ? t('pinOn') : t('pinOff')} trail={<Button small variant="ghost" label={settings.notifyEnabled ? t('disable') : t('enable')} onPress={toggleNotify} />} />
        <Muted style={{ paddingBottom: 12 }}>{t('alertsHint')}</Muted>
      </Card>

      <SectionLabel>{t('msgTemplates')}</SectionLabel>
      <Card>
        <Muted style={{ marginBottom: 12 }}>{t('msgTemplatesHint')}</Muted>
        <Field label={`${t('readyMsg')} (English)`} value={f.readyMsgEn} onChangeText={(v) => set('readyMsgEn', v)} multiline ltr />
        <Field label={`${t('readyMsg')} (اردو)`} value={f.readyMsgUr} onChangeText={(v) => set('readyMsgUr', v)} multiline />
        <Field label={`${t('dueMsg')} (English)`} value={f.dueMsgEn} onChangeText={(v) => set('dueMsgEn', v)} multiline ltr />
        <Field label={`${t('dueMsg')} (اردو)`} value={f.dueMsgUr} onChangeText={(v) => set('dueMsgUr', v)} multiline style={{ marginBottom: 0 }} />
      </Card>

      <SectionLabel>{t('defaultRates')}</SectionLabel>
      <Card>
        <Muted style={{ marginBottom: 12 }}>{t('defaultRatesHint')}</Muted>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 }}>
          {LIST.map((g) => <NumField key={g.key} label={garmentName(g.key, lang)} value={rates[g.key] ?? ''} onChangeText={(v) => setRates((p) => ({ ...p, [g.key]: v }))} style={{ width: '47.5%' }} />)}
        </View>
      </Card>

      <Button icon="checkmark" label={t('saveChanges')} onPress={save} />

      <Card style={{ marginTop: 16 }} onPress={() => router.push('/backup')}>
        <Row gap={12}>
          <Ionicons name="cloud-upload" size={26} color={C.primary} />
          <View style={{ flex: 1 }}><T bold size={15}>{t('backupRestore')}</T><Muted>{t('backupHint')}</Muted></View>
          <Ionicons name={lang === 'ur' ? 'chevron-back' : 'chevron-forward'} size={18} color={C.faint} />
        </Row>
      </Card>
      <Muted center style={{ marginTop: 8 }}>{`DarziHub · ${t('version')} ${Constants.expoConfig?.version ?? ''}`}</Muted>

      {pinEl}
      <Sheet visible={pinMenu} onClose={() => setPinMenu(false)}>
        <Button variant="ghost" icon="key" label={t('changePin')} style={{ marginBottom: 10 }} onPress={async () => { setPinMenu(false); setTimeout(newPin, 300); }} />
        <Button variant="danger" icon="lock-open" label={t('removePin')} onPress={async () => { await removePin(); setPinOn(false); setPinMenu(false); toast(t('pinRemoved'), 'success'); }} />
      </Sheet>
    </Screen>
  );
}
