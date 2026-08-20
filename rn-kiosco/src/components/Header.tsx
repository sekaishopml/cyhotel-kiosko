import React, { useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '../theme';

type Props = {
  onUpdate: () => void;
  checking: boolean;
  appVersion: string;
  onServerPress: () => void;
};

function Header({ onUpdate, checking, appVersion, onServerPress }: Props) {
  const [showVersion, setShowVersion] = useState(false);

  return (
    <View style={styles.header}>
      <View>
        <TouchableOpacity onPress={onServerPress} accessibilityLabel="Configurar servidor">
          <Text style={styles.brand}>Hotel del Valle</Text>
          <Text style={styles.sub}>Kiosco {appVersion}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={onUpdate}
          disabled={checking}
          style={[styles.btn, checking && styles.btnDisabled]}
          accessibilityLabel="Buscar actualización"
        >
          <Text style={styles.btnText}>{checking ? 'Buscando…' : 'Actualizar'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowVersion(v => !v)} style={styles.versionBtn} accessibilityLabel="Versión">
          <Text style={styles.versionText}>{appVersion}</Text>
        </TouchableOpacity>
      </View>

      {showVersion && (
        <View style={styles.versionBadge}>
          <Text style={styles.versionBadgeText}>Versión {appVersion}</Text>
          <Text style={styles.versionBadgeSub}>Hotel del Valle · Kiosco</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.verde900,
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  brand: {
    fontFamily: fonts.serif,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.white,
  },
  sub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  versionBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  versionText: {
    color: colors.white,
    fontSize: 11,
  },
  versionBadge: {
    position: 'absolute',
    top: 58,
    right: 16,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  versionBadgeText: {
    color: colors.verde900,
    fontSize: 14,
    fontWeight: '700',
  },
  versionBadgeSub: {
    color: colors.verde700,
    fontSize: 12,
    marginTop: 2,
  },
});

export default Header;