/**
 * Delivery proof screen.
 * Camera/photo picker for the driver to capture and upload proof-of-delivery images.
 */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  PanResponder,
  Alert,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { t } from '@/lib/translations';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Camera,
  Trash2,
  CheckCircle2,
  PenLine,
  AlertTriangle,
  Package,
  Star,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { addToProofQueue } from '@/lib/proof-queue';

const PAD_HEIGHT = 200;
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function DeliveryProofScreen() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { token } = useAuth();

  const [recipientName, setRecipientName] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // ── Checklist state ─────────────────────────────────────────────────────────
  const [loadCondition, setLoadCondition] = useState<'FULL' | 'PARTIAL' | 'DAMAGED'>('FULL');
  const [hasDamage, setHasDamage] = useState(false);
  const [damageNote, setDamageNote] = useState('');
  const [gradeConfirmed, setGradeConfirmed] = useState(false);

  // ── Signature pad ───────────────────────────────────────────────────────────
  const [strokes, setStrokes] = useState<string[]>([]);
  const [liveStroke, setLiveStroke] = useState('');
  const currentPath = useRef('');
  const [padWidth, setPadWidth] = useState(SCREEN_WIDTH - 48);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPath.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setLiveStroke(currentPath.current);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPath.current += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setLiveStroke(currentPath.current);
      },
      onPanResponderRelease: () => {
        if (currentPath.current) {
          setStrokes((prev) => [...prev, currentPath.current]);
          currentPath.current = '';
          setLiveStroke('');
        }
      },
    }),
  ).current;

  const clearSignature = () => {
    setStrokes([]);
    currentPath.current = '';
    setLiveStroke('');
  };

  /** Serialize the strokes array into a minimal SVG string for backend storage. */
  const buildSignatureSvg = (strokePaths: string[]): string | undefined => {
    if (strokePaths.length === 0) return undefined;
    const pathEls = strokePaths
      .map(
        (d) => `<path d="${d}" stroke="#111" stroke-width="2" fill="none" stroke-linecap="round"/>`,
      )
      .join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${padWidth}" height="${PAD_HEIGHT}">${pathEls}</svg>`;
  };

  // ── Photo picker ────────────────────────────────────────────────────────────
  const pickImage = async (fromCamera: boolean) => {
    if (photos.length >= 3) {
      Alert.alert('', 'Maksimāli 3 fotogrāfijas.');
      return;
    }

    let result: ImagePicker.ImagePickerResult;

    if (fromCamera) {
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) {
        Alert.alert('', t.deliveryProof.cameraPermission);
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        quality: 0.6,
        base64: true,
        allowsEditing: true,
        aspect: [4, 3],
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.6,
        base64: true,
        allowsEditing: true,
        aspect: [4, 3],
      });
    }

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      setPhotos((prev) => [...prev, uri]);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert(t.deliveryProof.photosLabel, '', [
      { text: t.deliveryProof.takePhoto, onPress: () => pickImage(true) },
      { text: t.deliveryProof.pickFromLibrary, onPress: () => pickImage(false) },
      { text: t.deliveryProof.cancel, style: 'cancel' },
    ]);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!token || !jobId) return;

    setSubmitting(true);
    try {
      await api.transportJobs.deliveryProof(
        jobId,
        {
          recipientName: recipientName.trim() || undefined,
          notes: notes.trim() || undefined,
          photos: photos.length > 0 ? photos : undefined,
          loadCondition,
          isPartialLoad: loadCondition === 'PARTIAL',
          hasDamage,
          damageNote: hasDamage && damageNote.trim() ? damageNote.trim() : undefined,
          gradeConfirmed,
          signatureSvg: buildSignatureSvg(strokes),
        },
        token,
      );
      haptics.success();
      Alert.alert(t.deliveryProof.successTitle, t.deliveryProof.successMessage, [
        { text: 'OK', onPress: () => router.replace('/(driver)/jobs') },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      const isNetworkError =
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('fetch') ||
        msg.toLowerCase().includes('timeout') ||
        msg === 'Network request failed';

      if (isNetworkError) {
        // Queue locally — will be retried when connectivity is restored
        await addToProofQueue({
          jobId,
          token,
          recipientName: recipientName.trim() || undefined,
          notes: notes.trim() || undefined,
          photos: photos.length > 0 ? photos : undefined,
          loadCondition,
          hasDamage,
          damageNote: hasDamage && damageNote.trim() ? damageNote.trim() : undefined,
          gradeConfirmed,
          signatureSvg: buildSignatureSvg(strokes),
        });
        haptics.success();
        Alert.alert(
          'Saglabāts!',
          'Pierādījums saglabāts lokāli. Tiks automātiski nosūtīts, kad atjaunosies savienojums.',
          [{ text: 'OK', onPress: () => router.replace('/(driver)/jobs') }],
        );
      } else {
        haptics.error();
        Alert.alert(t.deliveryProof.errorTitle, msg || 'Kļūda nosūtot pierādījumu');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer standalone bg="#f9fafb">
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={16}>
            <Text style={styles.backText}>← Atpakaļ</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t.deliveryProof.title}</Text>
          <Text style={styles.subtitle}>{t.deliveryProof.subtitle}</Text>
        </View>

        {/* ── Checklist ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Package size={15} color="#374151" />
            <Text style={styles.label}>Kravas stāvoklis</Text>
          </View>

          <View style={styles.conditionRow}>
            {(['FULL', 'PARTIAL', 'DAMAGED'] as const).map((val) => {
              const labels = { FULL: 'Pilna', PARTIAL: 'Daļēja', DAMAGED: 'Bojāta' };
              const active = loadCondition === val;
              const isDamaged = val === 'DAMAGED';
              return (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.conditionChip,
                    active &&
                      (isDamaged ? styles.conditionChipDamaged : styles.conditionChipActive),
                  ]}
                  onPress={() => {
                    setLoadCondition(val);
                    if (val === 'DAMAGED') setHasDamage(true);
                    if (val === 'FULL') setHasDamage(false);
                  }}
                >
                  <Text
                    style={[
                      styles.conditionChipText,
                      active &&
                        (isDamaged
                          ? styles.conditionChipTextDamaged
                          : styles.conditionChipTextActive),
                    ]}
                  >
                    {labels[val]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Damage note — only visible when damaged */}
        {hasDamage && (
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <AlertTriangle size={15} color="#ef4444" />
              <Text style={[styles.label, { color: '#ef4444' }]}>Bojājuma apraksts</Text>
            </View>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={damageNote}
              onChangeText={setDamageNote}
              placeholder="Aprakstiet bojājumu..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={500}
            />
          </View>
        )}

        {/* Grade confirmation */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setGradeConfirmed((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, gradeConfirmed && styles.checkboxChecked]}>
              {gradeConfirmed && <CheckCircle2 size={14} color="#fff" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkLabel}>Materiāla kvalitāte apstiprināta</Text>
              <Text style={styles.checkSublabel}>
                Piegādātais materiāls atbilst pasūtījuma specifikācijai
              </Text>
            </View>
            <Star size={16} color={gradeConfirmed ? '#f59e0b' : '#d1d5db'} />
          </TouchableOpacity>
        </View>

        {/* Recipient name */}
        <View style={styles.section}>
          <Text style={styles.label}>{t.deliveryProof.recipientName}</Text>
          <TextInput
            style={styles.input}
            value={recipientName}
            onChangeText={setRecipientName}
            placeholder={t.deliveryProof.recipientNamePlaceholder}
            placeholderTextColor="#9ca3af"
            returnKeyType="done"
            maxLength={100}
          />
        </View>

        {/* Signature pad */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <PenLine size={15} color="#374151" />
            <Text style={styles.label}>{t.deliveryProof.signatureLabel}</Text>
            <Text style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>(neobligāts)</Text>
            {strokes.length > 0 && (
              <TouchableOpacity onPress={clearSignature} style={styles.clearBtn}>
                <Trash2 size={13} color="#ef4444" />
                <Text style={styles.clearBtnText}>{t.deliveryProof.clearSignature}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View
            style={styles.sigPad}
            onLayout={(e) => setPadWidth(e.nativeEvent.layout.width)}
            {...panResponder.panHandlers}
          >
            {strokes.length === 0 && !liveStroke && (
              <Text style={styles.sigHint}>{t.deliveryProof.signatureHint}</Text>
            )}
            <Svg width={padWidth} height={PAD_HEIGHT} style={StyleSheet.absoluteFill}>
              {strokes.map((d, i) => (
                <SvgPath
                  key={i}
                  d={d}
                  stroke="#111827"
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {liveStroke ? (
                <SvgPath
                  d={liveStroke}
                  stroke="#111827"
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
            </Svg>
          </View>
        </View>

        {/* Photos */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Camera size={15} color="#374151" />
            <Text style={styles.label}>{t.deliveryProof.photosLabel}</Text>
            <Text style={styles.photoCount}>{photos.length}/3</Text>
          </View>

          <View style={styles.photoGrid}>
            {photos.map((uri, i) => (
              <View key={i} style={styles.photoThumb}>
                <Image source={{ uri }} style={styles.photoImg} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.photoRemoveBtn}
                  onPress={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 3 && (
              <TouchableOpacity style={styles.photoAddBtn} onPress={showPhotoOptions}>
                <Camera size={22} color="#9ca3af" />
                <Text style={styles.photoAddText}>{t.deliveryProof.addPhoto}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>{t.deliveryProof.notes}</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t.deliveryProof.notesPlaceholder}
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={500}
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={20} color="#fff" />
              <Text style={styles.submitBtnText}>{t.deliveryProof.submit}</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { padding: 24, gap: 20, paddingBottom: 40 },

  header: { gap: 4, marginBottom: 4 },
  backText: { fontSize: 14, color: '#111827', fontWeight: '600', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280' },

  section: { gap: 8 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  notesInput: { height: 90, paddingTop: 12 },

  // Signature
  sigPad: {
    height: PAD_HEIGHT,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigHint: { fontSize: 14, color: '#d1d5db', pointerEvents: 'none' },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  clearBtnText: { fontSize: 12, color: '#ef4444', fontWeight: '600' },

  // Photos
  photoCount: { fontSize: 12, color: '#9ca3af', marginLeft: 'auto' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImg: { width: '100%', height: '100%' },
  photoRemoveBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    padding: 5,
  },
  photoAddBtn: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    gap: 6,
  },
  photoAddText: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },

  // Checklist
  conditionRow: { flexDirection: 'row', gap: 10 },
  conditionChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  conditionChipActive: { borderColor: '#111827', backgroundColor: '#111827' },
  conditionChipDamaged: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  conditionChipText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  conditionChipTextActive: { color: '#fff' },
  conditionChipTextDamaged: { color: '#ef4444' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  checkboxChecked: { backgroundColor: '#111827', borderColor: '#111827' },
  checkLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  checkSublabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  // Submit
  submitBtn: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
});
