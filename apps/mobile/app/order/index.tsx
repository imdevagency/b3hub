/**
 * Container / Skip-Hire wizard — full-screen step pages.
 *
 * Step order mirrors the web flow (waste first, then size):
 *   Step 1 – Waste type      (SkipWasteStep)
 *   Step 2 – Container size  (SkipSizeStep)
 *   Step 3 – Delivery address (InlineAddressStep)
 *   Step 4 – Date + Contact + Confirm
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MapPin, Camera, Trash2, Link2, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useOrder } from '@/lib/order-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { t } from '@/lib/translations';
import type { SkipSize, SkipWasteCategory, ApiOrder } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { SKIP_PRICES, toISO, addDays } from '@/components/order/skip-hire-types';
import { SkipWasteStep } from '@/components/order/SkipWasteStep';
import { SkipSizeStep } from '@/components/order/SkipSizeStep';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { InlineAddressStep } from '@/components/wizard/InlineAddressStep';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { SavedAddressPicker } from '@/components/wizard/SavedAddressPicker';

// ── Types ─────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4;

const today = new Date();

// ── Component ─────────────────────────────────────────────────────
export default function OrderWizard() {
  const router = useRouter();
  const {
    state,
    setLocationWithCoords,
    setWasteCategory,
    setSkipSize,
    setDeliveryDate,
    setConfirmedOrder,
  } = useOrder();
  const { user, token } = useAuth();

  // ── Wizard state ──────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);
  const [picked, setPicked] = useState<PickedAddress | null>(
    state.locationLat != null && state.locationLng != null && state.location
      ? { address: state.location, lat: state.locationLat, lng: state.locationLng, city: '' }
      : null,
  );
  const [selectedWaste, setSelectedWasteState] = useState<SkipWasteCategory | null>(
    state.wasteCategory,
  );
  const [selectedSize, setSelectedSizeState] = useState<SkipSize | null>(state.skipSize);
  const [selectedDay, setSelectedDay] = useState<string>(toISO(addDays(today, 1)));
  const [submitting, setSubmitting] = useState(false);
  const [contactName, setContactName] = useState(() =>
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
  );
  const [contactPhone, setContactPhone] = useState(() => user?.phone ?? '');
  const [notes, setNotes] = useState('');
  const [unloadingPointPhotoUrl, setUnloadingPointPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  // ── Material order linking (Stage 2) ─────────────────────────────────
  const [matOrders, setMatOrders] = useState<ApiOrder[]>([]);
  const [matOrdersLoading, setMatOrdersLoading] = useState(false);
  const [linkedMaterialOrderId, setLinkedMaterialOrderId] = useState<string | null>(null);
  const [showMatLink, setShowMatLink] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────
  const handlePickConfirm = useCallback(
    (p: PickedAddress) => {
      setPicked(p);
      setLocationWithCoords(p.address, p.lat, p.lng);
    },
    [setLocationWithCoords],
  );

  const handleWasteSelect = useCallback(
    (waste: SkipWasteCategory) => {
      setSelectedWasteState(waste);
      setWasteCategory(waste);
    },
    [setWasteCategory],
  );

  const handleSizeSelect = useCallback(
    (size: SkipSize) => {
      setSelectedSizeState(size);
      setSkipSize(size);
    },
    [setSkipSize],
  );

  // Load unlinked material orders when user reaches step 4
  useEffect(() => {
    if (step !== 4 || !token || matOrders.length > 0) return;
    setMatOrdersLoading(true);
    api.orders
      .myOrders(token)
      .then((data) => setMatOrders(data.filter((o) => !o.linkedSkipOrder)))
      .catch(() => {})
      .finally(() => setMatOrdersLoading(false));
  }, [step, token, matOrders.length]);

  const goBack = useCallback(() => {
    if (step === 1) {
      if (router.canGoBack()) router.back();
      else router.replace('/(buyer)/home' as never);
    } else setStep((s) => (s - 1) as Step);
  }, [step, router]);

  const price = SKIP_PRICES[state.skipSize ?? selectedSize ?? 'MIDI'] ?? 129;

  const ctaLabel = step === 4 ? `Pasūtīt — €${price}` : 'Turpināt';

  const ctaDisabled =
    (step === 1 && !selectedWaste) ||
    (step === 2 && !selectedSize) ||
    (step === 3 && !picked) ||
    submitting;

  const onCTA = useCallback(async () => {
    if (step < 4) {
      setStep((s) => (s + 1) as Step);
      return;
    }
    // Submit
    if (!token) {
      Alert.alert('Pieteikties nepīciešams', 'Lai veiktu pasūtījumu, lūdzu vispirms piesakieties.');
      return;
    }
    if (!state.location || !state.wasteCategory || !state.skipSize) return;
    setSubmitting(true);
    setDeliveryDate(selectedDay);
    try {
      const order = await api.skipHire.create(
        {
          location: state.location,
          ...(state.locationLat != null ? { lat: state.locationLat } : {}),
          ...(state.locationLng != null ? { lng: state.locationLng } : {}),
          wasteCategory: state.wasteCategory,
          skipSize: state.skipSize,
          deliveryDate: selectedDay,
          contactName: contactName || undefined,
          contactPhone: contactPhone || undefined,
          notes: notes || undefined,
          unloadingPointPhotoUrl: unloadingPointPhotoUrl || undefined,
        },
        token ?? undefined,
      );
      // Link to material order if one was selected
      if (linkedMaterialOrderId && token) {
        try {
          await api.orders.linkSkipOrder(linkedMaterialOrderId, order.id, token);
        } catch {
          // Non-fatal: linking failed silently — order is still created
        }
      }
      haptics.success();
      setConfirmedOrder(order);
      router.push('/order/confirmation');
    } catch (err) {
      Alert.alert(t.skipHire.errorTitle, err instanceof Error ? err.message : t.skipHire.error);
    } finally {
      setSubmitting(false);
    }
  }, [
    step,
    picked,
    token,
    state,
    selectedDay,
    contactName,
    contactPhone,
    notes,
    unloadingPointPhotoUrl,
    linkedMaterialOrderId,
    setDeliveryDate,
    setConfirmedOrder,
    router,
  ]);

  const pickUnloadingPhoto = useCallback(async (fromCamera: boolean) => {
    setPhotoBusy(true);
    try {
      let result: ImagePicker.ImagePickerResult;
      if (fromCamera) {
        const { granted } = await ImagePicker.requestCameraPermissionsAsync();
        if (!granted) {
          Alert.alert('Nav piekļuves kamerai', 'Lai pievienotu foto, atļauj piekļuvi kamerai.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: 'images',
          quality: 0.45,
          base64: true,
          allowsEditing: true,
          aspect: [4, 3],
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          quality: 0.45,
          base64: true,
          allowsEditing: true,
          aspect: [4, 3],
        });
      }

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setUnloadingPointPhotoUrl(dataUri);
      }
    } finally {
      setPhotoBusy(false);
    }
  }, []);

  const openPhotoOptions = useCallback(() => {
    Alert.alert('Izkraušanas punkta foto', '', [
      { text: 'Fotografēt', onPress: () => pickUnloadingPhoto(true) },
      { text: 'Izvēlēties no galerijas', onPress: () => pickUnloadingPhoto(false) },
      { text: 'Atcelt', style: 'cancel' },
    ]);
  }, [pickUnloadingPhoto]);

  const STEP_TITLES: Record<Step, string> = {
    1: t.skipHire.step2.title, // "Atkritumu veids" — waste first (matches web step 1)
    2: t.skipHire.step3.title, // "Konteinera izmērs" — size second (matches web step 1 reveal)
    3: 'Piegādes adrese',
    4: 'Apstiprini pasūtījumu',
  };

  return (
    <>
      <WizardLayout
        title={STEP_TITLES[step]}
        step={step}
        totalSteps={4}
        onBack={goBack}
        onClose={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(buyer)/home' as never);
        }}
        ctaLabel={ctaLabel}
        onCTA={onCTA}
        ctaDisabled={ctaDisabled}
        ctaLoading={submitting}
      >
        {/* ── Step 1: Waste type — always shown first (matches web) ── */}
        {step === 1 && (
          <View style={{ flex: 1 }}>
            <SkipWasteStep selected={selectedWaste} onSelect={handleWasteSelect} />
          </View>
        )}

        {/* ── Step 2: Container size — chosen after waste type (matches web) ── */}
        {step === 2 && (
          <View style={{ flex: 1 }}>
            <SkipSizeStep selected={selectedSize} onSelect={handleSizeSelect} />
          </View>
        )}

        {/* ── Step 3: Delivery address (matches web step 2 "Adrese") ── */}
        {step === 3 && (
          <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <SavedAddressPicker onPick={handlePickConfirm} currentAddress={picked} />
            </View>
            <InlineAddressStep picked={picked} onPick={handlePickConfirm} />
          </View>
        )}

        {/* ── Step 4: Date + Contact + Confirm (matches web step 4 "Apstiprināt") ── */}
        {step === 4 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.contentPad}
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.sectionLabel}>Piegādes datums</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dayStrip}>
              {Array.from({ length: 14 }, (_, i) => {
                const d = addDays(today, i + 1);
                const iso = toISO(d);
                const active = selectedDay === iso;
                return (
                  <TouchableOpacity
                    key={iso}
                    style={[s.dayChip, active && s.dayChipActive]}
                    onPress={() => setSelectedDay(iso)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.dayDow, active && s.dayActive]}>
                      {d.toLocaleDateString('lv-LV', { weekday: 'short' })}
                    </Text>
                    <Text style={[s.dayNum, active && s.dayActive]}>{d.getDate()}</Text>
                    <Text style={[s.dayMon, active && s.dayActiveSub]}>
                      {d.toLocaleDateString('lv-LV', { month: 'short' })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Summary */}
            <Text style={[s.sectionLabel, { marginTop: 20 }]}>Kopsavilkums</Text>
            <View style={s.summaryCard}>
              <View style={s.addressRow}>
                <MapPin size={14} color="#374151" />
                <Text style={s.addressValue} numberOfLines={2}>
                  {picked?.address ?? state.location ?? '—'}
                </Text>
              </View>
              <DetailRow
                label="Atkritumu veids"
                value={
                  selectedWaste
                    ? (t.skipHire.step2.types[selectedWaste]?.label ?? selectedWaste)
                    : '—'
                }
              />
              <DetailRow
                label="Konteinera izmērs"
                value={
                  selectedSize ? (t.skipHire.step3.sizes[selectedSize]?.label ?? selectedSize) : '—'
                }
              />
              <DetailRow label="Cena" value={`€${price} + PVN`} />
            </View>

            {/* Contact */}
            <Text style={[s.sectionLabel, { marginTop: 20 }]}>Kontaktinformācija</Text>
            <View style={{ gap: 10, marginBottom: 8 }}>
              <TextInput
                style={s.input}
                placeholder="Kontaktpersona"
                placeholderTextColor="#9ca3af"
                value={contactName}
                onChangeText={setContactName}
              />
              <TextInput
                style={s.input}
                placeholder="Tālrunis"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                value={contactPhone}
                onChangeText={setContactPhone}
              />
              <TextInput
                style={[s.input, s.inputMulti]}
                placeholder="Piezīmes (neobligāti)"
                placeholderTextColor="#9ca3af"
                multiline
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            <Text style={[s.sectionLabel, { marginTop: 20 }]}>
              Izkraušanas punkta foto (neobligāti)
            </Text>
            <View style={s.photoCard}>
              {unloadingPointPhotoUrl ? (
                <View style={s.photoPreviewWrap}>
                  <Image
                    source={{ uri: unloadingPointPhotoUrl }}
                    style={s.photoPreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={s.photoRemoveBtn}
                    onPress={() => setUnloadingPointPhotoUrl(null)}
                    activeOpacity={0.85}
                    accessibilityLabel="Noņemt izkraušanas foto"
                  >
                    <Trash2 size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={s.photoAddBtn}
                  onPress={openPhotoOptions}
                  activeOpacity={0.8}
                  accessibilityLabel="Pievienot izkraušanas foto"
                >
                  {photoBusy ? (
                    <ActivityIndicator size="small" color="#374151" />
                  ) : (
                    <>
                      <Camera size={18} color="#4b5563" />
                      <Text style={s.photoAddBtnText}>Pievienot foto</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
            {/* ── Link to material order (optional) ── */}
            <Text style={[s.sectionLabel, { marginTop: 20 }]}>Saistīt ar materiālu pasūtījumu</Text>
            <TouchableOpacity
              style={s.matLinkToggle}
              onPress={() => setShowMatLink((v) => !v)}
              activeOpacity={0.75}
            >
              <Link2 size={14} color="#059669" />
              <Text style={s.matLinkToggleText}>
                {linkedMaterialOrderId
                  ? `Saistīts: #${matOrders.find((o) => o.id === linkedMaterialOrderId)?.orderNumber ?? '...'}`
                  : 'Izvēlēties pasūtījumu (neobligāti)'}
              </Text>
              {showMatLink ? (
                <ChevronUp size={14} color="#6b7280" />
              ) : (
                <ChevronDown size={14} color="#6b7280" />
              )}
            </TouchableOpacity>

            {showMatLink && (
              <View style={s.matOrderList}>
                {matOrdersLoading ? (
                  <ActivityIndicator size="small" color="#374151" style={{ margin: 12 }} />
                ) : matOrders.length === 0 ? (
                  <Text style={s.matOrderEmpty}>Nav aktīvu materiālu pasūtījumu</Text>
                ) : (
                  <>
                    {linkedMaterialOrderId && (
                      <TouchableOpacity
                        style={s.matOrderRow}
                        onPress={() => setLinkedMaterialOrderId(null)}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.matOrderNum, { color: '#6b7280' }]}>Noņemt saiti</Text>
                      </TouchableOpacity>
                    )}
                    {matOrders.map((o) => {
                      const selected = o.id === linkedMaterialOrderId;
                      const name = o.items?.[0]?.material?.name ?? '—';
                      return (
                        <TouchableOpacity
                          key={o.id}
                          style={[s.matOrderRow, selected && s.matOrderRowActive]}
                          onPress={() => {
                            setLinkedMaterialOrderId(o.id);
                            setShowMatLink(false);
                          }}
                          activeOpacity={0.75}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[s.matOrderNum, selected && { color: '#fff' }]}>
                              #{o.orderNumber}
                            </Text>
                            <Text
                              style={[s.matOrderName, selected && { color: '#d1fae5' }]}
                              numberOfLines={1}
                            >
                              {name}
                            </Text>
                          </View>
                          {selected && (
                            <View style={s.matOrderCheck}>
                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                                ✓
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
              </View>
            )}

            <View style={{ height: 16 }} />
          </ScrollView>
        )}
      </WizardLayout>
    </>
  );
}

// ── Summary helper ────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  content: { flex: 1 },
  contentPad: { padding: 20, paddingBottom: 32 },
  hint: { fontSize: 14, color: '#6b7280', marginBottom: 16, lineHeight: 20 },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
  },
  addressText: { flex: 1, fontSize: 15, color: '#111827', fontWeight: '500', lineHeight: 20 },
  addressPlaceholder: { color: '#9ca3af', fontWeight: '400' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  dayStrip: { flexGrow: 0 },
  dayChip: {
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
    backgroundColor: '#f9fafb',
    minWidth: 54,
  },
  dayChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  dayDow: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  dayNum: { fontSize: 20, fontWeight: '700', color: '#111827', marginVertical: 2 },
  dayMon: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  dayActive: { color: '#fff' },
  dayActiveSub: { color: '#9ca3af' },
  summaryCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    padding: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  addressValue: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '600', lineHeight: 20 },
  detailRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailLabel: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  photoCard: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 10,
  },
  photoAddBtn: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
  },
  photoAddBtnText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  photoPreviewWrap: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: 160,
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(17,24,39,0.84)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Mat order linking styles
  matLinkToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  matLinkToggleText: {
    flex: 1,
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  matOrderList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
  },
  matOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  matOrderRowActive: {
    backgroundColor: '#059669',
  },
  matOrderNum: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  matOrderName: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  matOrderEmpty: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    padding: 16,
  },
  matOrderCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  successRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 32,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 20,
    marginBottom: 8,
  },
  successSub: { fontSize: 15, color: '#6b7280', marginBottom: 24 },
  jobBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  jobBadgeText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  successBtn: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  successBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
