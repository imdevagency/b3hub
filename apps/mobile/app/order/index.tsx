/**
 * Container / Skip-Hire wizard — full-screen step pages.
 *
 * Step order mirrors the web flow (waste first, then size):
 *   Step 1 – Waste type      (SkipWasteStep)
 *   Step 2 – Container size  (SkipSizeStep)
 *   Step 3 – Delivery address (InlineAddressStep)
 *   Step 4 – Date + Contact + Confirm
 */

import React, { useState, useCallback, useEffect } from 'react';
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
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  MapPin,
  Camera,
  Trash2,
  Link2,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Check,
} from 'lucide-react-native';
import { useOrder } from '@/lib/order-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { t } from '@/lib/translations';
import type { SkipSize, SkipWasteCategory, ApiOrder, SkipHireQuote } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { SKIP_PRICES, toISO, addDays } from '@/components/order/skip-hire-types';
import { SkipWasteStep } from '@/components/order/SkipWasteStep';
import { SkipSizeStep } from '@/components/order/SkipSizeStep';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { InlineAddressStep } from '@/components/wizard/InlineAddressStep';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { SavedAddressPicker } from '@/components/wizard/SavedAddressPicker';
import { colors } from '@/lib/theme';
import { useToast } from '@/components/ui/Toast';

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
    setSkipPaymentClientSecret,
  } = useOrder();
  const { user, token } = useAuth();
  const toast = useToast();

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
  const [deliveryWindow, setDeliveryWindow] = useState<'ANY' | 'AM' | 'PM'>('ANY');
  const [saveAddress, setSaveAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contactName, setContactName] = useState(() =>
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
  );
  const [contactPhone, setContactPhone] = useState(() => user?.phone ?? '');
  const [notes, setNotes] = useState('');
  const [unloadingPointPhotoUrl, setUnloadingPointPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  // ── Market prices (fetched from backend on mount) ─────────────────────
  const [marketPrices, setMarketPrices] = useState<Partial<Record<SkipSize, number>>>(SKIP_PRICES);
  const [quotes, setQuotes] = useState<SkipHireQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);

  // ── Material order linking (Stage 2) ─────────────────────────────────
  const [matOrders, setMatOrders] = useState<ApiOrder[]>([]);
  const [matOrdersLoading, setMatOrdersLoading] = useState(false);
  const [linkedMaterialOrderId, setLinkedMaterialOrderId] = useState<string | null>(null);
  const [showMatLink, setShowMatLink] = useState(false);

  // Redirect to welcome if not authenticated
  useEffect(() => {
    if (!user) router.replace('/(auth)/welcome' as never);
  }, [user, router]);

  // Fetch market prices once on mount
  useEffect(() => {
    api.skipHire
      .getMarketPrices()
      .then((prices) => setMarketPrices(prices))
      .catch(() => {}); // keep SKIP_PRICES fallback
  }, []);

  // Fetch live quotes when entering step 4 (size + address known)
  useEffect(() => {
    if (step !== 4 || !selectedSize || !picked) return;
    setQuotesLoading(true);
    api.skipHire
      .getQuotes({ size: selectedSize, location: picked.address, date: selectedDay })
      .then((q) => setQuotes(q))
      .catch(() => setQuotes([]))
      .finally(() => setQuotesLoading(false));
  }, [step, selectedSize, picked, selectedDay]);

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

  // Active statuses that make sense to link to a skip hire
  const ACTIVE_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'LOADING', 'IN_TRANSIT'];

  // Load unlinked, active material orders when user reaches step 4
  useEffect(() => {
    if (step !== 4 || !token || matOrders.length > 0) return;
    setMatOrdersLoading(true);
    api.orders
      .myOrders(token)
      .then((data) =>
        setMatOrders(
          data.filter((o) => !o.linkedSkipOrder && ACTIVE_ORDER_STATUSES.includes(o.status)),
        ),
      )
      .catch((err) => console.warn('Failed to load orders:', err))
      .finally(() => setMatOrdersLoading(false));
  }, [step, token, matOrders.length]);

  const goBack = useCallback(() => {
    if (step === 1) {
      if (router.canGoBack()) router.back();
      else router.replace('/(buyer)/home' as never);
    } else setStep((s) => (s - 1) as Step);
  }, [step, router]);

  // Use best carrier quote price if available, otherwise fall back to market price
  const activeSize = state.skipSize ?? selectedSize ?? 'MIDI';
  const price =
    quotes.length > 0
      ? quotes[0].price
      : (marketPrices[activeSize] ?? SKIP_PRICES[activeSize] ?? 129);

  const ctaLabel =
    step === 4 ? (quotesLoading ? 'Ielādē cenas...' : `Pasūtīt — €${price}`) : 'Turpināt';

  const ctaDisabled =
    (step === 1 && !selectedWaste) ||
    (step === 2 && !selectedSize) ||
    (step === 3 && !picked) ||
    (step === 4 && quotesLoading) ||
    submitting;

  const onCTA = useCallback(async () => {
    if (step < 4) {
      setStep((s) => (s + 1) as Step);
      return;
    }
    // Submit
    if (!token) {
      toast.info('Lai veiktu pasūtījumu, lūdzu vispirms piesakieties.');
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
          deliveryWindow: deliveryWindow !== 'ANY' ? deliveryWindow : undefined,
          contactName: contactName || undefined,
          contactPhone: contactPhone || undefined,
          notes: notes || undefined,
          unloadingPointPhotoUrl: unloadingPointPhotoUrl || undefined,
          // Pass winning carrier so backend derives price server-side
          carrierId: quotes[0]?.carrierId || undefined,
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
      // Save address if user opted in
      if (saveAddress && picked && token) {
        api.savedAddresses
          .create(
            {
              label: picked.address.split(',')[0],
              address: picked.address,
              city: picked.city ?? '',
              lat: picked.lat,
              lng: picked.lng,
            },
            token,
          )
          .catch(() => {});
      }
      haptics.success();
      setSkipPaymentClientSecret(order.clientSecret ?? null);
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
    deliveryWindow,
    saveAddress,
    contactName,
    contactPhone,
    notes,
    unloadingPointPhotoUrl,
    linkedMaterialOrderId,
    setDeliveryDate,
    setConfirmedOrder,
    setSkipPaymentClientSecret,
    router,
  ]);

  const pickUnloadingPhoto = useCallback(async (fromCamera: boolean) => {
    setPhotoBusy(true);
    try {
      let result: ImagePicker.ImagePickerResult;
      if (fromCamera) {
        const { granted } = await ImagePicker.requestCameraPermissionsAsync();
        if (!granted) {
          toast.error('Lai pievienotu foto, atļauj piekļuvi kamerai.');
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
        // Guard against oversized base64 payloads (approx: base64 len × 0.75 = bytes)
        const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
        const approxBytes = (asset.base64?.length ?? 0) * 0.75;
        if (approxBytes > MAX_BYTES) {
          Alert.alert(
            'Foto ir pārāk liels',
            'Lūdzu izvēlieties mazāku attēlu vai fotografējiet no tuvāka attāluma (maks. 2 MB).',
          );
          return;
        }
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

  if (step === 3) {
    return (
      <InlineAddressStep
        picked={picked}
        onPick={handlePickConfirm}
        onConfirm={onCTA}
        onCancel={goBack}
        contextLabel="Piegādes adrese"
      />
    );
  }

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
            <SkipSizeStep
              selected={selectedSize}
              onSelect={handleSizeSelect}
              prices={marketPrices}
            />
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
            <View
              style={{
                marginBottom: 16,
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: '#fff',
                borderWidth: 0,
              }}
            >
              <Calendar
                current={selectedDay || new Date().toISOString().split('T')[0]}
                onDayPress={(day: any) => {
                  setSelectedDay(day.dateString);
                }}
                markedDates={{
                  [selectedDay || new Date().toISOString().split('T')[0]]: {
                    selected: true,
                    selectedColor: '#111827',
                  },
                }}
                theme={{
                  calendarBackground: '#ffffff',
                  textSectionTitleColor: '#6B7280',
                  selectedDayBackgroundColor: '#111827',
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: '#2563EB',
                  dayTextColor: '#111827',
                  textDisabledColor: '#D1D5DB',
                  dotColor: '#2563EB',
                  selectedDotColor: '#ffffff',
                  arrowColor: '#111827',
                  monthTextColor: '#111827',
                  textDayFontFamily: 'Geist-Medium',
                  textMonthFontFamily: 'Geist-SemiBold',
                  textDayHeaderFontFamily: 'Geist-Medium',
                  textDayFontSize: 15,
                  textMonthFontSize: 16,
                  textDayHeaderFontSize: 13,
                }}
                minDate={new Date().toISOString().split('T')[0]}
                firstDay={1}
                enableSwipeMonths={true}
              />
            </View>

            {/* Delivery window */}
            <Text style={[s.sectionLabel, { marginTop: 16 }]}>Vēlamais piegādes laiks</Text>
            <View style={s.windowRow}>
              {(
                [
                  ['ANY', 'Jebkurā laikā'],
                  ['AM', 'Rīts  8–12'],
                  ['PM', 'Diena  12–17'],
                ] as const
              ).map(([val, label]) => (
                <TouchableOpacity
                  key={val}
                  style={[s.windowChip, deliveryWindow === val && s.windowChipActive]}
                  onPress={() => setDeliveryWindow(val)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[s.windowChipText, deliveryWindow === val && s.windowChipTextActive]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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
              <DetailRow label="Cena (bez PVN)" value={`€${price}`} />
              <DetailRow label="PVN 21%" value={`€${(price * 0.21).toFixed(2)}`} />
              <DetailRow label="Kopā apmaksāt" value={`€${(price * 1.21).toFixed(2)}`} />
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
                placeholder="Piezīmes (piem., piekļuves kods, vārtu atvēršana)"
                placeholderTextColor="#9ca3af"
                multiline
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            {/* Save address toggle */}
            {picked && (
              <TouchableOpacity
                style={s.saveAddrRow}
                onPress={() => setSaveAddress((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[s.saveAddrCheck, saveAddress && s.saveAddrCheckActive]}>
                  {saveAddress && <Check size={12} color="#fff" strokeWidth={2.5} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.saveAddrLabel}>Saglabāt šo adresi</Text>
                  <Text style={s.saveAddrSub} numberOfLines={1}>
                    {picked.address.split(',')[0]}
                  </Text>
                </View>
                <Bookmark size={16} color={saveAddress ? '#111827' : '#9ca3af'} />
              </TouchableOpacity>
            )}

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
                        <Text style={[s.matOrderNum, { color: colors.textMuted }]}>
                          Noņemt saiti
                        </Text>
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
  hint: { fontSize: 14, color: colors.textMuted, marginBottom: 16, lineHeight: 20 },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSubtle,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  addressText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
    lineHeight: 20,
  },
  addressPlaceholder: { color: colors.textDisabled, fontWeight: '400' },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 8,
    marginBottom: 16,
  },
  dayStrip: { flexGrow: 0 },
  dayChip: {
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    backgroundColor: colors.bgSubtle,
    minWidth: 54,
  },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.textPrimary },
  dayChipAsap: { borderColor: '#fca5a5', backgroundColor: '#fff7f7', minWidth: 62 },
  dayDow: { fontSize: 11, color: colors.textDisabled, fontWeight: '500' },
  dayNum: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginVertical: 2 },
  dayMon: { fontSize: 11, color: colors.textDisabled, fontWeight: '500' },
  dayActive: { color: '#fff' },
  dayActiveSub: { color: colors.textDisabled },
  windowRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  windowChip: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
  },
  windowChipActive: { backgroundColor: '#000', borderColor: '#000' },
  windowChipText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  windowChipTextActive: { color: '#fff' },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 0,
    borderColor: 'transparent',
    overflow: 'hidden',
    padding: 0,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
    paddingBottom: 16,
    paddingHorizontal: 4,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  addressValue: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600',
    lineHeight: 22,
  },
  detailRow: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailLabel: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.bgSubtle,
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.textPrimary,
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  saveAddrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 4,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginBottom: 8,
  },
  saveAddrCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveAddrCheckActive: { backgroundColor: '#000', borderColor: '#000' },
  saveAddrLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  saveAddrSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  photoCard: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
  },
  photoAddBtn: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.bgSubtle,
  },
  photoAddBtnText: {
    fontSize: 13,
    color: colors.textSecondary,
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
    color: colors.success,
    fontWeight: '600',
  },
  matOrderList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  matOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: '#fff',
  },
  matOrderRowActive: {
    backgroundColor: '#059669',
  },
  matOrderNum: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  matOrderName: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  matOrderEmpty: {
    fontSize: 13,
    color: colors.textDisabled,
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
    color: colors.textPrimary,
    marginTop: 20,
    marginBottom: 8,
  },
  successSub: { fontSize: 15, color: colors.textMuted, marginBottom: 24 },
  jobBadge: {
    backgroundColor: colors.bgMuted,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  jobBadgeText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  successBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  successBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
