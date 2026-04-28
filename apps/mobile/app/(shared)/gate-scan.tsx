/**
 * gate-scan.tsx — Gate operator QR / manual pass scanner
 *
 * Route: /(shared)/gate-scan?fieldId=<id>
 *
 * Admin-only screen. Scans or manually enters a FieldPass number
 * and shows pass validity + details.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  NativeModules,
  StyleSheet,
  Vibration,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';

// expo-camera requires a custom dev build — not available in Expo Go.
// Detect at module load so hooks are always called (no conditional hook violation).
const CAMERA_NATIVE_AVAILABLE = 'ExpoCamera' in NativeModules;

// Stable references set once at module load — safe to use as hooks.
const { CameraView, useCameraPermissions: _useCameraPermissions } = (() => {
  if (CAMERA_NATIVE_AVAILABLE) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('expo-camera');
      return { CameraView: mod.CameraView, useCameraPermissions: mod.useCameraPermissions };
    } catch {
      // fall through
    }
  }
  // Fallback: dummy hook + null component
  return {
    CameraView: null as unknown as React.ComponentType<{
      style?: object;
      facing?: string;
      barcodeScannerSettings?: object;
      onBarcodeScanned?: (e: { data: string }) => void;
    }>,
    useCameraPermissions: () =>
      [{ granted: false, status: 'denied' }, async () => ({ granted: false })] as const,
  };
})();
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuth } from '@/lib/auth-context';
import { b3Fields, type ApiPassScanResult } from '@/lib/api';
import { CheckCircle2, XCircle, ScanLine, Camera, Keyboard, RefreshCw } from 'lucide-react-native';
import { colors, spacing, radius, fontSizes } from '@/lib/theme';

type TabMode = 'camera' | 'manual';

export default function GateScanScreen() {
  const { fieldId } = useLocalSearchParams<{ fieldId: string }>();
  const { token } = useAuth();

  // Default to manual if camera native module isn't linked
  const [mode, setMode] = useState<TabMode>(CAMERA_NATIVE_AVAILABLE ? 'camera' : 'manual');
  const [permission, requestPermission] = _useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiPassScanResult | null>(null);
  const [error, setError] = useState('');

  const lockRef = useRef(false);

  // Request camera permission when switching to camera mode
  useEffect(() => {
    if (mode === 'camera' && !permission?.granted) {
      requestPermission();
    }
  }, [mode, permission?.granted, requestPermission]);

  const handleScan = async (passNumber: string) => {
    if (lockRef.current || loading) return;
    lockRef.current = true;

    const pn = passNumber.trim().toUpperCase();
    if (!pn) {
      lockRef.current = false;
      return;
    }
    if (!fieldId || !token) {
      setError('Nav lauka ID vai autentifikācijas tokena');
      lockRef.current = false;
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await b3Fields.scanPass(token, fieldId, pn);
      setResult(res);
      setScanned(true);
      Vibration.vibrate(res.isValid ? [0, 100, 50, 100] : [0, 500]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Kļūda skenēšanas laikā';
      setError(msg);
      Vibration.vibrate(400);
    } finally {
      setLoading(false);
      lockRef.current = false;
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned || loading) return;
    // QR encodes either the pass number or a URL like https://b3hub.lv/gate/scan?p=FP-...
    const passNumber = data.includes('?p=') ? data.split('?p=')[1] : data;
    handleScan(passNumber);
  };

  const reset = () => {
    setScanned(false);
    setResult(null);
    setError('');
    setManualInput('');
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleString('lv-LV', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <ScreenContainer>
      <ScreenHeader title="Vārtu skenēšana" />

      {/* Mode toggle — only show camera tab if native module is linked */}
      <View style={styles.modeRow}>
        {CAMERA_NATIVE_AVAILABLE && (
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'camera' && styles.modeBtnActive]}
            onPress={() => {
              setMode('camera');
              reset();
            }}
          >
            <Camera size={16} color={mode === 'camera' ? colors.white : colors.textMuted} />
            <Text style={[styles.modeBtnText, mode === 'camera' && styles.modeBtnTextActive]}>
              Kamera
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'manual' && styles.modeBtnActive]}
          onPress={() => {
            setMode('manual');
            reset();
          }}
        >
          <Keyboard size={16} color={mode === 'manual' ? colors.white : colors.textMuted} />
          <Text style={[styles.modeBtnText, mode === 'manual' && styles.modeBtnTextActive]}>
            Manuāli
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Camera mode ── */}
        {mode === 'camera' && CameraView && (
          <View style={styles.cameraSection}>
            {!permission ? (
              <Text style={styles.permText}>Pārbauda atļaujas…</Text>
            ) : !permission.granted ? (
              <View style={styles.permBox}>
                <Text style={styles.permText}>
                  Lai skenētu QR kodu, nepieciešama kameras piekļuve.
                </Text>
                <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
                  <Text style={styles.permBtnText}>Piešķirt atļauju</Text>
                </TouchableOpacity>
              </View>
            ) : !scanned ? (
              <View style={styles.cameraWrapper}>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={handleBarcodeScanned}
                />
                <View style={styles.scanOverlay}>
                  <View style={styles.scanFrame} />
                </View>
                <View style={styles.scanHintRow}>
                  <ScanLine size={16} color={colors.white} />
                  <Text style={styles.scanHint}>Novietojiet QR kodu rāmja iekšienē</Text>
                </View>
                {loading && (
                  <View style={styles.scanLoading}>
                    <ActivityIndicator color={colors.white} />
                  </View>
                )}
              </View>
            ) : null}
          </View>
        )}

        {/* ── Manual mode ── */}
        {mode === 'manual' && (
          <View style={styles.manualSection}>
            <Text style={styles.manualLabel}>Caurlaides numurs</Text>
            <TextInput
              style={styles.manualInput}
              value={manualInput}
              onChangeText={(v) => setManualInput(v.toUpperCase())}
              placeholder="FP-2026-00001"
              placeholderTextColor={colors.textDisabled}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => handleScan(manualInput)}
            />
            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!manualInput.trim() || loading) && styles.submitBtnDisabled,
              ]}
              onPress={() => handleScan(manualInput)}
              disabled={!manualInput.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <ScanLine size={16} color={colors.white} />
                  <Text style={styles.submitBtnText}>Pārbaudīt</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Error ── */}
        {!!error && (
          <View style={styles.errorBox}>
            <XCircle size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Scan result ── */}
        {result && (
          <View
            style={[styles.resultCard, result.isValid ? styles.resultValid : styles.resultInvalid]}
          >
            {/* Verdict banner */}
            <View style={styles.verdictRow}>
              {result.isValid ? (
                <CheckCircle2 size={28} color={colors.success} />
              ) : (
                <XCircle size={28} color={colors.danger} />
              )}
              <Text
                style={[
                  styles.verdictText,
                  result.isValid ? styles.verdictTextValid : styles.verdictTextInvalid,
                ]}
              >
                {result.isValid ? 'ATĻAUTS' : 'NORAIDĪTS'}
              </Text>
              <Text style={styles.passNumber}>{result.pass.passNumber}</Text>
            </View>

            {/* Pass details */}
            <View style={styles.detailsGrid}>
              <Detail label="Auto" value={result.pass.vehiclePlate} bold />
              {result.pass.driverName ? (
                <Detail label="Šoferis" value={result.pass.driverName} />
              ) : null}
              <Detail label="Uzņēmums" value={result.pass.company.name} />
              <Detail label="Līgums" value={result.pass.contract.contractNumber} />
              <Detail label="Derīgs no" value={fmt(result.pass.validFrom)} wide />
              <Detail label="Derīgs līdz" value={fmt(result.pass.validTo)} wide />
              {result.pass.wasteDescription ? (
                <Detail label="Krava" value={result.pass.wasteDescription} wide />
              ) : null}
              {!result.isValid && result.pass.revokedReason ? (
                <Detail label="Iemesls" value={result.pass.revokedReason} wide danger />
              ) : null}
              {result.pass.weighingSlips.length > 0 ? (
                <Detail
                  label="Iepriekšējie svēr."
                  value={result.pass.weighingSlips
                    .map((w) => `${w.slipNumber}${w.netTonnes ? ` (${w.netTonnes}t)` : ''}`)
                    .join(', ')}
                  wide
                />
              ) : null}
            </View>
            <Text style={styles.scannedAt}>Skenēts: {fmt(result.scannedAt)}</Text>
          </View>
        )}

        {/* ── Reset after scan ── */}
        {(scanned || result) && (
          <TouchableOpacity style={styles.resetBtn} onPress={reset}>
            <RefreshCw size={16} color={colors.textMuted} />
            <Text style={styles.resetBtnText}>Skenēt nākamo</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Detail row component ──────────────────────────────────────────────────────

function Detail({
  label,
  value,
  bold,
  wide,
  danger,
}: {
  label: string;
  value: string;
  bold?: boolean;
  wide?: boolean;
  danger?: boolean;
}) {
  return (
    <View style={[styles.detailItem, wide && styles.detailItemWide]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          bold && styles.detailValueBold,
          danger && styles.detailValueDanger,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const VALID_BG = '#F0FDF4';
const VALID_BORDER = '#86EFAC';
const INVALID_BG = '#FEF2F2';
const INVALID_BORDER = '#FECACA';

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    backgroundColor: colors.bgMuted,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  modeBtnActive: {
    backgroundColor: colors.textPrimary,
  },
  modeBtnText: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  modeBtnTextActive: {
    color: colors.white,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    gap: spacing.base,
  },
  cameraSection: {
    gap: spacing.base,
  },
  cameraWrapper: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
    height: 320,
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: radius.md,
    backgroundColor: 'transparent',
  },
  scanHintRow: {
    position: 'absolute',
    bottom: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'center',
  },
  scanHint: {
    color: colors.white,
    fontSize: fontSizes.sm,
  },
  scanLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permBox: {
    gap: spacing.base,
    alignItems: 'center',
    padding: spacing.xl,
  },
  permText: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  permBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  permBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSizes.sm,
  },
  manualSection: {
    gap: spacing.sm,
  },
  manualLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  manualInput: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    paddingHorizontal: spacing.base,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  submitBtn: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.textPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSizes.base,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FEF2F2',
    borderRadius: radius.md,
    padding: spacing.base,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: fontSizes.sm,
  },
  resultCard: {
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: spacing.base,
    gap: spacing.base,
  },
  resultValid: {
    backgroundColor: VALID_BG,
    borderColor: VALID_BORDER,
  },
  resultInvalid: {
    backgroundColor: INVALID_BG,
    borderColor: INVALID_BORDER,
  },
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  verdictText: {
    fontSize: fontSizes.xl,
    fontWeight: '800',
    flex: 1,
  },
  verdictTextValid: {
    color: colors.success,
  },
  verdictTextInvalid: {
    color: colors.danger,
  },
  passNumber: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  detailItem: {
    width: '47%',
    gap: 2,
  },
  detailItemWide: {
    width: '100%',
  },
  detailLabel: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
  },
  detailValueBold: {
    fontWeight: '700',
    fontSize: fontSizes.base,
  },
  detailValueDanger: {
    color: colors.danger,
  },
  scannedAt: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'right',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgMuted,
  },
  resetBtnText: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
