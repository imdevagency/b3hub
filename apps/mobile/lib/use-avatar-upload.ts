/**
 * useAvatarUpload — pick an image from the library and upload it.
 *
 * Handles:
 *  - requestMediaLibraryPermissionsAsync
 *  - launchImageLibraryAsync (images only, cropped square)
 *  - base64 conversion
 *  - API call (uploadAvatar or uploadLogo)
 *  - local state update via callback
 *
 * Returns:
 *  - pick()     — triggers the picker + upload flow
 *  - uploading  — true while the upload is in flight
 */

import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { useAuth } from './auth-context';
import { api } from './api';

interface UseAvatarUploadOptions {
  /** 'user' uploads to /auth/me/avatar; 'company' uploads to /company/me/logo */
  type: 'user' | 'company';
  /** Called with the new URL when the upload completes successfully. */
  onSuccess?: (url: string) => void;
}

export function useAvatarUpload({ type, onSuccess }: UseAvatarUploadOptions) {
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);

  const pick = useCallback(async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert('Atļauja nepieciešama', 'Lūdzu, atļaujiet piekļuvi foto bibliotēkai iestatījumos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (!asset.base64) return;

    const mimeType = asset.mimeType ?? 'image/jpeg';

    if (!token) return;

    try {
      setUploading(true);
      if (type === 'user') {
        const res = await api.uploadAvatar(token, asset.base64, mimeType);
        onSuccess?.(res.avatarUrl);
      } else {
        const res = await api.uploadLogo(token, asset.base64, mimeType);
        onSuccess?.(res.logoUrl);
      }
    } catch {
      Alert.alert('Kļūda', 'Neizdevās augšupielādēt attēlu. Lūdzu, mēģiniet vēlreiz.');
    } finally {
      setUploading(false);
    }
  }, [token, type, onSuccess]);

  return { pick, uploading };
}
