// Wrap the app: children render only with a valid license. useLicense() gives plan / features / days left.
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useApp } from '../ctx/AppContext';
import { Button, Card, Credit, Field, Muted, Screen, T } from '../ui/kit';
import { C } from '../lib/theme';
import { getDeviceId } from './deviceId';
import { activateLicense, CheckResult, checkSavedLicense, getTrialState, REASON_KEYS, refreshFromHub, startTrial } from './licenseClient';
import type { TrialState } from './trialCore';
import type { Payload } from './licenseCore';
import { FeatureKey, featureOn } from './permissions';

type Info = { payload: Payload; daysLeft: number | null };
const Ctx = createContext<Info | null>(null);
const trialPayload = (): Payload => ({ machine_id: '', client_name: 'Trial', plan_name: 'Free trial', max_users: 1, created_at: '', expiry_date: '', is_lifetime: false, features: {} });
export const useLicense = () => useContext(Ctx);
/** can('stock.manage') – license decides; keys the license does not mention use the schema default. */
export const useCan = () => { const i = useContext(Ctx); return (k: FeatureKey) => featureOn(i?.payload.features, k); };

export default function LicenseGate({ children }: { children: ReactNode }) {
  const { t, toast } = useApp();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<'loading' | 'ok' | 'locked'>('loading');
  const [info, setInfo] = useState<Info | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [trial, setTrial] = useState<TrialState>({ status: 'unused' });
  const [isTrial, setIsTrial] = useState(false);

  const apply = useCallback((r: CheckResult) => {
    if (r.ok) { setInfo({ payload: r.payload, daysLeft: r.daysLeft }); setIsTrial(false); setState('ok'); setError(''); }
    else { setState('locked'); setInfo(null); setError(r.reason === 'format' ? '' : t(REASON_KEYS[r.reason])); }
  }, [t]);
  const recheck = useCallback(async () => {
    const r = await checkSavedLicense();
    // No license saved -> the one-time 7-day trial may apply. A saved but invalid/expired license never falls back to the trial.
    if (!r.ok && r.reason === 'format') {
      const tr = await getTrialState().catch((): TrialState => ({ status: 'unused' }));
      setTrial(tr);
      if (tr.status === 'active') { setInfo({ payload: trialPayload(), daysLeft: tr.daysLeft }); setIsTrial(true); setState('ok'); setError(''); return; }
    }
    apply(r);
    // Server heartbeat + kill switch (silent, only for a real license). If the Hub changed the state, check again.
    if (r.ok) refreshFromHub().then((changed) => { if (changed) checkSavedLicense().then(apply); }).catch(() => {});
  }, [apply]);
  const beginTrial = async () => {
    setBusy(true);
    try { await startTrial(); await recheck(); } finally { setBusy(false); }
  };

  useEffect(() => {
    getDeviceId().then(setDeviceId).catch(() => {});
    recheck();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') recheck(); });
    return () => sub.remove();
  }, [recheck]);

  const activate = async () => {
    if (!input.trim()) return;
    setBusy(true);
    try {
      const r = await activateLicense(input);
      if (r.ok) toast(t('licActivated'), 'success');
      apply(r);
      if (r.ok) setInput('');
    } finally { setBusy(false); }
  };
  const paste = async () => { try { setInput((await Clipboard.getStringAsync()).trim()); } catch { /* ignore */ } };
  const copyId = async () => { try { await Clipboard.setStringAsync(deviceId); toast(t('copied'), 'success'); } catch { /* ignore */ } };

  if (state === 'loading') return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator color={C.primary} /></View>;

  if (state === 'ok' && info) {
    const warn = isTrial || (info.daysLeft !== null && info.daysLeft <= 3);
    const bannerKey = isTrial ? 'trialBanner' : 'licExpiring';
    return (
      <Ctx.Provider value={info}>
        {warn ? <View style={{ backgroundColor: '#FFF3D6', paddingTop: insets.top + 8, paddingBottom: 8, paddingHorizontal: 12 }}><T size={13} center color="#8A5300">{t(bannerKey).replace('{n}', String(info.daysLeft))}</T></View> : null}
        {children}
      </Ctx.Provider>
    );
  }

  return (
    <Screen title={t('licTitle')} scroll>
      <Card>
        <T bold size={15}>{t('licDeviceId')}</T>
        <T selectable size={18} bold color={C.primary} style={{ marginTop: 8, letterSpacing: 0.5, textAlign: 'center' }}>{deviceId || '…'}</T>
        <Muted style={{ marginTop: 8 }}>{t('licHint')}</Muted>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Button block variant="ghost" icon="copy-outline" label={t('licCopy')} onPress={copyId} disabled={!deviceId} />
          <Button block variant="ghost" icon="share-outline" label={t('licShare')} onPress={() => Share.share({ message: deviceId })} disabled={!deviceId} />
        </View>
      </Card>
      <Card>
        <Field label={t('licPaste')} value={input} onChangeText={setInput} multiline autoCapitalize="none" autoCorrect={false} ltr
          placeholder="Paste your license key" />
        {!error && trial.status === 'expired' ? <T size={13.5} bold color={C.danger} style={{ marginBottom: 10 }}>{t('trialExpired')}</T> : null}
        {!error && trial.status === 'clock' ? <T size={13.5} bold color={C.danger} style={{ marginBottom: 10 }}>{t('licClock')}</T> : null}
        {error ? <T size={13.5} bold color={C.danger} style={{ marginBottom: 10 }}>{error}</T> : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button block variant="ghost" icon="clipboard-outline" label={t('licPasteBtn')} onPress={paste} />
          <Button block icon="key" label={t('licActivate')} onPress={activate} loading={busy} disabled={!input.trim()} />
        </View>
      </Card>
      {trial.status === 'unused' && !error ? (
        <Card>
          <Muted style={{ marginBottom: 10 }}>{t('trialHint')}</Muted>
          <Button block variant="ghost" icon="time-outline" label={t('trialStart')} onPress={beginTrial} loading={busy} />
        </Card>
      ) : null}
      <Credit />
    </Screen>
  );
}
