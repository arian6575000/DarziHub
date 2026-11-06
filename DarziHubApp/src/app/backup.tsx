import React, { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Button, Card, Field, Muted, Row, Screen, SectionLabel, SelectField, Sheet, T } from '../ui/kit';
import { decryptBackup, isEncryptedBackup } from '../lib/backupCrypto';
import { useApp } from '../ctx/AppContext';
import { Repo } from '../db/repo';
import { exportBackup, pickBackupFile, restoreBackup } from '../lib/backup';
import { removePin } from '../lib/lock';
import { Fmt } from '../lib/format';
import { useLoad } from '../lib/hooks';
import { C } from '../lib/theme';
import { useCan } from '../license/LicenseGate';
import { cleanOrphanPhotos } from '../lib/photos';

export default function BackupScreen() {
  const canBackup = useCan()('backup.export');
  const { t, lang, toast, confirm, reloadSettings, refreshReminders } = useApp();
  const [st, reload] = useLoad(() => Repo.getSettings(), []);
  const [pending, setPending] = useState<any | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState(false);
  const [expOpen, setExpOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [encFile, setEncFile] = useState<any | null>(null);
  const [pw2, setPw2] = useState('');

  const doExport = async (password?: string) => {
    if (password !== undefined && password.length < 6) { toast(t('backupPasswordMin'), 'error'); return; }
    setExpOpen(false); setPw('');
    setBusy(true);
    try { await exportBackup(password); toast(t('backupDone'), 'success'); reload(); reloadSettings(); }
    catch (e: any) { if (!String(e?.message).includes('cancel')) toast(t('shareFailed'), 'error'); }
    finally { setBusy(false); }
  };
  const pick = async () => {
    try {
      const p = await pickBackupFile();
      if (p) { if (isEncryptedBackup(p)) { setPw2(''); setEncFile(p); return; } if (!p.data) throw new Error('invalidBackup'); setPending(p); }
    }
    catch (e: any) { toast(t(String(e?.message) === 'invalidBackup' ? 'invalidBackup' : 'invalidBackup'), 'error'); }
  };
  const unlockEnc = () => {
    setBusy(true);
    // let the sheet close before the (CPU heavy) decrypt starts
    setTimeout(() => {
      try { const p = decryptBackup(encFile, pw2); if (!p?.data) throw new Error('invalidBackup'); setEncFile(null); setPw2(''); setPending(p); }
      catch (e: any) { toast(t(String(e?.message) === 'wrongBackupPassword' ? 'wrongBackupPassword' : 'invalidBackup'), 'error'); }
      finally { setBusy(false); }
    }, 50);
  };
  const doImport = async () => {
    const p = pending; setPending(null); setBusy(true);
    try { await restoreBackup(p, mode); await reloadSettings(); refreshReminders(); toast(t('imported'), 'success'); router.replace('/'); }
    catch (e: any) { toast(t(String(e?.message) === 'invalidBackup' ? 'invalidBackup' : 'invalidBackup') + ' — ' + String(e?.message || ''), 'error'); }
    finally { setBusy(false); }
  };
  const wipe = async () => {
    if (!(await confirm(t('eraseMsg'), { danger: true, okLabel: t('eraseEverything') }))) return;
    if (!(await confirm(t('eraseMsg2'), { danger: true, okLabel: t('eraseYes') }))) return;
    await Repo.wipeAll(); await removePin(); await cleanOrphanPhotos(); await reloadSettings(); refreshReminders();
    toast(t('erased'), 'success'); router.replace('/');
  };
  const d = pending?.data || {};
  if (!canBackup) return <Screen back title={t('backupRestore')}><Muted center style={{ marginTop: 40 }}>{t('featureLocked')}</Muted></Screen>;
  return (
    <Screen back title={t('backupRestore')}>
      <SectionLabel>{`${t('export')} · ${t('lastBackup')}: ${st?.lastBackupAt ? Fmt.date(st.lastBackupAt, lang) : t('never')}`}</SectionLabel>
      <Card onPress={busy ? undefined : () => { setPw(''); setExpOpen(true); }}>
        <Row gap={12}><Ionicons name="download" size={26} color={C.primary} /><View style={{ flex: 1 }}><T bold size={15}>{t('exportAll')}</T><Muted>{t('exportHint')}</Muted></View></Row>
      </Card>
      <SectionLabel>{t('import')}</SectionLabel>
      <Card onPress={busy ? undefined : pick}>
        <Row gap={12}><Ionicons name="push" size={26} color={C.primary2} /><View style={{ flex: 1 }}><T bold size={15}>{t('importBackup')}</T><Muted>{t('importHint')}</Muted></View></Row>
      </Card>
      <SectionLabel>{t('dangerZone')}</SectionLabel>
      <Card onPress={busy ? undefined : wipe}>
        <Row gap={12}><Ionicons name="trash" size={26} color={C.danger} /><View style={{ flex: 1 }}><T bold size={15} color={C.danger}>{t('eraseAll')}</T><Muted>{t('eraseHint')}</Muted></View></Row>
      </Card>
      <Muted style={{ padding: 6, lineHeight: 20 }}>{t('backupNote')}</Muted>

      <Sheet visible={expOpen} onClose={() => setExpOpen(false)} title={t('exportAll')}>
        <Muted style={{ marginBottom: 12 }}>{t('encBackupHint')}</Muted>
        <Field label={t('backupPassword')} value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" autoCorrect={false} ltr />
        <Row><Button block variant="ghost" label={t('plainBackup')} onPress={() => doExport()} /><Button block icon="lock-closed" label={t('encBackup')} onPress={() => doExport(pw)} /></Row>
      </Sheet>
      <Sheet visible={!!encFile} onClose={() => setEncFile(null)} title={t('importBackup')}>
        <Muted style={{ marginBottom: 12 }}>{t('enterBackupPassword')}</Muted>
        <Field label={t('backupPassword')} value={pw2} onChangeText={setPw2} secureTextEntry autoCapitalize="none" autoCorrect={false} ltr />
        <Row><Button block variant="ghost" label={t('cancel')} onPress={() => setEncFile(null)} /><Button block label={t('confirm')} onPress={unlockEnc} loading={busy} /></Row>
      </Sheet>
      <Sheet visible={!!pending} onClose={() => setPending(null)} title={t('importBackup')}>
        <Muted style={{ marginBottom: 14 }}>{`${(d.customers || []).length} ${t('navCustomers')}, ${(d.orders || []).length} ${t('navOrders')}`}</Muted>
        <SelectField label={t('importMode')} value={mode} onChange={(v) => setMode(v as 'merge' | 'replace')} options={[{ value: 'merge', label: t('modeMerge') }, { value: 'replace', label: t('modeReplace') }]} />
        <Row><Button block variant="ghost" label={t('cancel')} onPress={() => setPending(null)} /><Button block label={t('import')} onPress={doImport} /></Row>
      </Sheet>
    </Screen>
  );
}
