import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Modal as RNModal,
  NativeModules,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, sizes, spacing, radii, typography } from './src/theme';
import { getServerBase, setServerBase } from './src/api';
import KioskHeader from './src/components/KioskHeader';
import HomeScreen from './src/screens/HomeScreen';
import RoomScreen from './src/screens/RoomScreen';
import CheckinScreen from './src/screens/CheckinScreen';
import ScreenTransition from './src/components/ScreenTransition';
import IdleScreen from './src/components/IdleScreen';

type Screen = 'plan' | 'room' | 'checkin';

const APP_VERSION = '6.1.7';
const ADMIN_PIN = '12345';
const IDLE_MS = 90000;

function reportCrash(error: unknown, isFatal: boolean) {
  try {
    getServerBase().then(base => {
      fetch(`${base}/api/kiosco-crash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app: 'rn',
          version: APP_VERSION,
          error: String(error instanceof Error ? error.message : error),
          stack: String(error instanceof Error ? error.stack : ''),
          isFatal,
          time: new Date().toISOString(),
        }),
      }).catch(() => {});
    });
  } catch {}
}

function installCrashReporter() {
  if (__DEV__) return;
  const prev = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    reportCrash(error, !!isFatal);
    prev(error, isFatal);
  });
}

function App() {
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

  useEffect(() => {
    getServerBase().then(setServerBaseState);
    installCrashReporter();
    // Hide status bar on app start for kiosk mode
    try {
      StatusBar.setHidden(true);
      StatusBar.setBarStyle('light-content');
    } catch (e) {
      // StatusBar not available in web mode, ignore
    }
  }, []);

  const goHome = useCallback(() => {
    setSelectedPlan(null);
    setSelectedRoom(null);
    setSelectedExtra(null);
    setSelectedDays(1);
    setRoomLabel('');
    setTotal(0);
    setScreen('plan');
  }, []);

  const selectPlan = useCallback((planKey: string) => {
    setSelectedPlan(planKey);
    setSelectedRoom(null);
    setSelectedExtra(null);
    setSelectedDays(1);
    setScreen('room');
  }, []);

  const selectRoom = useCallback((key: string | null) => {
    setSelectedRoom(key);
    setSelectedExtra(null);
    if (key) setSelectedDays(1);
  }, []);

  const continueToCheckin = useCallback((label: string, amount: number) => {
    setRoomLabel(label);
    setTotal(amount);
    setScreen('checkin');
  }, []);

  const wakeUp = useCallback(() => {
    if (idle) {
      setIdle(false);
      goHome();
    }
  }, [idle, goHome]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setIdle(true);
        goHome();
      }, IDLE_MS);
    };
    reset();
    return () => {
      if (timer) clearTimeout(timer);
    };
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
        const remoteVersion = String(data?.version ?? '');
        if (!remoteVersion || remoteVersion === APP_VERSION) {
          Alert.alert('Sin actualizaciones', 'Ya estás en la última versión.');
          return;
        }
        const apkPath = String(data?.apk ?? '/kiosco.apk');
        Alert.alert(
          'Actualización disponible',
          `Versión ${remoteVersion} lista para instalarse.`,
          [
            { text: 'Ahora no', style: 'cancel' },
            {
              text: 'Actualizar ahora',
              onPress: () => startUpdate(`${base}${apkPath}`, remoteVersion),
            },
          ],
        );
      } catch {
        Alert.alert('Sin actualizaciones', 'No se pudo consultar el servidor.');
      } finally {
        setChecking(false);
      }
    })();
  }, [checking]);

  const startUpdate = useCallback(async (apkUrl: string, newVersion: string) => {
    const updater = NativeModules.ApkUpdater;
    if (!updater) {
      Alert.alert('Error', 'Módulo de actualización no disponible.');
      return;
    }
    try {
      const can = await updater.canInstall();
      if (can === false) {
        Alert.alert(
          'Permiso de instalación',
          'Habilitá "Instalar apps desconocidas" para continuar.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Configurar', onPress: () => updater.openInstallSettings() },
          ],
        );
        return;
      }
    } catch {
      Alert.alert('Error', 'No se pudo verificar el permiso de instalación.');
      return;
    }

    Alert.alert('Actualizando…', `Descargando versión ${newVersion}…`);

    const sub = DeviceEventEmitter.addListener('apkDownloadProgress', (e: { loaded: number; total: number }) => {
      if (e.total > 0) {
        const pct = Math.round((e.loaded / e.total) * 100);
        const mb = (e.loaded / (1024 * 1024)).toFixed(1);
        const totalMb = (e.total / (1024 * 1024)).toFixed(0);
      }
    });

    try {
      await updater.downloadAndInstall(apkUrl);
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes('download_failed')) {
        Alert.alert('Error de descarga', 'No se pudo descargar el APK. Verificá la conexión y el servidor.');
      } else if (msg.includes('no_installer')) {
        Alert.alert('Error', 'No hay instalador de paquetes en el dispositivo.');
      } else {
        Alert.alert('Error de actualización', msg || 'No se pudo instalar la actualización.');
      }
    } finally {
      sub.remove();
    }
  }, []);

  const openAdmin = useCallback(() => {
    setPinInput('');
    setAdminView('pin');
    setAdminModal(true);
  }, []);

  const tryAdmin = useCallback(() => {
    if (pinInput === ADMIN_PIN) {
      setPinInput('');
      setAdminView('panel');
    } else {
      Alert.alert('PIN incorrecto', 'Ingresá el PIN de administración.');
      setPinInput('');
    }
  }, [pinInput]);

  const openServerInput = useCallback(() => {
    setServerInput(serverBase ?? '');
    setAdminView('server');
  }, [serverBase]);

  const saveServer = useCallback(() => {
    const url = serverInput.trim();
    if (!/^https?:\/\/.+/.test(url)) {
      Alert.alert('URL inválida', 'Debe comenzar con http:// o https://');
      return;
    }
    setServerBase(url)
      .then(() => {
        setServerBaseState(url);
        setAdminModal(false);
        Alert.alert('Servidor actualizado', 'Listo. La app se reconectará.');
        goHome();
      })
      .catch(() => {
        Alert.alert('Error', 'No se pudo guardar la configuración');
      });
  }, [serverInput, goHome]);

  return (
    <View style={styles.app} onTouchStart={wakeUp}>
      <KioskHeader onAdminLongPress={openAdmin} />
      <View style={styles.stage}>
        <ScreenTransition screenKey={screen}>
          {screen === 'plan' && <HomeScreen onSelectPlan={selectPlan} />}
          {screen === 'room' && selectedPlan && (
            <RoomScreen
              planKey={selectedPlan}
              selectedRoom={selectedRoom}
              selectedExtra={selectedExtra}
              selectedDays={selectedDays}
              onSelectRoom={selectRoom}
              onSelectExtra={setSelectedExtra}
              onSelectDays={setSelectedDays}
              onContinue={continueToCheckin}
              onBack={goHome}
            />
          )}
          {screen === 'checkin' && selectedPlan && selectedRoom && (
            <CheckinScreen
              planKey={selectedPlan}
              roomLabel={roomLabel}
              roomKey={selectedRoom}
              durationLabel={selectedExtra}
              days={selectedDays}
              total={total}
              onBack={() => setScreen('room')}
              onSuccess={goHome}
            />
          )}
        </ScreenTransition>
      </View>

      {idle && <IdleScreen />}

      <RNModal visible={adminModal} transparent animationType="fade" onRequestClose={() => setAdminModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {adminView === 'panel' && (
              <>
                <Text style={styles.modalTitle}>Administración</Text>
                <Text style={styles.modalSub}>Versión {APP_VERSION}</Text>

                <TouchableOpacity
                  onPress={checkForUpdate}
                  disabled={checking}
                  style={[styles.modalBtn, checking && styles.modalBtnDisabled]}
                  accessibilityLabel="Buscar actualización"
                >
                  <Text style={styles.modalBtnText}>
                    {checking ? 'Buscando…' : 'Buscar actualización'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    try {
                      const isHidden = StatusBar.isBarHidden ? StatusBar.isBarHidden() : true;
                      if (isHidden) {
                        StatusBar.setHidden(false);
                        Alert.alert('Modo kiosk', 'Se mostrará la barra de notificaciones y navegación. Reinicia la app para aplicar.');
                      } else {
                        StatusBar.setHidden(true);
                        StatusBar.setBarStyle('light-content');
                        Alert.alert('Modo kiosk', 'Barra de notificaciones oculta. Usá el icono ⚙ para volver a mostrarla.');
                      }
                    } catch (e) {
                      Alert.alert('Error', 'No se pudo cambiar el modo kiosk');
                    }
                  }}
                  style={[styles.modalBtn, styles.modalBtnOutline]}
                  accessibilityLabel="Alternar modo kiosk"
                >
                  <Text style={styles.modalBtnOutlineText}>
                    {StatusBar.isBarHidden ? 'Mostrar barra' : 'Ocultar barra'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={openServerInput}
                  style={[styles.modalBtn, styles.modalBtnOutline]}
                  accessibilityLabel="Configurar servidor"
                >
                  <Text style={styles.modalBtnOutlineText}>Configurar servidor</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setAdminModal(false)} style={styles.modalCancel}>
                  <Text style={styles.modalCancelText}>Cerrar</Text>
                </TouchableOpacity>
              </>
            )}

            {adminView === 'server' && (
              <>
                <Text style={styles.modalTitle}>Servidor</Text>
                <Text style={styles.modalSub}>Dirección del servidor local o VPS</Text>
                <TextInput
                  style={styles.modalInput}
                  value={serverInput}
                  onChangeText={setServerInput}
                  placeholder="http://IP:8000"
                  placeholderTextColor="rgba(31,59,44,0.35)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <TouchableOpacity onPress={saveServer} style={styles.modalBtn} accessibilityLabel="Guardar servidor">
                  <Text style={styles.modalBtnText}>Guardar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAdminView('panel')} style={styles.modalCancel}>
                  <Text style={styles.modalCancelText}>Volver</Text>
                </TouchableOpacity>
              </>
            )}

            {adminView === 'pin' && (
              <>
                <Text style={styles.modalTitle}>Acceso restringido</Text>
                <Text style={styles.modalSub}>Ingresá el PIN de administración</Text>
                <TextInput
                  style={styles.modalInput}
                  value={pinInput}
                  onChangeText={setPinInput}
                  placeholder="•••••"
                  placeholderTextColor="rgba(31,59,44,0.35)"
                  secureTextEntry
                  keyboardType="number-pad"
                  autoFocus
                />
                <TouchableOpacity onPress={tryAdmin} style={styles.modalBtn} accessibilityLabel="Ingresar PIN">
                  <Text style={styles.modalBtnText}>Ingresar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAdminModal(false)} style={styles.modalCancel}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </RNModal>
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  stage: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(31,59,44,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 480,
  },
  modalTitle: {
    fontFamily: typography.serif,
    fontSize: sizes.cardTitle,
    fontWeight: '600',
    color: colors.brandPrimary,
  },
  modalSub: {
    fontFamily: typography.sans,
    fontSize: sizes.cardSubtitle,
    color: colors.textInk,
    opacity: 0.65,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.button,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: sizes.cta,
    color: colors.textInk,
    backgroundColor: colors.elevated,
    textAlign: 'center',
    letterSpacing: 6,
  },
  modalBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radii.button,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: spacing.md,
    minHeight: 60,
    justifyContent: 'center',
  },
  modalBtnDisabled: {
    opacity: 0.5,
  },
  modalBtnText: {
    color: colors.textPrimary,
    fontSize: sizes.cta,
    fontWeight: '600',
    fontFamily: typography.sans,
  },
  modalBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.brandPrimary,
  },
  modalBtnOutlineText: {
    color: colors.brandPrimary,
    fontSize: sizes.cta,
    fontWeight: '600',
    fontFamily: typography.sans,
  },
  modalCancel: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  modalCancelText: {
    color: colors.brandPrimary,
    fontSize: sizes.cardSubtitle,
    fontWeight: '500',
    fontFamily: typography.sans,
  },
});

export default App;