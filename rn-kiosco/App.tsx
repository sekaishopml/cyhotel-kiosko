import React, { useCallback, useEffect, useState } from 'react';
import { Alert, DeviceEventEmitter, Modal as RNModal, NativeModules, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, radii, sizes, spacing, typography } from './src/theme';
import { getServerBase, getTypes, setServerBase } from './src/api';
import KioskHeader from './src/components/KioskHeader';
import HomeScreen from './src/screens/HomeScreen';
import RoomScreen from './src/screens/RoomScreen';
import CheckinScreen from './src/screens/CheckinScreen';
import ScreenTransition from './src/components/ScreenTransition';
import IdleScreen from './src/components/IdleScreen';
import Shimmer from './src/components/Shimmer';

type Screen = 'plan' | 'room' | 'checkin';

const APP_VERSION = '6.6.0';
const ADMIN_PIN = '12345';
const IDLE_MS = 90000;

function reportCrash(error: unknown, isFatal: boolean) {
  try {
    getServerBase().then(base => {
      fetch(`${base}/api/kiosco-crash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: 'rn', version: APP_VERSION, error: String(error instanceof Error ? error.message : error), stack: String(error instanceof Error ? error.stack : ''), isFatal, time: new Date().toISOString() }),
      }).catch(() => {});
    });
  } catch {}
}

function installCrashReporter() {
  if (__DEV__) return;
  const prev = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => { reportCrash(error, !!isFatal); prev(error, isFatal); });
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('plan');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedExtra, setSelectedExtra] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState(1);
  const [checking, setChecking] = useState(false);
  const [roomLabel, setRoomLabel] = useState('');
  const [total, setTotal] = useState(0);
  const [serverBase, setServerBaseState] = useState<string | null>(null);
  const [adminModal, setAdminModal] = useState(false);
  const [adminView, setAdminView] = useState<'pin' | 'panel' | 'server'>('pin');
  const [serverInput, setServerInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [idle, setIdle] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getServerBase().then(setServerBaseState);
    installCrashReporter();
    try { StatusBar.setHidden(true); } catch {}
    getTypes('momento').finally(() => setLoading(false));
  }, []);

  const goHome = useCallback(() => {
    setSelectedPlan(null); setSelectedRoom(null); setSelectedExtra(null);
    setSelectedDays(1); setRoomLabel(''); setTotal(0); setScreen('plan');
  }, []);

  const selectPlan = useCallback((k: string) => {
    setSelectedPlan(k); setSelectedRoom(null); setSelectedExtra(null); setSelectedDays(1); setScreen('room');
  }, []);

  const selectRoom = useCallback((k: string | null) => { setSelectedRoom(k); setSelectedExtra(null); if (k) setSelectedDays(1); }, []);
  const continueToCheckin = useCallback((l: string, t: number) => { setRoomLabel(l); setTotal(t); setScreen('checkin'); }, []);
  const wakeUp = useCallback(() => { if (idle) { setIdle(false); goHome(); } }, [idle, goHome]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reset = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { setIdle(true); goHome(); }, IDLE_MS); };
    reset();
    return () => { if (timer) clearTimeout(timer); };
  }, [screen, goHome, idle]);

  const checkForUpdate = useCallback(() => {
    if (checking) return;
    setChecking(true);
    (async () => {
      try {
        const base = await getServerBase();
        const res = await fetch(`${base}/api/kiosco-version`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const remote = String(data?.version ?? '');
        if (!remote || remote === APP_VERSION) { Alert.alert('Sin actualizaciones', 'Ya estás en la última versión.'); return; }
        const apkPath = String(data?.apk ?? '/kiosco.apk');
        Alert.alert('Actualización disponible', `Versión ${remote} lista para instalarse.`, [
          { text: 'Ahora no', style: 'cancel' },
          { text: 'Actualizar ahora', onPress: () => startUpdate(`${base}${apkPath}`, remote) },
        ]);
      } catch { Alert.alert('Sin actualizaciones', 'No se pudo consultar el servidor.'); }
      finally { setChecking(false); }
    })();
  }, [checking]);

  const startUpdate = useCallback(async (apkUrl: string, v: string) => {
    const updater = NativeModules.ApkUpdater;
    if (!updater) { Alert.alert('Error', 'Módulo de actualización no disponible.'); return; }
    try { const can = await updater.canInstall(); if (can === false) { Alert.alert('Permiso de instalación', 'Habilitá "Instalar apps desconocidas" para continuar.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Configurar', onPress: () => updater.openInstallSettings() }]); return; } } catch { Alert.alert('Error', 'No se pudo verificar el permiso.'); return; }
    Alert.alert('Actualizando…', `Descargando versión ${v}…`);
    const sub = DeviceEventEmitter.addListener('apkDownloadProgress', () => {});
    try { await updater.downloadAndInstall(apkUrl); }
    catch (e: any) { const m = e?.message || String(e); Alert.alert('Error de actualización', m.includes('download_failed') ? 'No se pudo descargar el APK.' : m.includes('no_installer') ? 'No hay instalador de paquetes.' : m || 'No se pudo instalar.'); }
    finally { sub.remove(); }
  }, []);

  const openAdmin = useCallback(() => { setPinInput(''); setAdminView('pin'); setAdminModal(true); }, []);
  const tryAdmin = useCallback(() => {
    if (pinInput === ADMIN_PIN) { setPinInput(''); setAdminView('panel'); }
    else { Alert.alert('PIN incorrecto', 'Ingresá el PIN de administración.'); setPinInput(''); }
  }, [pinInput]);
  const openServerInput = useCallback(() => { setServerInput(serverBase ?? ''); setAdminView('server'); }, [serverBase]);
  const saveServer = useCallback(() => {
    const url = serverInput.trim();
    if (!/^https?:\/\/.+/.test(url)) { Alert.alert('URL inválida', 'Debe comenzar con http:// o https://'); return; }
    setServerBase(url).then(() => { setServerBaseState(url); setAdminModal(false); Alert.alert('Servidor actualizado', 'Listo.'); goHome(); }).catch(() => { Alert.alert('Error', 'No se pudo guardar'); });
  }, [serverInput, goHome]);

  if (loading) return <View style={s.loading}><Shimmer /></View>;

  return (
    <View style={s.app} onTouchStart={wakeUp}>
      <KioskHeader onAdminLongPress={openAdmin} />
      <View style={s.stage}>
        <ScreenTransition screenKey={screen}>
          {screen === 'plan' && <HomeScreen onSelectPlan={selectPlan} />}
          {screen === 'room' && selectedPlan && <RoomScreen planKey={selectedPlan} selectedRoom={selectedRoom} selectedExtra={selectedExtra} selectedDays={selectedDays} onSelectRoom={selectRoom} onSelectExtra={setSelectedExtra} onSelectDays={setSelectedDays} onContinue={continueToCheckin} onBack={goHome} />}
          {screen === 'checkin' && selectedPlan && selectedRoom && <CheckinScreen planKey={selectedPlan} roomLabel={roomLabel} roomKey={selectedRoom} durationLabel={selectedExtra} days={selectedDays} total={total} onBack={() => setScreen('room')} onSuccess={goHome} />}
        </ScreenTransition>
      </View>
      {idle && <IdleScreen onWake={wakeUp} />}
      <RNModal visible={adminModal} transparent animationType="fade" onRequestClose={() => setAdminModal(false)}>
        <View style={s.mOverlay}>
          <View style={s.mCard}>
            {adminView === 'pin' && (<>
              <Text style={s.mTitle}>Acceso restringido</Text>
              <Text style={s.mSub}>Ingresá el PIN de administración</Text>
              <TextInput style={s.mInput} value={pinInput} onChangeText={setPinInput} placeholder="•••••" placeholderTextColor={colors.textMuted} secureTextEntry keyboardType="number-pad" autoFocus />
              <TouchableOpacity onPress={tryAdmin} style={s.mBtn}><Text style={s.mBtnTxt}>Ingresar</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setAdminModal(false)} style={s.mCancel}><Text style={s.mCancelTxt}>Cancelar</Text></TouchableOpacity>
            </>)}
            {adminView === 'panel' && (<>
              <Text style={s.mTitle}>Administración</Text>
              <Text style={s.mSub}>Versión {APP_VERSION}</Text>
              <TouchableOpacity onPress={checkForUpdate} disabled={checking} style={[s.mBtn, checking && { opacity: 0.5 }]}><Text style={s.mBtnTxt}>{checking ? 'Buscando…' : 'Buscar actualización'}</Text></TouchableOpacity>
              <TouchableOpacity onPress={openServerInput} style={[s.mBtn, s.mBtnOutline]}><Text style={s.mBtnOutlineTxt}>Configurar servidor</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setAdminModal(false)} style={s.mCancel}><Text style={s.mCancelTxt}>Cerrar</Text></TouchableOpacity>
            </>)}
            {adminView === 'server' && (<>
              <Text style={s.mTitle}>Servidor</Text>
              <Text style={s.mSub}>Dirección del servidor</Text>
              <TextInput style={s.mInput} value={serverInput} onChangeText={setServerInput} placeholder="http://IP:8000" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
              <TouchableOpacity onPress={saveServer} style={s.mBtn}><Text style={s.mBtnTxt}>Guardar</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setAdminView('panel')} style={s.mCancel}><Text style={s.mCancelTxt}>Volver</Text></TouchableOpacity>
            </>)}
          </View>
        </View>
      </RNModal>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.brandPrimary },
  app: { flex: 1, backgroundColor: colors.brandPrimary },
  stage: { flex: 1 },
  mOverlay: { flex: 1, backgroundColor: colors.overlayDark, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  mCard: { backgroundColor: colors.brandPrimary, borderRadius: radii.card, padding: spacing.xl, width: '100%', maxWidth: 440, borderWidth: 1, borderColor: colors.border },
  mTitle: { fontFamily: typography.serifBold, fontSize: sizes.title, color: colors.brandCream, marginBottom: 4 },
  mSub: { fontFamily: typography.sans, fontSize: sizes.cardSubtitle, color: colors.textMuted, marginBottom: spacing.lg },
  mInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.button, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: sizes.input, color: colors.brandCream, backgroundColor: 'rgba(244,238,226,0.06)', textAlign: 'center', letterSpacing: 6 },
  mBtn: { backgroundColor: colors.brandAccent, borderRadius: radii.button, paddingVertical: 16, alignItems: 'center', marginTop: spacing.md },
  mBtnTxt: { color: colors.brandPrimary, fontSize: sizes.cta, fontWeight: '600', fontFamily: typography.sansMedium },
  mBtnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.brandAccent },
  mBtnOutlineTxt: { color: colors.brandAccent, fontSize: sizes.cta, fontWeight: '600', fontFamily: typography.sansMedium },
  mCancel: { paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  mCancelTxt: { color: colors.textMuted, fontSize: sizes.cardSubtitle, fontFamily: typography.sans },
});
