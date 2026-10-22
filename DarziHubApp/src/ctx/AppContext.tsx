import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, I18nManager, Platform, StyleSheet, Text, View } from 'react-native';
import { Repo } from '../db/repo';
import { DEFAULT_SETTINGS, Settings } from '../db/types';
import { Lang, translate } from '../lib/i18n';
import { Fmt } from '../lib/format';
import { C, FONT_UR_BOLD, shadow } from '../lib/theme';
import { syncReminders } from '../lib/notify';
import { cleanOrphanPhotos } from '../lib/photos';

type ToastType = 'default' | 'success' | 'error';
interface Ctx {
  settings: Settings;
  lang: Lang;
  rtl: boolean;
  t: (key: string, lang?: Lang) => string;
  setLang: (l: Lang) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  reloadSettings: () => Promise<void>;
  toast: (msg: string, type?: ToastType) => void;
  confirm: (message: string, opts?: { title?: string; danger?: boolean; okLabel?: string }) => Promise<boolean>;
  refreshReminders: () => void;
}
const AppCtx = createContext<Ctx>(null as any);
export const useApp = () => useContext(AppCtx);

try { I18nManager.allowRTL(false); I18nManager.forceRTL(false); } catch { /* layout direction is handled manually */ }

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const lang: Lang = settings.language === 'en' ? 'en' : 'ur';
  Fmt.currency = settings.currency || 'Rs';

  const reloadSettings = useCallback(async () => { setSettings(await Repo.getSettings()); }, []);
  useEffect(() => { reloadSettings(); cleanOrphanPhotos(); }, [reloadSettings]);

  // ---- toast ----
  const [toastState, setToastState] = useState<{ msg: string; type: ToastType } | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((msg: string, type: ToastType = 'default') => {
    if (timer.current) clearTimeout(timer.current);
    setToastState({ msg, type });
    Animated.timing(anim, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToastState(null));
    }, 2200);
  }, [anim]);

  const t = useCallback((key: string, l?: Lang) => translate(key, l || lang), [lang]);

  const confirm = useCallback((message: string, opts: { title?: string; danger?: boolean; okLabel?: string } = {}) =>
    new Promise<boolean>((resolve) => {
      Alert.alert(opts.title || translate('areYouSure', lang), message, [
        { text: translate('cancel', lang), style: 'cancel', onPress: () => resolve(false) },
        { text: opts.okLabel || translate('confirm', lang), style: opts.danger ? 'destructive' : 'default', onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) });
    }), [lang]);

  const refreshReminders = useCallback(() => { syncReminders(lang); }, [lang]);
  useEffect(() => { syncReminders(lang); }, [lang]);

  const saveSettings = useCallback(async (s: Settings) => {
    await Repo.saveSettings(s); setSettings(s);
  }, []);
  const setLang = useCallback(async (l: Lang) => {
    const s = { ...(await Repo.getSettings()), language: l }; await saveSettings(s);
  }, [saveSettings]);

  const value = useMemo<Ctx>(() => ({
    settings, lang, rtl: lang === 'ur', t, setLang, saveSettings, reloadSettings, toast, confirm, refreshReminders,
  }), [settings, lang, t, setLang, saveSettings, reloadSettings, toast, confirm, refreshReminders]);

  return (
    <AppCtx.Provider value={value}>
      {children}
      {toastState && (
        <Animated.View pointerEvents="none" style={[styles.toastWrap, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}>
          <View style={[styles.toast, toastState.type === 'error' && { backgroundColor: C.danger }, toastState.type === 'success' && { backgroundColor: '#0E9F6E' }]}>
            <Text style={[styles.toastText, lang === 'ur' && { fontFamily: FONT_UR_BOLD, lineHeight: 30 }]}>{toastState.msg}</Text>
          </View>
        </Animated.View>
      )}
    </AppCtx.Provider>
  );
}

const styles = StyleSheet.create({
  toastWrap: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 40, left: 16, right: 16, alignItems: 'center', zIndex: 999 },
  toast: { backgroundColor: '#1F2433', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, ...shadow, maxWidth: '100%' },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
