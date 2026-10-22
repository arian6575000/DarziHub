import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../ctx/AppContext';
import { Avatar, T } from './kit';
import { C, shadow } from '../lib/theme';
import { removePin, verifyPin } from '../lib/lock';
import { Repo } from '../db/repo';

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { t, confirm, reloadSettings } = useApp();
  const [pin, setPin] = useState('');
  const [fails, setFails] = useState(0);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const press = async (k: string) => {
    if (busy) return;
    let next = pin;
    if (k === 'back') next = pin.slice(0, -1); else if (k === 'clear') next = ''; else if (pin.length < 4) next = pin + k;
    setPin(next); setMsg('');
    if (next.length === 4) {
      setBusy(true);
      if (await verifyPin(next)) { onUnlock(); return; }
      setFails((f) => f + 1); setPin(''); setMsg(t('wrongPin')); setBusy(false);
    }
  };
  const forgot = async () => {
    if (!(await confirm(t('forgotPinMsg'), { danger: true, okLabel: t('eraseEverything') }))) return;
    await Repo.wipeAll(); await removePin(); await reloadSettings(); onUnlock();
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg, zIndex: 100 }]}>
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 340, backgroundColor: '#fff', borderRadius: 28, padding: 24, alignItems: 'center', ...shadow }}>
          <Avatar icon="lock-closed" size={56} />
          <T bold size={19} style={{ marginTop: 12 }}>{t('enterPin')}</T>
          <View style={{ flexDirection: 'row', gap: 14, marginVertical: 18 }}>
            {[0, 1, 2, 3].map((i) => <View key={i} style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: C.primary, backgroundColor: i < pin.length ? C.primary : 'transparent' }} />)}
          </View>
          <T size={13} color={C.danger} style={{ minHeight: 28 }}>{msg}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 252, gap: 12, justifyContent: 'center' }}>
            {keys.map((k) => (
              <Pressable key={k} onPress={() => press(k)} style={({ pressed }) => [styles.key, pressed && { backgroundColor: 'rgba(62,107,255,0.18)' }]}>
                {k === 'back' ? <Ionicons name="backspace-outline" size={24} color={C.soft} /> : k === 'clear' ? <T bold size={18} color={C.soft}>C</T> : <T bold size={24}>{k}</T>}
              </Pressable>
            ))}
          </View>
          {fails >= 5 ? <Pressable onPress={forgot} style={{ marginTop: 16 }}><T bold size={13} color={C.danger}>{t('forgotPin')}</T></Pressable> : null}
        </View>
      </SafeAreaView>
    </View>
  );
}
const styles = StyleSheet.create({ key: { width: 72, height: 56, borderRadius: 18, backgroundColor: 'rgba(62,107,255,0.08)', alignItems: 'center', justifyContent: 'center' } });
