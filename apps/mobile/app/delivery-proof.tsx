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
import { Camera, Trash2, CheckCircle2, PenLine } from 'lucide-react-native';

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
        },
        token,
      );
      Alert.alert(t.deliveryProof.successTitle, t.deliveryProof.successMessage, [
        { text: 'OK', onPress: () => router.replace('/(driver)/jobs') },
      ]);
    } catch (err: any) {
      Alert.alert(t.deliveryProof.errorTitle, err.message ?? 'Kļūda nosūtot pierādījumu');
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
