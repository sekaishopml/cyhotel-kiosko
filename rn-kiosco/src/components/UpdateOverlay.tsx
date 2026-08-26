import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, radii, sizes, spacing, typography } from '../theme';
import { EASE_OUT_EXPO, usePulse } from '../lib/anims';

export type UpdateStatus = 'available' | 'downloading' | 'installing' | 'error' | 'uptodate' | 'permission';

type Props = {
  status: UpdateStatus;
  version: string;
  percent: number;
  loaded: number;
  total: number;
  error: string;
  onUpdate: () => void;
  onCancel: () => void;
  onOpenSettings: () => void;
  onRetry: () => void;
  onClose: () => void;
};

const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

export default function UpdateOverlay({ status, version, percent, loaded, total, error, onUpdate, onCancel, onOpenSettings, onRetry, onClose }: Props) {
  const pulse = usePulse(1500);
  const show = status !== undefined && status !== null;

  return (
    <View style={s.root} pointerEvents={show ? 'auto' : 'none'}>
      <LinearGradient colors={['#13231A', '#0E1A13', '#0A120D']} style={StyleSheet.absoluteFillObject} />
      <View style={s.watermark}>
        <Text style={s.watermarkTxt}>HV</Text>
      </View>

      <View style={s.card}>
        {status === 'available' && (
          <View style={s.center}>
            <View style={s.iconBox}><Text style={s.iconTxt}>↓</Text></View>
            <Text style={s.title}>Actualización disponible</Text>
            <Text style={s.subtitle}>Versión {version} lista para instalar</Text>
            <TouchableOpacity onPress={onUpdate} style={s.primaryBtn} accessibilityLabel="Actualizar ahora">
              <Text style={s.primaryTxt}>ACTUALIZAR AHORA</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onCancel} style={s.ghostBtn}>
              <Text style={s.ghostTxt}>AHORA NO</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'downloading' && (
          <View style={s.center}>
            <Text style={s.title}>Descargando actualización</Text>
            <Text style={s.subtitle}>No cierres esta pantalla</Text>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${percent}%` }]} />
            </View>
            <Text style={s.percent}>{percent}%</Text>
            <Text style={s.mb}>{mb(loaded)} MB / {mb(total)} MB</Text>
          </View>
        )}

        {status === 'installing' && (
          <View style={s.center}>
            <Animated.View style={[s.ring, pulse]}>
              <View style={s.ringInner}><Text style={s.ringTxt}>✓</Text></View>
            </Animated.View>
            <Text style={s.title}>Instalando…</Text>
            <Text style={s.subtitle}>Confirmá la instalación en tu dispositivo</Text>
            <TouchableOpacity onPress={onClose} style={s.ghostBtn}>
              <Text style={s.ghostTxt}>CERRAR</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'permission' && (
          <View style={s.center}>
            <View style={s.iconBox}><Text style={s.iconTxt}>⚙</Text></View>
            <Text style={s.title}>Permiso necesario</Text>
            <Text style={s.subtitle}>Habiltá "Instalar apps desconocidas" para continuar</Text>
            <TouchableOpacity onPress={onOpenSettings} style={s.primaryBtn}>
              <Text style={s.primaryTxt}>CONFIGURAR</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onCancel} style={s.ghostBtn}>
              <Text style={s.ghostTxt}>CANCELAR</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'error' && (
          <View style={s.center}>
            <View style={[s.iconBox, s.iconErr]}><Text style={s.iconTxt}>!</Text></View>
            <Text style={s.title}>No se pudo actualizar</Text>
            <Text style={s.subtitle}>{error || 'Ocurrió un error inesperado'}</Text>
            <TouchableOpacity onPress={onRetry} style={s.primaryBtn}>
              <Text style={s.primaryTxt}>REINTENTAR</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={s.ghostBtn}>
              <Text style={s.ghostTxt}>CERRAR</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'uptodate' && (
          <View style={s.center}>
            <Animated.View style={[s.ring, pulse]}>
              <View style={s.ringInner}><Text style={s.ringTxt}>✓</Text></View>
            </Animated.View>
            <Text style={s.title}>Todo al día</Text>
            <Text style={s.subtitle}>Ya tenés la última versión</Text>
            <TouchableOpacity onPress={onClose} style={s.primaryBtn}>
              <Text style={s.primaryTxt}>CERRAR</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.screen,
    zIndex: 50,
  },
  watermark: {
    position: 'absolute',
    bottom: 30,
    right: -20,
    opacity: 0.05,
    pointerEvents: 'none',
  },
  watermarkTxt: {
    fontFamily: typography.display,
    fontSize: 240,
    color: colors.brandCream,
    letterSpacing: -8,
  },
  card: {
    width: '100%',
    maxWidth: 760,
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontFamily: typography.serifBold,
    fontSize: sizes.updateTitle,
    color: colors.brandCream,
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: typography.sansMedium,
    fontSize: sizes.updateText,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: spacing.xl,
    letterSpacing: 0.5,
  },
  iconBox: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.brandAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconErr: {
    backgroundColor: colors.error,
  },
  iconTxt: {
    fontFamily: typography.sansMedium,
    fontSize: sizes.updateBig,
    color: colors.brandPrimary,
    fontWeight: '700',
  },
  ring: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.brandAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  ringInner: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.brandAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTxt: {
    fontFamily: typography.sansMedium,
    fontSize: 44,
    color: colors.brandPrimary,
    fontWeight: '700',
  },
  barTrack: {
    width: '100%',
    height: 26,
    backgroundColor: 'rgba(244,238,226,0.12)',
    borderRadius: 13,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.brandAccent,
    borderRadius: 13,
  },
  percent: {
    fontFamily: typography.serifBold,
    fontSize: sizes.updateBig,
    color: colors.brandCream,
    marginBottom: spacing.xs,
  },
  mb: {
    fontFamily: typography.sansMedium,
    fontSize: sizes.updateText,
    color: colors.textLight,
  },
  primaryBtn: {
    backgroundColor: colors.brandAccent,
    borderRadius: radii.button,
    paddingVertical: 22,
    paddingHorizontal: 48,
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.sm,
  },
  primaryTxt: {
    color: colors.brandPrimary,
    fontSize: sizes.cta,
    fontWeight: '700',
    fontFamily: typography.sansMedium,
    letterSpacing: 1.5,
  },
  ghostBtn: {
    paddingVertical: 20,
    alignItems: 'center',
    width: '100%',
  },
  ghostTxt: {
    color: colors.textLight,
    fontSize: sizes.updateText,
    fontWeight: '600',
    fontFamily: typography.sansMedium,
    letterSpacing: 1.5,
  },
});
