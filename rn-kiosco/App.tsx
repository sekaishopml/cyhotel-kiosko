import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal as RNModal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, fonts } from './src/theme';
import { getServerBase, setServerBase, PLAN_META } from './src/api';
import Header from './src/components/Header';
import PlanScreen from './src/screens/PlanScreen';
import RoomScreen from './src/screens/RoomScreen';
import CheckinScreen from './src/screens/CheckinScreen';

type Screen = 'plan' | 'room' | 'checkin';

const APP_VERSION = '6.0.5';
const ADMIN_PIN = '12345';

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
  const [serverModal, setServerModal] = useState(false);
  const [serverInput, setServerInput] = useState('');
  const [pinInput, setPinInput] = useState('');

  useEffect(() => {
    getServerBase().then(setServerBaseState);
    installCrashReporter();
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

  const checkForUpdate = useCallback(() => {
    if (checking) return;
    setChecking(true);
    (async () => {
      try {
        const base = await getServerBase();
        const res = await fetch(`${base}/api/kiosco-version`);
        if (!res.ok) throw new Error('not-ok');
        const data = await res.json();
        const remoteVersion = String(data?.version ?? '');
        if (!remoteVersion || remoteVersion === APP_VERSION) {
          Alert.alert('Sin actualizaciones', 'Ya estás en la última versión.');
          return;
        }
        const apkPath = String(data?.apk ?? '/kiosco.apk');
        Alert.alert(
          'Actualización disponible',
          `Hay una versión nueva (${remoteVersion}).\n¿Descargarla e instalar ahora?`,
          [
            { text: 'Ahora no', style: 'cancel' },
            {
              text: 'Descargar e instalar',
              onPress: async () => {
                try {
                  const updater = (await import('react-native')).NativeModules.ApkUpdater;
                  const can = await updater.canInstall();
                  if (can === false) {
                    Alert.alert(
                      'Permiso de instalación',
                      'Habilitá "Instalar apps desconocidas" para esta app.',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Configurar', onPress: () => updater.openInstallSettings() },
                      ],
                    );
                    return;
                  }
                  Alert.alert('Descargando…', 'La actualización se está descargando e instalará automáticamente.');
                  await updater.downloadAndInstall(`${base}${apkPath}`);
                } catch (e) {
                  Alert.alert(
                    'No se pudo actualizar',
                    e instanceof Error ? e.message : 'Error al descargar. Revisá tu conexión.',
                  );
                }
              },
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

  const openServerModal = useCallback(() => {
    setServerInput(serverBase ?? '');
    setPinInput('');
    setServerModal(true);
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
        setServerModal(false);
        Alert.alert('Servidor actualizado', `Conectando a:\n${url}`);
        goHome();
      })
      .catch(() => {
        Alert.alert('Error', 'No se pudo guardar la configuración');
      });
  }, [serverInput, goHome]);

  const tryAdmin = useCallback(() => {
    if (pinInput === ADMIN_PIN) {
      setPinInput('');
      openServerModal();
    } else {
      Alert.alert('PIN incorrecto', 'Ingresá el PIN de administración.');
      setPinInput('');
    }
  }, [pinInput, openServerModal]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (screen !== 'plan') goHome();
      }, 90000);
    };
    reset();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [screen, goHome]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [screen, fadeAnim]);

  return (
    <View style={styles.app}>
      <Header
        onUpdate={checkForUpdate}
        checking={checking}
        appVersion={APP_VERSION}
        onServerPress={openServerModal}
      />
      <View style={styles.stage}>
        <Animated.View style={[styles.stage, { opacity: fadeAnim }]}>
          {screen === 'plan' && (
            <PlanScreen onSelectPlan={selectPlan} />
          )}
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
        </Animated.View>
      </View>

      <RNModal visible={serverModal} transparent animationType="fade" onRequestClose={() => setServerModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Servidor</Text>
            <Text style={styles.modalSub}>IP o dominio del servidor (local o VPS)</Text>
            <TextInput
              style={styles.modalInput}
              value={serverInput}
              onChangeText={setServerInput}
              placeholder="http://IP:8000"
              placeholderTextColor="rgba(16,40,29,0.3)"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Text style={styles.modalLabel}>PIN de administrador</Text>
            <TextInput
              style={styles.modalInput}
              value={pinInput}
              onChangeText={setPinInput}
              placeholder="12345"
              placeholderTextColor="rgba(16,40,29,0.3)"
              secureTextEntry
              keyboardType="number-pad"
            />
            <TouchableOpacity onPress={tryAdmin} style={styles.modalBtn} accessibilityLabel="Ingresar PIN">
              <Text style={styles.modalBtnText}>Ingresar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setServerModal(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </RNModal>
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.white,
  },
  stage: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(16,40,29,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 460,
  },
  modalTitle: {
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '600',
    color: colors.verde900,
  },
  modalSub: {
    fontSize: 14,
    color: 'rgba(27,74,53,0.6)',
    marginTop: 4,
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.verde900,
    marginTop: 16,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: 'rgba(20,58,42,0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  modalBtn: {
    backgroundColor: colors.verde900,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  modalBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancel: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  modalCancelText: {
    color: colors.verde600,
    fontSize: 15,
    fontWeight: '500',
  },
});

export default App;