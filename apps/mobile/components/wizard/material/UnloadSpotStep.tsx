/**
 * UnloadSpotStep — Step 5 of the material order wizard (optional).
 *
 * Buyer describes the precise unloading location:
 *   - Map pin fine-tuner (defaults to delivery address coords)
 *   - Site photo (existing picker logic wired via props)
 *   - Access notes / instructions for the driver
 *
 * This step is optional — the wizard always shows a "Izlaist" (skip) button.
 * The WizardLayout footer's skip is handled in the wizard root.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Camera, X, MapPin, FileText, Navigation } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { BaseMap } from '@/components/map/BaseMap';
import { PinLayer } from '@/components/map/layers/PinLayer';
import { AddressPicker } from '@/components/ui/AddressPicker';

export type UnloadSpotStepProps = {
  pickedAddress: PickedAddress | null;
  sitePhotoUri: string | null;
  setSitePhotoUri: (uri: string | null) => void;
  setSitePhotoUrl: (url: string | null) => void;
  uploadingPhoto: boolean;
  handlePickSitePhoto: () => void;
  notes: string;
  onNotesChange: (n: string) => void;
  unloadLat?: number | null;
  unloadLng?: number | null;
  onUnloadCoordChange?: (lat: number, lng: number) => void;
};

export function UnloadSpotStep({
  pickedAddress,
  sitePhotoUri,
  setSitePhotoUri,
  setSitePhotoUrl,
  uploadingPhoto,
  handlePickSitePhoto,
  notes,
  onNotesChange,
  unloadLat,
  unloadLng,
  onUnloadCoordChange,
}: UnloadSpotStepProps) {
  const [pinPickerOpen, setPinPickerOpen] = useState(false);

  const pinLat = unloadLat ?? pickedAddress?.lat ?? null;
  const pinLng = unloadLng ?? pickedAddress?.lng ?? null;
  const pinSet = unloadLat != null && unloadLng != null;

  return (
    <>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Instruction */}
        <Text
          style={{
            fontSize: 15,
            fontFamily: 'Inter_500Medium',
            color: '#6b7280',
            lineHeight: 22,
            marginBottom: 28,
          }}
        >
          Norādiet, kur precīzi izkraut materiālu. Jo precīzāk, jo labāk — šoferim nav jāzvanīs!
        </Text>

        {/* Delivery address context */}
        {pickedAddress && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#f9fafb',
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: '#f0f0f0',
              padding: 16,
              marginBottom: 16,
              gap: 12,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#e5e7eb',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MapPin size={16} color="#374151" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Inter_700Bold',
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginBottom: 2,
                }}
              >
                Piegādes adrese
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Inter_600SemiBold',
                  color: '#374151',
                }}
                numberOfLines={2}
              >
                {pickedAddress.address}
              </Text>
            </View>
          </View>
        )}

        {/* ── Map pin picker ── */}
        {pinLat !== null && pinLng !== null && (
          <View style={{ marginBottom: 20 }}>
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Inter_700Bold',
                color: '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                marginBottom: 10,
              }}
            >
              Precīzā izkraušanas vieta
            </Text>
            <View
              style={{
                height: 160,
                borderRadius: 16,
                overflow: 'hidden',
                borderWidth: 1.5,
                borderColor: pinSet ? '#111827' : '#e5e7eb',
                marginBottom: 10,
              }}
            >
              <BaseMap style={{ flex: 1 }} center={[pinLng, pinLat]} zoom={16}>
                <PinLayer
                  id="unload-pin"
                  coordinate={{ lat: pinLat, lng: pinLng }}
                  type="uber-destination"
                />
              </BaseMap>
            </View>
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                setPinPickerOpen(true);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pinSet ? '#111827' : '#f3f4f6',
                borderRadius: 12,
                paddingVertical: 12,
                gap: 8,
              }}
              activeOpacity={0.8}
            >
              <Navigation size={16} color={pinSet ? '#fff' : '#374151'} />
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Inter_600SemiBold',
                  color: pinSet ? '#fff' : '#374151',
                }}
              >
                {pinSet ? 'Mainīt precīzo atrašanās vietu' : 'Norādīt precīzu vietu kartē'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Site photo */}
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
          Izkraušanas vietas foto
        </Text>

        {sitePhotoUri ? (
          <View style={{ position: 'relative', marginBottom: 24 }}>
            <Image
              source={{ uri: sitePhotoUri }}
              style={{
                width: '100%',
                height: 200,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: '#f0f0f0',
              }}
              resizeMode="cover"
            />
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                setSitePhotoUri(null);
                setSitePhotoUrl(null);
              }}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                backgroundColor: 'rgba(17, 24, 39, 0.8)',
                borderRadius: 20,
                width: 36,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.8}
            >
              <X size={18} color="#fff" />
            </TouchableOpacity>
            {/* Change photo button */}
            <TouchableOpacity
              onPress={handlePickSitePhoto}
              style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                backgroundColor: 'rgba(17, 24, 39, 0.75)',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
              activeOpacity={0.8}
            >
              <Camera size={14} color="#fff" />
              <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>
                Mainīt foto
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handlePickSitePhoto}
            disabled={uploadingPhoto}
            activeOpacity={0.8}
            style={{
              borderWidth: 1.5,
              borderColor: '#e5e7eb',
              borderStyle: 'dashed',
              borderRadius: 16,
              backgroundColor: '#f9fafb',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 130,
              paddingVertical: 24,
              marginBottom: 24,
            }}
          >
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color="#111827" />
            ) : (
              <>
                <Camera size={28} color="#6b7280" />
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: 'Inter_600SemiBold',
                    color: '#374151',
                    marginTop: 12,
                  }}
                >
                  Pievienot foto
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Inter_400Regular',
                    color: '#9ca3af',
                    marginTop: 4,
                  }}
                >
                  Palīdzēs šoferim precīzi atrast vietu
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Access notes */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 12,
          }}
        >
          <FileText size={14} color="#9ca3af" />
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Inter_700Bold',
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: 0.8,
            }}
          >
            Piezīmes šoferim
          </Text>
        </View>

        <TextInput
          placeholder="piem. Iebraukt pa labo ieeju, noskandināt, nogaidīt sargam..."
          placeholderTextColor="#9ca3af"
          value={notes}
          onChangeText={onNotesChange}
          multiline
          style={{
            borderWidth: 1.5,
            borderColor: '#e5e7eb',
            borderRadius: 16,
            paddingHorizontal: 18,
            paddingVertical: 16,
            fontSize: 15,
            color: '#111827',
            fontFamily: 'Inter_500Medium',
            backgroundColor: '#fff',
            minHeight: 110,
            textAlignVertical: 'top',
          }}
        />
      </ScrollView>
      {pinPickerOpen && (
        <AddressPicker
          visible={pinPickerOpen}
          title="Precīzā izkraušanas vieta"
          initialAddress={pickedAddress?.address}
          initialLat={pinLat ?? undefined}
          initialLng={pinLng ?? undefined}
          pinColor="#111827"
          onConfirm={(loc) => {
            onUnloadCoordChange?.(loc.lat, loc.lng);
            setPinPickerOpen(false);
          }}
          onClose={() => setPinPickerOpen(false)}
        />
      )}
    </>
  );
}
