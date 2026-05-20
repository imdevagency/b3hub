/**
 * material-order.tsx
 *
 * Buyer material order wizard — 7-step Schüttflix-modelled flow (delivery):
 *
 *  Step 1 – order-type : Delivery or Pickup?
 *  Step 2 – product    : Material category + fraction
 *  Step 3 – quantity   : Whole vehicles (BY_LOAD) OR manual amount
 *  Step 4 – address    : Delivery address + site truck access restrictions
 *  Step 5 – unload     : Precise unload spot (optional: photo + notes)
 *  Step 6 – when       : Delivery date + time window
 *  Step 7 – offers     : Supplier comparison → pick one → submit
 *
 * Pickup flow (5 steps): order-type → product → quantity → field → offers
 *
 * State and submit handlers live here. Step UI lives in components/wizard/material/.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { openPaymentUrl } from '@/lib/open-payment-url';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api/common';
import { UNIT_SHORT, DEFAULT_MATERIAL_NAMES } from '@/lib/materials';
import { useMaterialCatalogue } from '@/lib/use-material-catalogue';
import type { MaterialCategory, MaterialUnit } from '@/lib/materials';
import type { SupplierOffer } from '@/lib/api';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { Check, CheckCircle2, MapPin } from 'lucide-react-native';
import { WizardSummaryCard } from '@/components/wizard/WizardSummaryCard';
import { DetailRow } from '@/components/ui/DetailRow';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { TextInputField } from '@/components/ui/TextInputField';
import { WizardPaymentMethodPicker } from '@/components/wizard/WizardPaymentMethodPicker';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { AddressField } from '@/components/ui/AddressField';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { OrderTypeStep } from '@/components/wizard/material/OrderTypeStep';
import { ProductStep } from '@/components/wizard/material/ProductStep';
import { QuantityStep } from '@/components/wizard/material/QuantityStep';
import { UnloadSpotStep } from '@/components/wizard/material/UnloadSpotStep';
import { WhenStep } from '@/components/wizard/material/WhenStep';
import { OffersStep } from '@/components/wizard/material/OffersStep';
import { FieldPickerStep } from '@/components/wizard/material/FieldPickerStep';
import { WizardAuthGate } from '@/components/wizard/WizardAuthGate';

import {
  CATEGORY_DEFAULT_UNIT,
  ORDER_TYPE_UNIT_MAP,
  TRUCK_OPTIONS,
  type OrderType,
} from '@/components/wizard/material/_constants';

const DRAFT_KEY = '@b3hub_wizard_draft';

type Step =
  | 'order-type' // Step 1: Delivery or Pickup?
  | 'product' // Step 2: Material category + fraction
  | 'quantity' // Step 3: How much? (vehicle grid or manual)
  | 'address' // Step 4: Delivery address + truck access
  | 'unload' // Step 5: Unload spot (optional)
  | 'when' // Step 6: Date + time window
  | 'offers' // Step 7: Supplier offers → pick → submit
  | 'field'; // Pickup: field/slot selection

type SubmitResult = 'order';

const DELIVERY_STEPS: Step[] = [
  'order-type',
  'product',
  'quantity',
  'address',
  'unload',
  'when',
  'offers',
];
const PICKUP_STEPS: Step[] = ['order-type', 'product', 'quantity', 'field', 'offers'];

const STEP_TITLES: Record<Step, string> = {
  'order-type': 'Pasūtījuma veids',
  product: 'Ko pasūtīt?',
  quantity: 'Cik daudz?',
  address: 'Kur piegādāt?',
  unload: 'Izkraušanas vieta',
  when: 'Kad piegādāt?',
  offers: 'Salīdzini piedāvājumus',
  field: 'Izvēlies punktu',
};

type WizardDraft = {
  category: string;
  materialName: string;
  unit: MaterialUnit;
  quantity: number;
  notes: string;
  step: Step;
  pickedAddress: PickedAddress | null;
  deliveryDate: string;
  deliveryWindow: 'ANY' | 'AM' | 'PM';
  truckCount: number;
  truckIntervalMinutes: number;
  savedAt: number;
  selectedFraction?: string;
  orderType?: OrderType;
  selectedTruckId?: string;
};

export default function OrderRequestWizard() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { categoryLabels, categoryFractions } = useMaterialCatalogue();
  // Keep a ref so submit callbacks always read the latest token,
  // even when called from a closure captured before the auth gate resolved.
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  const params = useLocalSearchParams<{
    initialCategory?: string;
    prefillMaterial?: string;
    prefillAddress?: string;
    prefillCity?: string;
    resumeDraft?: string;
    prefilledQty?: string;
    schedule?: string;
  }>();

  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory>(
    (params.initialCategory as MaterialCategory) || 'GRAVEL',
  );
  const category = selectedCategory;

  // ── Step ──
  const [step, setStep] = useState<Step>('order-type');
  const [fulfillmentType, setFulfillmentType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [pickupFieldId, setPickupFieldId] = useState('');
  const [pickupSlotId, setPickupSlotId] = useState('');
  const [pickupDate, setPickupDate] = useState('');

  // Computed STEPS depends on fulfillmentType
  const STEPS: Step[] = fulfillmentType === 'PICKUP' ? PICKUP_STEPS : DELIVERY_STEPS;

  const stepIndex = STEPS.indexOf(step);

  // When fulfillmentType changes and current step is no longer valid, snap to first step
  useEffect(() => {
    if (stepIndex === -1) {
      setStep('order-type');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fulfillmentType]);

  // ── Specs ──
  const [materialName, setMaterialName] = useState(
    () =>
      params.prefillMaterial ||
      DEFAULT_MATERIAL_NAMES[(params.initialCategory as MaterialCategory) || 'GRAVEL'] ||
      '',
  );
  const [unit, setUnit] = useState<MaterialUnit>(
    CATEGORY_DEFAULT_UNIT[(params.initialCategory as MaterialCategory) || 'GRAVEL'] ?? 'TONNE',
  );
  const [quantity, setQuantity] = useState(() => {
    const prefill = params.prefilledQty ? parseFloat(params.prefilledQty) : NaN;
    return !isNaN(prefill) && prefill > 0 ? prefill : TRUCK_OPTIONS[0].capacity;
  });
  const [notes, setNotes] = useState('');
  const [bisNumber, setBisNumber] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [sitePhotoUri, setSitePhotoUri] = useState<string | null>(null);
  const [sitePhotoUrl, setSitePhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [authGateVisible, setAuthGateVisible] = useState(false);

  const [selectedFraction, setSelectedFraction] = useState<string>(
    () => (categoryFractions[(params.initialCategory as string) || 'GRAVEL'] ?? [])[0] ?? '',
  );
  const [orderType, setOrderType] = useState<OrderType>('BY_WEIGHT');
  const [selectedTruckId] = useState<string>(TRUCK_OPTIONS[0].id);

  // ── Address ──
  const [pickedAddress, setPickedAddress] = useState<PickedAddress | null>(null);

  // ── Unloading spot (precise pin within site) ──
  const [unloadLat, setUnloadLat] = useState<number | null>(null);
  const [unloadLng, setUnloadLng] = useState<number | null>(null);

  // ── When ──
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [deliveryWindow, setDeliveryWindow] = useState<'ANY' | 'AM' | 'PM'>('ANY');
  const [truckCount, setTruckCount] = useState(1);
  const [truckIntervalMinutes, setTruckIntervalMinutes] = useState(60);
  // Truck access restrictions — all types allowed by default, buyer can toggle off
  const [truckAccessIds, setTruckAccessIds] = useState<string[]>(() =>
    TRUCK_OPTIONS.map((o) => o.id),
  );
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'INVOICE'>('CARD');
  const [repeatEnabled] = useState(() => params.schedule === '1');
  const [repeatInterval] = useState<7 | 14 | 30>(7);

  // ── Offers ──
  const [offers, setOffers] = useState<SupplierOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState<SubmitResult | null>(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderId, setOrderId] = useState('');
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  /** Offer selected in the compare step; used for submission in the confirm step. */
  const [selectedOffer, setSelectedOffer] = useState<SupplierOffer | null>(null);

  // ── Contact (mutable — can be overridden for site contact)
  const [contactName, setContactName] = useState(() =>
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
  );
  const [contactPhone, setContactPhone] = useState(() => user?.phone ?? '');
  const [noContactOnSite, setNoContactOnSite] = useState(false);

  // Re-sync contact from profile after auth (guest → logged in mid-wizard)
  const prevUserId = useRef<string | null>(null);
  useEffect(() => {
    if (!user) return;
    if (prevUserId.current === user.id) return;
    prevUserId.current = user.id;
    if (!contactName) setContactName(`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim());
    if (!contactPhone) setContactPhone(user.phone ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Draft: restore ──
  const draftLoadedRef = useRef(false);
  useEffect(() => {
    if (params.resumeDraft !== 'true') {
      // Pre-fill delivery address from last order (if no explicit prefill param)
      if (!params.prefillAddress) {
        AsyncStorage.getItem('@b3hub_last_delivery')
          .then((raw) => {
            if (!raw) return;
            try {
              const d = JSON.parse(raw);
              if (d?.address && d?.lat && d?.lng) {
                setPickedAddress({
                  address: d.address,
                  city: d.city ?? '',
                  lat: d.lat,
                  lng: d.lng,
                });
              }
            } catch {}
          })
          .catch(() => {});
      }
      draftLoadedRef.current = true;
      return;
    }
    AsyncStorage.getItem(DRAFT_KEY)
      .then((raw) => {
        if (!raw) {
          draftLoadedRef.current = true;
          return;
        }
        try {
          const d: WizardDraft = JSON.parse(raw);
          const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
          if (d.savedAt && Date.now() - d.savedAt > DRAFT_TTL_MS) {
            AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
            draftLoadedRef.current = true;
            return;
          }
          setMaterialName(d.materialName || materialName);
          setUnit(d.unit || unit);
          setQuantity(d.quantity || quantity);
          setNotes(d.notes || '');
          setStep(d.step || 'order-type');
          if (d.pickedAddress) setPickedAddress(d.pickedAddress);
          if (d.deliveryDate) setDeliveryDate(d.deliveryDate);
          setDeliveryWindow(d.deliveryWindow || 'ANY');
          if (d.category) setSelectedCategory(d.category as MaterialCategory);
          if (d.selectedFraction) setSelectedFraction(d.selectedFraction);
          if (d.orderType) setOrderType(d.orderType as OrderType);
        } catch {
          /* ignore corrupt draft */
        }
        draftLoadedRef.current = true;
      })
      .catch(() => {
        draftLoadedRef.current = true;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Draft: save ──
  useEffect(() => {
    if (!draftLoadedRef.current) return;
    if (submitted) return;
    const draft: WizardDraft = {
      category,
      materialName,
      unit,
      quantity,
      notes,
      step,
      pickedAddress,
      deliveryDate,
      deliveryWindow,
      truckCount,
      truckIntervalMinutes,
      selectedFraction,
      orderType,
      selectedTruckId,
      savedAt: Date.now(),
    };
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
  }, [
    category,
    materialName,
    unit,
    quantity,
    notes,
    step,
    pickedAddress,
    deliveryDate,
    deliveryWindow,
    truckCount,
    truckIntervalMinutes,
    submitted,
  ]);

  // ── Persist last delivery address for catalog live pricing ──
  useEffect(() => {
    if (!pickedAddress) return;
    AsyncStorage.setItem('@b3hub_last_delivery', JSON.stringify(pickedAddress)).catch(() => {});
  }, [pickedAddress]);

  // ── Sync materialName from pickers ──
  useEffect(() => {
    const name =
      selectedFraction !== 'Nav norādīts'
        ? `${categoryLabels[selectedCategory]} ${selectedFraction}`
        : categoryLabels[selectedCategory];
    setMaterialName(name);
  }, [selectedCategory, selectedFraction]);

  // ── Sync unit from order type ──
  // BY_LOAD uses the vehicle-count grid — quantity is expressed in total tonnes.
  useEffect(() => {
    setUnit(orderType === 'BY_LOAD' ? 'TONNE' : ORDER_TYPE_UNIT_MAP[orderType]);
  }, [orderType]);

  // ── Load offers when entering the offers step ──
  // No auth required to browse prices — auth gate fires at the moment of commitment.
  useEffect(() => {
    if (step !== 'offers') return;
    if (fulfillmentType === 'DELIVERY' && !pickedAddress) return;
    setOffersLoading(true);
    setOffersError('');
    setOffers([]);
    api.materials
      .getOffers(
        {
          category: selectedCategory,
          quantity,
          lat: pickedAddress?.lat,
          lng: pickedAddress?.lng,
        },
        token ?? undefined,
      )
      .then(setOffers)
      .catch(() => {
        setOffersError('Neizdevās ielādēt piedāvājumus. Jūs joprojām varat nosūtīt pieprasījumu.');
      })
      .finally(() => setOffersLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Navigation ──
  const goBack = useCallback(() => {
    if (submitted) {
      if (submitted === 'order' && orderId && !orderId.startsWith('guest:')) {
        router.replace(`/(buyer)/order/${orderId}` as never);
      } else if (submitted === 'order') {
        // Guest order — no protected screen to land on; go home.
        router.replace('/(buyer)/home' as never);
      } else {
        router.replace('/(buyer)/orders' as never);
      }
      return;
    }
    if (stepIndex === 0) {
      const hasDraft = notes.trim() !== '' || pickedAddress !== null;
      if (hasDraft) {
        Alert.alert('Iziet no pasūtīšanas?', 'Jūsu progress ir saglabāts. Varat turpināt vēlāk.', [
          { text: 'Turpināt pasūtīšanu', style: 'cancel' },
          {
            text: 'Saglabāt un iziet',
            onPress: () => {
              if (router.canGoBack()) router.back();
              else router.replace('/(buyer)/home' as never);
            },
          },
        ]);
        return;
      }
      if (router.canGoBack()) router.back();
      else router.replace('/(buyer)/home' as never);
      return;
    }
    setStep(STEPS[stepIndex - 1]);
  }, [stepIndex, STEPS, router, submitted, notes, pickedAddress, orderId]);

  const goNext = useCallback(() => {
    if (stepIndex < STEPS.length - 1) {
      haptics.medium();
      setStep(STEPS[stepIndex + 1]);
    }
  }, [stepIndex, STEPS]);

  // ── Site photo upload ──
  const handlePickSitePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (camStatus !== 'granted') {
        Alert.alert(
          'Atļauja liegta',
          'Lai pievienotu foto, atļaujiet piekļuvi kamerai vai galerijā.',
        );
        return;
      }
    }
    Alert.alert('Izkraušanas vietas foto', 'Izvēlieties avotu', [
      {
        text: 'Kamera',
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            base64: true,
          });
          if (!result.canceled && result.assets[0]) await uploadSitePhotoAsset(result.assets[0]);
        },
      },
      {
        text: 'Galerija',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            base64: true,
          });
          if (!result.canceled && result.assets[0]) await uploadSitePhotoAsset(result.assets[0]);
        },
      },
      { text: 'Atcelt', style: 'cancel' },
    ]);
  };

  const uploadSitePhotoAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) return;
    const currentToken = tokenRef.current;
    if (!currentToken) return;
    setUploadingPhoto(true);
    try {
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const { url } = await api.orders.uploadSitePhoto(asset.base64, mimeType, currentToken);
      setSitePhotoUri(asset.uri);
      setSitePhotoUrl(url);
    } catch {
      Alert.alert('Kļūda', 'Foto augšupielāde neizdevās. Mēģiniet vēlreiz.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── Submit: buyer selects an offer ──
  const handleSelectOffer = async (offer: SupplierOffer) => {
    const currentToken = tokenRef.current;
    if (!currentToken || !pickedAddress) return;
    if (submittingRef.current) return;
    if (offer.minOrder && quantity < offer.minOrder) {
      setSubmitError(
        `Minimālais pasūtījuma daudzums šim piegādātājam ir ${offer.minOrder} ${UNIT_SHORT[unit] ?? unit}`,
      );
      return;
    }
    if (!contactName.trim() || !contactPhone.trim()) {
      if (!noContactOnSite) {
        setSubmitError('Lūdzu, norādiet kontaktpersonu un tālruņa numuru pirms pasūtīšanas.');
        return;
      }
    }
    // Guard against race condition: if user just logged in via auth gate, state may not
    // have re-synced yet — fall back to the current user object values.
    const effectiveContactName =
      contactName.trim() ||
      `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() ||
      contactName;
    const effectiveContactPhone = contactPhone.trim() || user?.phone?.trim() || contactPhone;
    setSubmitting(true);
    setSubmitError('');
    submittingRef.current = true;
    try {
      const order = await api.materials.createOrder(
        {
          buyerId: user!.id,
          materialId: offer.id,
          quantity,
          unit,
          unitPrice: offer.basePrice,
          deliveryAddress: pickedAddress?.address ?? '',
          deliveryCity: pickedAddress?.city ?? '',
          deliveryDate:
            pickupDate ||
            deliveryDate ||
            new Date(Date.now() + 86400000).toISOString().split('T')[0],
          deliveryWindow: deliveryWindow !== 'ANY' ? deliveryWindow : undefined,
          deliveryFee: offer.deliveryFee ?? undefined,
          deliveryLat: pickedAddress?.lat,
          deliveryLng: pickedAddress?.lng,
          unloadLat: unloadLat ?? undefined,
          unloadLng: unloadLng ?? undefined,
          siteContactName: effectiveContactName || undefined,
          siteContactPhone: effectiveContactPhone || undefined,
          notes: notes || undefined,
          bisNumber: bisNumber || undefined,
          sitePhotoUrl: sitePhotoUrl || undefined,
          noContactOnSite: noContactOnSite || undefined,
          truckCount,
          truckIntervalMinutes: truckCount > 1 ? truckIntervalMinutes : undefined,
          fulfillmentType,
          pickupFieldId: pickupFieldId || undefined,
          pickupSlotId: pickupSlotId || undefined,
          paymentMethod,
        },
        currentToken,
      );

      if (repeatEnabled) {
        const firstRun = new Date(Date.now() + repeatInterval * 86_400_000).toISOString();
        await api.schedules.create(
          {
            orderType: 'MATERIAL',
            deliveryAddress: pickedAddress.address,
            deliveryCity: pickedAddress.city,
            deliveryState: '',
            deliveryPostal: '',
            deliveryWindow: deliveryWindow !== 'ANY' ? deliveryWindow : undefined,
            notes: notes || undefined,
            siteContactName: effectiveContactName || undefined,
            siteContactPhone: effectiveContactPhone || undefined,
            items: [{ materialId: offer.id, quantity, unit }],
            intervalDays: repeatInterval,
            nextRunAt: firstRun,
          },
          currentToken,
        );
      }

      setOrderNumber(order.orderNumber);
      setOrderId(order.id);
      setSubmitted('order');
      haptics.success();
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      // CARD payment: immediately open Paysera checkout — no extra taps
      if (paymentMethod === 'CARD' && currentToken) {
        api
          .createIntent(order.id, currentToken)
          .then(({ paymentUrl: url }) => {
            setPaymentUrl(url);
            openPaymentUrl(url).catch(() => {});
          })
          .catch(() => {
            // silently ignore — user can still tap the button in the success screen
          });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const data = err.data as { code?: string; currentPrice?: number };
        if (data?.code === 'PRICE_CHANGED' && data.currentPrice !== undefined) {
          Alert.alert(
            'Cena ir mainījusies',
            `Materiāla cena ir mainījusies uz €${data.currentPrice.toFixed(2)}. Vai vēlaties turpināt?`,
            [
              { text: 'Atcelt', style: 'cancel' },
              {
                text: 'Apstiprināt',
                onPress: () => handleSelectOffer({ ...offer, basePrice: data.currentPrice! }),
              },
            ],
          );
          return;
        }
      }
      setSubmitError(err instanceof Error ? err.message : 'Kaut kas nogāja greizi.');
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  // ── Submit: guest checkout (no account) — uses public /guest-orders ──
  const handleGuestSelectOffer = async (
    offer: SupplierOffer,
    contact: { name: string; phone: string; email?: string },
  ) => {
    if (!pickedAddress) return;
    if (submittingRef.current) return;
    setSubmitting(true);
    setSubmitError('');
    submittingRef.current = true;
    try {
      const result = await api.guestOrders.create({
        category: 'MATERIAL',
        materialCategory: category,
        materialName,
        quantity,
        unit,
        deliveryAddress: pickedAddress.address,
        deliveryCity: pickedAddress.city,
        deliveryLat: pickedAddress.lat,
        deliveryLng: pickedAddress.lng,
        deliveryDate: deliveryDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
        deliveryWindow: deliveryWindow !== 'ANY' ? deliveryWindow : undefined,
        contactName: contact.name,
        contactPhone: contact.phone,
        contactEmail: contact.email,
        notes: notes || undefined,
      });
      // Reuse the same success UI: stash the order number/token.
      setOrderNumber(result.orderNumber);
      // Use the public tracking token as the "order id" so the success CTA
      // can navigate to the public tracking screen instead of a protected one.
      setOrderId(`guest:${result.token}`);
      setSubmitted('order');
      haptics.success();
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kaut kas nogāja greizi.');
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  // ── CTA ──
  const canProceed =
    step === 'order-type'
      ? true
      : step === 'product'
        ? !!selectedFraction
        : step === 'quantity'
          ? quantity > 0
          : step === 'address'
            ? !!pickedAddress
            : step === 'unload'
              ? true // optional
              : step === 'field'
                ? !!pickupFieldId && !!pickupSlotId
                : step === 'when'
                  ? !!deliveryDate
                  : !offersLoading && !submitting && !submitted && termsAccepted;

  const hasUnloadData = !!sitePhotoUri || !!notes.trim();

  const ctaLabel = submitted
    ? orderId.startsWith('guest:')
      ? 'Uz sākumu'
      : 'Skatīt pasūtījumu'
    : step === 'order-type'
      ? 'Turpināt'
      : step === 'unload'
        ? hasUnloadData
          ? 'Turpināt'
          : 'Izlaist'
        : step === 'offers'
          ? 'Nosūtīt pieprasījumu'
          : 'Turpināt';

  const handleCTA = submitted
    ? orderId.startsWith('guest:')
      ? () => router.replace('/(buyer)/home' as never)
      : () => router.replace(`/(buyer)/order/${orderId}` as never)
    : step === 'offers'
      ? undefined
      : goNext;

  return (
    <WizardLayout
      title={submitted === 'order' ? 'Pasūtījums veikts!' : STEP_TITLES[step]}
      step={stepIndex + 1}
      totalSteps={STEPS.length}
      onBack={goBack}
      onClose={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(buyer)/home' as never);
      }}
      ctaLabel={ctaLabel}
      onCTA={handleCTA}
      ctaDisabled={!canProceed || submitting}
      ctaLoading={submitting && step !== 'offers'}
      hideFooter={step === 'offers' || step === 'order-type'}
      stepKey={step}
    >
      {/* ── Step 1: Order type ─────────────────────────────────────────── */}
      {step === 'order-type' && (
        <OrderTypeStep
          fulfillmentType={fulfillmentType}
          onSelect={(type) => {
            setFulfillmentType(type);
            goNext();
          }}
        />
      )}

      {/* ── Step 2: Product ────────────────────────────────────────────── */}
      {step === 'product' && (
        <ProductStep
          category={selectedCategory}
          onCategoryChange={setSelectedCategory}
          selectedFraction={selectedFraction}
          onFractionChange={setSelectedFraction}
          categoryLabels={categoryLabels}
          categoryFractions={categoryFractions}
        />
      )}

      {/* ── Step 3: Quantity ───────────────────────────────────────────── */}
      {step === 'quantity' && (
        <QuantityStep
          orderType={orderType}
          onOrderTypeChange={setOrderType}
          quantity={quantity}
          onQuantityChange={setQuantity}
          onTotalLoadsChange={setTruckCount}
          category={selectedCategory}
        />
      )}

      {/* ── Step 4: Address + truck access ─────────────────────────────── */}
      {step === 'address' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Instructions ── */}
          <View style={{ marginBottom: 24, marginTop: 8 }}>
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Inter_500Medium',
                color: '#6B7280',
                lineHeight: 22,
              }}
            >
              {!pickedAddress
                ? 'Norādiet, kur vēlētos saņemt materiālus'
                : 'Pārbaudiet un apstipriniet izvēlēto adresi'}
            </Text>
          </View>

          {/* ── Address card ── */}
          <View
            style={{
              backgroundColor: pickedAddress ? '#fff' : 'transparent',
              borderRadius: 16,
              borderWidth: pickedAddress ? 1 : 0,
              borderColor: '#E5E7EB',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: pickedAddress ? 0.04 : 0,
              shadowRadius: 10,
              elevation: pickedAddress ? 2 : 0,
              overflow: 'hidden',
              marginBottom: 24,
            }}
          >
            <AddressField
              value={pickedAddress}
              onPick={(p) => {
                haptics.light();
                setPickedAddress(p);
                setUnloadLat(null);
                setUnloadLng(null);
              }}
              placeholder="Ievadiet piegādes adresi"
              pinColor="#111827"
              style={
                pickedAddress
                  ? {
                      borderWidth: 0,
                      borderRadius: 0,
                      shadowColor: 'transparent',
                      shadowOpacity: 0,
                      elevation: 0,
                      backgroundColor: 'transparent',
                    }
                  : {}
              }
            />
            {!pickedAddress && (
              <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: '#F3F4F6',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MapPin size={16} color="#4B5563" />
                  </View>
                  <View>
                    <Text
                      style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#111827' }}
                    >
                      Izmantot pašreizējo atrašanās vietu
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* ── Truck access restrictions ── */}
          {pickedAddress && (
            <View>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Inter_700Bold',
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  marginBottom: 12,
                }}
              >
                Kādi auto var braukt?
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Inter_500Medium',
                  color: '#6b7280',
                  lineHeight: 20,
                  marginBottom: 16,
                }}
              >
                Izslēdziet transportlīdzekļus, kuri nevar piekļūt objektam.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {TRUCK_OPTIONS.map((opt) => {
                  const allowed = truckAccessIds.includes(opt.id);
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => {
                        haptics.light();
                        setTruckAccessIds((prev) =>
                          allowed ? prev.filter((id) => id !== opt.id) : [...prev, opt.id],
                        );
                      }}
                      activeOpacity={0.8}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 999,
                        borderWidth: 1.5,
                        borderColor: allowed ? '#111827' : '#e5e7eb',
                        backgroundColor: allowed ? '#f8fafc' : '#fff',
                      }}
                    >
                      {allowed && <Check size={12} color="#111827" strokeWidth={3} />}
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: allowed ? 'Inter_700Bold' : 'Inter_500Medium',
                          color: allowed ? '#111827' : '#9ca3af',
                        }}
                      >
                        {opt.capacity}t
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Step 5: Unload spot (optional) ─────────────────────────────── */}
      {step === 'unload' && (
        <UnloadSpotStep
          pickedAddress={pickedAddress}
          sitePhotoUri={sitePhotoUri}
          setSitePhotoUri={setSitePhotoUri}
          setSitePhotoUrl={setSitePhotoUrl}
          uploadingPhoto={uploadingPhoto}
          handlePickSitePhoto={handlePickSitePhoto}
          notes={notes}
          onNotesChange={setNotes}
          unloadLat={unloadLat}
          unloadLng={unloadLng}
          onUnloadCoordChange={(lat, lng) => {
            setUnloadLat(lat);
            setUnloadLng(lng);
          }}
        />
      )}

      {/* ── Step 4 (pickup): Field/slot picker ─────────────────────────── */}
      {step === 'field' && (
        <FieldPickerStep
          selectedFieldId={pickupFieldId}
          selectedSlotId={pickupSlotId}
          onFieldChange={setPickupFieldId}
          onSlotChange={setPickupSlotId}
          onPickupDateChange={setPickupDate}
          requestedQty={quantity}
        />
      )}

      {/* ── Step 6: When ───────────────────────────────────────────────── */}
      {step === 'when' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <WhenStep
            deliveryDate={deliveryDate}
            onDateChange={setDeliveryDate}
            deliveryWindow={deliveryWindow}
            onWindowChange={setDeliveryWindow}
          />
        </ScrollView>
      )}

      {/* ── Step 7: Offers ─────────────────────────────────────────────── */}
      {step === 'offers' && (
        <OffersStep
          offers={offers}
          offersLoading={offersLoading}
          offersError={offersError}
          submitted={submitted}
          submitting={submitting}
          submitError={submitError}
          orderNumber={orderNumber}
          orderId={orderId}
          pickedAddress={pickedAddress}
          materialName={materialName}
          quantity={quantity}
          unit={unit}
          truckCount={truckCount}
          truckIntervalMinutes={truckIntervalMinutes}
          deliveryDate={deliveryDate}
          isAuthenticated={!!token}
          bisNumber={bisNumber}
          onBisNumberChange={setBisNumber}
          termsAccepted={termsAccepted}
          onTermsAcceptedChange={setTermsAccepted}
          onSelectOffer={handleSelectOffer}
          onGuestContact={handleGuestSelectOffer}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          prefilledContactName={contactName}
          prefilledContactPhone={contactPhone}
          prefilledContactEmail={user?.email}
          onContactNameChange={setContactName}
          onContactPhoneChange={setContactPhone}
          isGuestSuccess={orderId.startsWith('guest:')}
          guestToken={orderId.startsWith('guest:') ? orderId.slice(6) : undefined}
          onNavigateToOrder={() => {
            if (!orderId) return;
            if (orderId.startsWith('guest:')) {
              router.replace('/(buyer)/home' as never);
              return;
            }
            router.replace(`/(buyer)/order/${orderId}` as never);
          }}
        />
      )}

      {/* Auth gate — shown when a guest taps submit in the offers step */}
      <WizardAuthGate
        visible={authGateVisible}
        onAuthenticated={() => {
          setAuthGateVisible(false);
          if (selectedOffer) {
            handleSelectOffer(selectedOffer);
          }
        }}
        onGuestContact={(info) => {
          setAuthGateVisible(false);
          if (selectedOffer) {
            handleGuestSelectOffer(selectedOffer, info);
          }
        }}
        prefilledName={contactName}
        prefilledPhone={contactPhone}
        prefilledEmail={user?.email}
        onDismiss={() => {
          setAuthGateVisible(false);
        }}
      />
    </WizardLayout>
  );
}
