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

const UPDATE_API = 'https://api.github.com/repos/sekaishopml/cyhotel-kiosko/releases/latest';
const APP_VERSION = '6.0.0';
const ADMIN_PIN = '12345';

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
    fetch(UPDATE_API)
      .then(res => {
        if (!res.ok) throw new Error('not-ok');
        return res.json();
      })
      .then(data => {
        const tag = data?.tag_name as string | undefined;
        Alert.alert(
          'Actualización disponible',
          `Nueva versión: ${tag ?? 'desconocida'}\n${data?.body ?? 'Sin descripción'}`,
          [{ text: 'Entendido' }],
        );
      })
      .catch(() => {
        Alert.alert('Sin actualizaciones', 'Ya estás en la última versión.');
      })
      .finally(() => setChecking(false));
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
            <PlanScreen
              onSelectPlan={selectPlan}
              serverLabel={serverBase ? new URL(serverBase).host : '…'}
              onServerPress={openServerModal}
            />
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