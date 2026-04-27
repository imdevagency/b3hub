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
  Image,
  ActivityIndicator,
} from 'react-native';
import { WizardCalendar } from '@/components/wizard/WizardCalendar';
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
import { formatDate } from '@/lib/format';
import { SKIP_PRICES, toISO, addDays } from '@/components/wizard/skip-hire/_types';
import { SkipWasteStep } from '@/components/wizard/skip-hire/SkipWasteStep';
import { SkipSizeStep } from '@/components/wizard/skip-hire/SkipSizeStep';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { FlatAddressPicker } from '@/components/wizard/FlatAddressPicker';
import { InlineAddressStep } from '@/components/wizard/InlineAddressStep';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { SavedAddressPicker } from '@/components/wizard/SavedAddressPicker';
import { colors } from '@/lib/theme';
import { useToast } from '@/components/ui/Toast';
import { DetailRow } from '@/components/ui/DetailRow';
import { InfoSection } from '@/components/ui/InfoSection';
import { WizardAuthGate } from '@/components/wizard/WizardAuthGate';

// Module-level constant — statuses eligible to link a skip hire to
const ACTIVE_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'LOADING', 'IN_TRANSIT'];
import { SectionLabel } from '@/components/ui/SectionLabel';
import { TextInputField } from '@/components/ui/TextInputField';

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
    setSkipPaymentUrl,
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
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // collectionDay = end of hire period; null until user taps the second date.
  const [collectionDay, setCollectionDay] = useState<string | null>(null);
  const [deliveryWindow, setDeliveryWindow] = useState<'ANY' | 'AM' | 'PM'>('ANY');
  // Derived: days between delivery and collection (min 1). Falls back to 14 if not yet chosen.
  const hireDays =
    collectionDay && selectedDay
      ? Math.max(
          1,
          Math.round(
            (new Date(collectionDay + 'T00:00:00').getTime() -
              new Date(selectedDay + 'T00:00:00').getTime()) /
              86_400_000,
          ),
        )
      : 14;
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'INVOICE'>('CARD');
  const [saveAddress, setSaveAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [contactName, setContactName] = useState(() =>
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
  );
  const [contactPhone, setContactPhone] = useState(() => user?.phone ?? '');
  const [notes, setNotes] = useState('');
  const [bisNumber, setBisNumber] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
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
  // (removed — auth gate fires at commitment, not on mount)

  // Sync contact fields when user authenticates mid-wizard
  useEffect(() => {
    if (!user) return;
    if (!contactName.trim())
      setContactName(`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim());
    if (!contactPhone.trim()) setContactPhone(user.phone ?? '');
  }, [user?.id]);

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
      .getQuotes({ size: selectedSize, location: picked.address, date: selectedDay! })
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
      .catch(() => {})
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

  const totalWithVat = (price * 1.21).toFixed(2);
  const ctaLabel =
    step === 4
      ? quotesLoading
        ? 'Ielādē cenas...'
        : `Pasūtīt — €${totalWithVat} (ar PVN)`
      : 'Turpināt';

  const ctaDisabled =
    (step === 1 && (!selectedWaste || !selectedSize)) ||
    (step === 2 && !picked) ||
    (step === 3 && (!selectedDay || !collectionDay)) ||
    (step === 4 && (quotesLoading || !termsAccepted)) ||
    submitting;

  const onCTA = useCallback(async () => {
    if (step < 4) {
      haptics.medium();
      setStep((s) => (s + 1) as Step);
      return;
    }
    // Submit
    if (!token) {
      setShowAuthGate(true);
      return;
    }
    if (!state.location || !state.wasteCategory || !state.skipSize) return;
    setSubmitting(true);
    setDeliveryDate(selectedDay!);
    try {
      const order = await api.skipHire.create(
        {
          location: state.location,
          ...(state.locationLat != null ? { lat: state.locationLat } : {}),
          ...(state.locationLng != null ? { lng: state.locationLng } : {}),
          wasteCategory: state.wasteCategory,
          skipSize: state.skipSize,
          deliveryDate: selectedDay!,
          deliveryWindow: deliveryWindow !== 'ANY' ? deliveryWindow : undefined,
          hireDays,
          paymentMethod,
          contactName: contactName || undefined,
          contactPhone: contactPhone || undefined,
          notes: notes || undefined,
          bisNumber: bisNumber || undefined,
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
      setSkipPaymentUrl(order.paymentUrl ?? null);
      setConfirmedOrder(order);
      router.push('/skip-hire/confirmation');
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
    collectionDay,
    deliveryWindow,
    hireDays,
    paymentMethod,
    saveAddress,
    contactName,
    contactPhone,
    notes,
    bisNumber,
    unloadingPointPhotoUrl,
    linkedMaterialOrderId,
    setDeliveryDate,
    setConfirmedOrder,
    setSkipPaymentUrl,
    router,
  ]);

  const pickUnloadingPhoto = useCallback(
    async (fromCamera: boolean) => {
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
          // Upload to storage immediately; store the returned URL (not a raw data URI)
          if (asset.base64 && token) {
            try {
              const mimeType = asset.mimeType ?? 'image/jpeg';
              const { url } = await api.skipHire.uploadPhoto(asset.base64, mimeType, token);
              setUnloadingPointPhotoUrl(url);
            } catch {
              toast.error('Neizdevās augšupielādēt foto. Mēģiniet vēlreiz.');
            }
          } else {
            setUnloadingPointPhotoUrl(asset.uri);
          }
        }
      } finally {
        setPhotoBusy(false);
      }
    },
    [token],
  );

  const openPhotoOptions = useCallback(() => {
    Alert.alert('Izkraušanas punkta foto', '', [
      { text: 'Fotografēt', onPress: () => pickUnloadingPhoto(true) },
      { text: 'Izvēlēties no galerijas', onPress: () => pickUnloadingPhoto(false) },
      { text: 'Atcelt', style: 'cancel' },
    ]);
  }, [pickUnloadingPhoto]);

  const STEP_TITLES: Record<Step, string> = {
    1: 'Ko?',
    2: 'Kur?',
    3: 'Kad?',
    4: 'Pārskatīt un pasūtīt',
  };

  if (step === 2 && false) {
    // InlineAddressStep kept as import for PickedAddress type; step 2 now uses FlatAddressPicker
    return (
      <InlineAddressStep
        picked={picked}
        onPick={handlePickConfirm}
        onConfirm={() => {}}
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
        {/* ── Step 1 (Ko?): Waste type + Container size ── */}
        {step === 1 && (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <SkipWasteStep selected={selectedWaste} onSelect={handleWasteSelect} flat />
            {selectedWaste && (
              <>
                <SectionLabel
                  label="Konteinera izmērs"
                  style={{ paddingHorizontal: 20, marginTop: 8, marginBottom: 4 }}
                />
                <SkipSizeStep
                  selected={selectedSize}
                  onSelect={handleSizeSelect}
                  prices={marketPrices}
                  flat
                />
              </>
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        )}

        {/* ── Step 2 (Kur?): Flat address picker + save address + photo ── */}
        {step === 2 && (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 40 }}
          >
            <FlatAddressPicker picked={picked} onPick={handlePickConfirm} />

            {picked && (
              <View style={{ paddingHorizontal: 20, marginTop: 20, gap: 0 }}>
                {/* Save address toggle */}
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

                {/* Unloading point photo */}
                <SectionLabel
                  label="Izkraušanas punkta foto (neobligāti)"
                  style={{ marginTop: 20 }}
                />
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
              </View>
            )}
          </ScrollView>
        )}

        {/* ── Step 3 (Kad?): Delivery date + time window ── */}
        {step === 3 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.contentPad}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Date range summary bar ── */}
            <View style={s.rangeSummaryBar}>
              <View style={s.rangeSummaryCol}>
                <Text style={s.rangeSummaryLabel}>Piegāde</Text>
                <Text style={[s.rangeSummaryDate, !selectedDay && s.rangeSummaryDateEmpty]}>
                  {selectedDay
                    ? new Date(selectedDay + 'T00:00:00').toLocaleDateString('lv-LV', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })
                    : 'Izvēlieties'}
                </Text>
              </View>
              <View style={s.rangeSummaryArrow}>
                <Text style={s.rangeSummaryArrowText}>→</Text>
              </View>
              <View style={[s.rangeSummaryCol, { alignItems: 'flex-end' }]}>
                <Text style={s.rangeSummaryLabel}>
                  Savākšana{collectionDay ? ` · ${hireDays} d.` : ''}
                </Text>
                <Text style={[s.rangeSummaryDate, !collectionDay && s.rangeSummaryDateEmpty]}>
                  {collectionDay
                    ? new Date(collectionDay + 'T00:00:00').toLocaleDateString('lv-LV', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })
                    : 'Izvēlieties'}
                </Text>
              </View>
            </View>

            {/* ── Calendar — two-tap range selection ── */}
            <WizardCalendar
              selectedDate={selectedDay || ''}
              onDateChange={(tapped) => {
                // If both dates are already set, or no date is set, start over
                if (!selectedDay || (selectedDay && collectionDay)) {
                  setSelectedDay(tapped);
                  setCollectionDay(null);
                  return;
                }

                // At this point, selectedDay is set, but collectionDay is null
                if (tapped < selectedDay) {
                  // If tapped date is before the start date, shift the start date
                  setSelectedDay(tapped);
                  setCollectionDay(null);
                } else {
                  // Tapped date is >= start date: complete the range
                  setCollectionDay(tapped);
                }
              }}
              minDate={toISO(addDays(today, 1))}
              rangeEndDate={collectionDay ?? undefined}
            />

            {/* ── Delivery window ── */}
            <SectionLabel label="Vēlamais piegādes laiks" style={{ marginTop: 4 }} />
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
          </ScrollView>
        )}

        {/* ── Step 4 (Pārskatīt un pasūtīt): Summary + contact + photo + mat link ── */}
        {step === 4 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.contentPad}
            showsVerticalScrollIndicator={false}
          >
            <InfoSection icon={<MapPin size={18} color="#6b7280" />} title="Kopsavilkums">
              <DetailRow
                label="Adrese"
                value={picked?.address ?? state.location ?? '—'}
              />
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
              <DetailRow label="Piegādes datums" value={formatDate(selectedDay!)} />
              <DetailRow
                label="Piegādes laiks"
                value={
                  deliveryWindow === 'AM'
                    ? 'Rīts (8–12)'
                    : deliveryWindow === 'PM'
                      ? 'Diena (12–17)'
                      : 'Jebkurā laikā'
                }
              />
              <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 12, marginHorizontal: -20 }} />
              <DetailRow label="Cena (bez PVN)" value={`€${price.toFixed(2)}`} />
              <DetailRow label="PVN 21%" value={`€${(price * 0.21).toFixed(2)}`} />
              <DetailRow label="Kopā apmaksāt" value={`€${(price * 1.21).toFixed(2)}`} last />
            </InfoSection>

            <InfoSection icon={<Bookmark size={18} color="#6b7280" />} title="Kontaktinformācija">
              <View style={{ gap: 12 }}>
                <TextInputField
                  placeholder="Kontaktpersona"
                  value={contactName}
                  onChangeText={setContactName}
                />
                <TextInputField
                  placeholder="Tālrunis"
                  keyboardType="phone-pad"
                  value={contactPhone}
                  onChangeText={setContactPhone}
                />
                <TextInputField
                  placeholder="Piezīmes (piem., piekļuves kods, vārtu atvēršana)"
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                />
                <TextInputField
                  placeholder="BIS numurs (neobligāts) — piem. BL-231-2123-12"
                  value={bisNumber}
                  onChangeText={setBisNumber}
                  autoCapitalize="characters"
                />
              </View>
              <TouchableOpacity
                style={s.termsRow}
                onPress={() => setTermsAccepted((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[s.saveAddrCheck, termsAccepted && s.saveAddrCheckActive]}>
                  {termsAccepted && <Check size={12} color="#fff" strokeWidth={2.5} />}
                </View>
                <Text style={s.termsText}>
                  Piekrītu <Text style={s.termsLink}>lietošanas noteikumiem</Text> un{' '}
                  <Text style={s.termsLink}>privātuma politikai</Text>
                </Text>
              </TouchableOpacity>
            </InfoSection>

            <InfoSection icon={<Check size={18} color="#6b7280" />} title="Maksājuma veids">
              <View style={{ gap: 10 }}>
                {(
                  [
                    [
                      'CARD',
                      '💳 Ar karti (Paysera)',
                      'Tūlītējs maksājums ar debetkarti vai kredītkarti',
                    ],
                    ['INVOICE', '🧾 Priekšapmaksas rēķins', 'Rēķins tiks nosūtīts uz e-pastu'],
                  ] as const
                ).map(([val, label, sub]) => (
                  <TouchableOpacity
                    key={val}
                    style={[s.payMethodRow, paymentMethod === val && s.payMethodRowActive]}
                    onPress={() => setPaymentMethod(val)}
                    activeOpacity={0.75}
                  >
                    <View style={[s.payMethodRadio, paymentMethod === val && s.payMethodRadioActive]}>
                      {paymentMethod === val && <View style={s.payMethodRadioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[s.payMethodLabel, paymentMethod === val && s.payMethodLabelActive]}
                      >
                        {label}
                      </Text>
                      <Text style={s.payMethodSub}>{sub}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </InfoSection>

            <InfoSection icon={<Link2 size={18} color="#6b7280" />} title="Saistītie pasūtījumi">
              <TouchableOpacity
                style={s.matLinkToggle}
                onPress={() => setShowMatLink((v) => !v)}
                activeOpacity={0.75}
              >
                <Text style={s.matLinkToggleText}>
                  {linkedMaterialOrderId
                    ? `Saistīts: #${matOrders.find((o) => o.id === linkedMaterialOrderId)?.orderNumber ?? '...'}`
                    : 'Izvēlēties pasūtījumu (neobligāti)'}
                </Text>
                {showMatLink ? (
                  <ChevronUp size={16} color="#059669" />
                ) : (
                  <ChevronDown size={16} color="#059669" />
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
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
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
            </InfoSection>

            <View style={{ height: 16 }} />
          </ScrollView>
        )}
      </WizardLayout>
      <WizardAuthGate
        visible={showAuthGate}
        onAuthenticated={() => {
          setShowAuthGate(false);
          onCTA();
        }}
        onDismiss={() => setShowAuthGate(false)}
      />
    </>
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
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    lineHeight: 20,
  },
  addressPlaceholder: {
    color: colors.textDisabled,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
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
  dayDow: {
    fontSize: 11,
    color: colors.textDisabled,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  dayNum: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
    marginVertical: 2,
  },
  dayMon: {
    fontSize: 11,
    color: colors.textDisabled,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  dayActive: { color: '#fff' },
  dayActiveSub: { color: colors.textDisabled },
  // ── Step 3 hire-period chips ──────────────────────────────────
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  periodChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
  },
  periodChipActive: {
    backgroundColor: '#F9423A',
    borderColor: '#F9423A',
  },
  periodChipMain: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
  },
  periodChipSub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
    color: colors.textMuted,
    marginTop: 2,
  },
  periodChipTextActive: { color: '#ffffff' },
  periodChipSubActive: { color: '#9CA3AF' },
  // ── Range summary bar ──────────────────────────────────────────
  rangeSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  rangeSummaryCol: {
    flex: 1,
  },
  rangeSummaryLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.textMuted,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rangeSummaryDate: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rangeSummaryDateEmpty: {
    color: colors.textDisabled,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  rangeSummaryArrow: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  rangeSummaryArrowText: {
    fontSize: 16,
    color: colors.textMuted,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
  },
  // ── Delivery window chips ─────────────────────────────────────
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
  windowChipActive: { backgroundColor: '#F9423A', borderColor: '#F9423A' },
  windowChipText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'Inter_600SemiBold',
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
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    lineHeight: 22,
  },
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
  saveAddrCheckActive: { backgroundColor: '#F9423A', borderColor: '#F9423A' },
  saveAddrLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
  },
  saveAddrSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
    lineHeight: 20,
  },
  termsLink: {
    color: colors.primary,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
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
    fontFamily: 'Inter_600SemiBold',
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
    fontFamily: 'Inter_600SemiBold',
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
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  matOrderName: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'Inter_500Medium',
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
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
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
  jobBadgeText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
  },
  successBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  successBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: '#fff' },
  payMethodRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
  },
  payMethodRowActive: {
    borderColor: '#F9423A',
    backgroundColor: '#fff',
  },
  payMethodRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  payMethodRadioActive: { borderColor: '#F9423A' },
  payMethodRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F9423A',
  },
  payMethodLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textSecondary,
  },
  payMethodLabelActive: { color: colors.textPrimary },
  payMethodSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
  },
});
