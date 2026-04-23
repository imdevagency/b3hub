/**
 * material-order.tsx
 *
 * Buyer material order wizard — matches web CATALOGUE → SPECS → WHERE → WHEN → OFFERS/RFQ flow.
 *
 *  Step 1 – WHERE  : delivery address picker
 *  Step 2 – SPECS  : material type, fraction, order type, quantity, notes, photo
 *  Step 3 – WHEN   : preferred delivery date + time window
 *  Step 4 – OFFERS : instant supplier offers → buyer picks one; OR no offers → send RFQ
 *
 * State and submit handlers live here. Step UI lives in components/wizard/material/.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Alert, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api/common';
import { UNIT_SHORT, CATEGORY_LABELS, DEFAULT_MATERIAL_NAMES } from '@/lib/materials';
import type { MaterialCategory, MaterialUnit } from '@/lib/materials';
import type { SupplierOffer } from '@/lib/api';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { FlatAddressPicker } from '@/components/wizard/FlatAddressPicker';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { SpecsStep } from '@/components/wizard/material/SpecsStep';
import { WhenStep } from '@/components/wizard/material/WhenStep';
import { OffersStep } from '@/components/wizard/material/OffersStep';
import {
  CATEGORY_FRACTIONS,
  CATEGORY_DEFAULT_UNIT,
  ORDER_TYPE_UNIT_MAP,
  TRUCK_OPTIONS,
  type OrderType,
} from '@/components/wizard/material/_constants';

const DRAFT_KEY = '@b3hub_wizard_draft';

type Step = 'specs' | 'address' | 'when' | 'offers';
type SubmitResult = 'order' | 'rfq';

const STEPS: Step[] = ['specs', 'address', 'when', 'offers'];

const STEP_TITLES: Record<Step, string> = {
  address: 'Kur piegādāt?',
  specs: 'Ko pasūtīt?',
  when: 'Kad piegādāt?',
  offers: 'Piedāvājumi',
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
  const params = useLocalSearchParams<{
    initialCategory?: string;
    prefillMaterial?: string;
    prefillAddress?: string;
    prefillCity?: string;
    projectId?: string;
    resumeDraft?: string;
    prefilledQty?: string;
    schedule?: string;
  }>();

  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory>(
    (params.initialCategory as MaterialCategory) || 'GRAVEL',
  );
  const category = selectedCategory;

  // ── Step ──
  const [step, setStep] = useState<Step>('specs');
  const stepIndex = STEPS.indexOf(step);

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
  const [sitePhotoUri, setSitePhotoUri] = useState<string | null>(null);
  const [sitePhotoUrl, setSitePhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [selectedFraction, setSelectedFraction] = useState<string>(
    () => CATEGORY_FRACTIONS[(params.initialCategory as MaterialCategory) || 'GRAVEL'][0],
  );
  const [orderType, setOrderType] = useState<OrderType>('BY_WEIGHT');
  const [selectedTruckId] = useState<string>(TRUCK_OPTIONS[0].id);

  // ── Address ──
  const [pickedAddress, setPickedAddress] = useState<PickedAddress | null>(null);

  // ── When ──
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryWindow, setDeliveryWindow] = useState<'ANY' | 'AM' | 'PM'>('ANY');
  const [truckCount] = useState(1);
  const [truckIntervalMinutes] = useState(60);
  const [repeatEnabled] = useState(() => params.schedule === '1');
  const [repeatInterval] = useState<7 | 14 | 30>(7);

  // ── Offers ──
  const [offers, setOffers] = useState<SupplierOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState<SubmitResult | null>(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderId, setOrderId] = useState('');
  const [rfqNumber, setRfqNumber] = useState('');
  const [rfqId, setRfqId] = useState('');

  // ── Contact ──
  const [contactName] = useState(() => `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim());
  const [contactPhone] = useState(() => user?.phone ?? '');

  // ── Draft: restore ──
  const draftLoadedRef = useRef(false);
  useEffect(() => {
    if (params.resumeDraft !== 'true') {
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
          setStep(d.step || 'specs');
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
        ? `${CATEGORY_LABELS[selectedCategory]} ${selectedFraction}`
        : CATEGORY_LABELS[selectedCategory];
    setMaterialName(name);
  }, [selectedCategory, selectedFraction]);

  // ── Sync unit from order type ──
  useEffect(() => {
    setUnit(ORDER_TYPE_UNIT_MAP[orderType]);
  }, [orderType]);

  // ── Load offers when entering the offers step ──
  useEffect(() => {
    if (step !== 'offers' || !token || !pickedAddress) return;
    setOffersLoading(true);
    setOffersError('');
    setOffers([]);
    api.materials
      .getOffers(
        { category: selectedCategory, quantity, lat: pickedAddress.lat, lng: pickedAddress.lng },
        token,
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
      if (submitted === 'order' && orderId) {
        router.replace(`/(buyer)/order/${orderId}` as never);
      } else {
        router.replace('/(buyer)/orders' as never);
      }
      return;
    }
    if (stepIndex === 0) {
      const hasDraft = notes.trim() !== '' || pickedAddress !== null;
      if (hasDraft) {
        Alert.alert('Iziet no pasūtīšanas?', 'Ievadītie dati tiks zaudēti.', [
          { text: 'Turpināt', style: 'cancel' },
          {
            text: 'Iziet',
            style: 'destructive',
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
  }, [stepIndex, router, submitted, notes, pickedAddress, orderId]);

  const goNext = useCallback(() => {
    if (stepIndex < STEPS.length - 1) {
      haptics.medium();
      setStep(STEPS[stepIndex + 1]);
    }
  }, [stepIndex]);

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
    if (!asset.base64 || !token) return;
    setUploadingPhoto(true);
    try {
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const { url } = await api.orders.uploadSitePhoto(asset.base64, mimeType, token);
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
    if (!token || !pickedAddress) return;
    if (offer.minOrder && quantity < offer.minOrder) {
      setSubmitError(
        `Minimālais pasūtījuma daudzums šim piegādātājam ir ${offer.minOrder} ${UNIT_SHORT[unit] ?? unit}`,
      );
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const order = await api.materials.createOrder(
        {
          buyerId: user!.id,
          materialId: offer.id,
          quantity,
          unit,
          unitPrice: offer.basePrice,
          deliveryAddress: pickedAddress.address,
          deliveryCity: pickedAddress.city,
          deliveryDate: deliveryDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
          deliveryWindow: deliveryWindow !== 'ANY' ? deliveryWindow : undefined,
          deliveryFee: offer.deliveryFee ?? undefined,
          deliveryLat: pickedAddress.lat,
          deliveryLng: pickedAddress.lng,
          siteContactName: contactName || undefined,
          siteContactPhone: contactPhone || undefined,
          notes: notes || undefined,
          sitePhotoUrl: sitePhotoUrl || undefined,
          projectId: params.projectId || undefined,
          truckCount,
          truckIntervalMinutes: truckCount > 1 ? truckIntervalMinutes : undefined,
        },
        token,
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
            siteContactName: contactName || undefined,
            siteContactPhone: contactPhone || undefined,
            projectId: params.projectId || undefined,
            items: [{ materialId: offer.id, quantity, unit }],
            intervalDays: repeatInterval,
            nextRunAt: firstRun,
          },
          token,
        );
      }

      setOrderNumber(order.orderNumber);
      setOrderId(order.id);
      setSubmitted('order');
      haptics.success();
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
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
    }
  };

  // ── Submit: send RFQ ──
  const handleSendRFQ = async () => {
    if (!token || !pickedAddress) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await api.quoteRequests.create(
        {
          materialCategory: category,
          materialName,
          quantity,
          unit,
          deliveryAddress: pickedAddress.address,
          deliveryCity: pickedAddress.city,
          deliveryLat: pickedAddress.lat,
          deliveryLng: pickedAddress.lng,
          notes: notes || undefined,
        },
        token,
      );
      setRfqNumber(result.requestNumber);
      setRfqId(result.id);
      setSubmitted('rfq');
      haptics.success();
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kaut kas nogāja greizi.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── CTA ──
  const canProceed =
    step === 'address'
      ? !!pickedAddress
      : step === 'specs'
        ? quantity > 0
        : step === 'when'
          ? true
          : !offersLoading && !submitting && !submitted;

  const ctaLabel = submitted
    ? submitted === 'rfq'
      ? 'Skatīt pieprasījumu'
      : 'Apmaksāt pasūtījumu'
    : step === 'offers'
      ? 'Nosūtīt pieprasījumu'
      : 'Turpināt';

  const handleCTA = submitted
    ? submitted === 'rfq'
      ? () => router.replace(`/(buyer)/rfq/${rfqId}` as never)
      : () => router.replace(`/(buyer)/order/${orderId}` as never)
    : step === 'offers'
      ? handleSendRFQ
      : goNext;

  const unitLabel =
    orderType === 'BY_VOLUME' ? 'm³' : orderType === 'BY_LOAD' ? 'kravas' : 'tonnas';

  return (
    <WizardLayout
      title={
        submitted === 'order'
          ? 'Pasūtījums veikts!'
          : submitted === 'rfq'
            ? 'Pieprasījums nosūtīts!'
            : STEP_TITLES[step]
      }
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
      footerLeft={
        step === 'specs' ? (
          <View>
            <Text
              style={{ fontSize: 13, color: colors.textDisabled, fontFamily: 'Inter_500Medium' }}
            >
              Pasūtījuma apjoms
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: colors.textPrimary,
                fontFamily: 'Inter_600SemiBold',
                marginTop: 2,
              }}
            >
              {quantity.toFixed(2)} {unitLabel}
            </Text>
          </View>
        ) : undefined
      }
    >
      {step === 'address' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <FlatAddressPicker picked={pickedAddress} onPick={(p) => setPickedAddress(p)} />
        </ScrollView>
      )}
      {step === 'specs' && (
        <SpecsStep
          category={selectedCategory}
          onCategoryChange={setSelectedCategory}
          selectedFraction={selectedFraction}
          onFractionChange={setSelectedFraction}
          orderType={orderType}
          onOrderTypeChange={setOrderType}
          quantity={quantity}
          onQuantityChange={setQuantity}
          notes={notes}
          onNotesChange={setNotes}
          sitePhotoUri={sitePhotoUri}
          setSitePhotoUri={setSitePhotoUri}
          setSitePhotoUrl={setSitePhotoUrl}
          uploadingPhoto={uploadingPhoto}
          handlePickSitePhoto={handlePickSitePhoto}
        />
      )}
      {step === 'when' && (
        <WhenStep
          deliveryDate={deliveryDate}
          onDateChange={setDeliveryDate}
          deliveryWindow={deliveryWindow}
          onWindowChange={setDeliveryWindow}
        />
      )}
      {step === 'offers' && (
        <OffersStep
          offers={offers}
          offersLoading={offersLoading}
          offersError={offersError}
          submitted={submitted}
          submitting={submitting}
          submitError={submitError}
          orderNumber={orderNumber}
          rfqNumber={rfqNumber}
          orderId={orderId}
          pickedAddress={pickedAddress}
          materialName={materialName}
          quantity={quantity}
          unit={unit}
          truckCount={truckCount}
          truckIntervalMinutes={truckIntervalMinutes}
          deliveryDate={deliveryDate}
          onSelectOffer={handleSelectOffer}
          onSendRFQ={handleSendRFQ}
          onNavigateToOrder={() => {
            if (orderId) router.replace(`/(buyer)/order/${orderId}` as never);
          }}
          onNavigateToRFQ={() => {
            if (rfqId) router.replace(`/(buyer)/rfq/${rfqId}` as never);
          }}
        />
      )}
    </WizardLayout>
  );
}
