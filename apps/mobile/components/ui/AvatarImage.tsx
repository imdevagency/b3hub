/**
 * AvatarImage — Displays a user or company avatar.
 *
 * Shows a photo if a URL is provided, otherwise falls back to initials.
 * When `onPress` is provided, wraps in a TouchableOpacity and shows a
 * camera-badge overlay so the user knows they can tap to change the photo.
 *
 * Usage (read-only):
 *   <AvatarImage url={user.avatar} initials="AB" size={56} />
 *
 * Usage (upload-enabled):
 *   <AvatarImage url={user.avatar} initials="AB" size={72} onPress={handlePickImage} />
 */

import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AvatarImageProps {
  /** Remote URL for the photo. If undefined/null, shows initials fallback. */
  url?: string | null;
  /** 1–2 character initials shown when no photo is available. */
  initials: string;
  /** Diameter in logical pixels. Defaults to 48. */
  size?: number;
  /** Background colour for the initials fallback circle. Defaults to light grey. */
  fallbackBg?: string;
  /** Text colour for the initials. Defaults to dark grey (readable on light fallback). */
  fallbackColor?: string;
  /** Called when user taps the avatar. Enables the camera-badge overlay. */
  onPress?: () => void;
  /** Show a spinner overlay (e.g. while upload is in progress). */
  loading?: boolean;
}

export function AvatarImage({
  url,
  initials,
  size = 48,
  fallbackBg = '#e5e7eb',
  fallbackColor = '#374151',
  onPress,
  loading = false,
}: AvatarImageProps) {
  const radius = size / 2;
  const fontSize = Math.round(size * 0.36);
  const badgeSize = Math.round(size * 0.33);

  const inner = (
    // Outer wrapper has no overflow:hidden so the camera badge can sit outside the circle
    <View style={{ width: size, height: size }}>
      {/* Circle: overflow:hidden masks the image/initials into a circle */}
      <View style={[styles.circle, { width: size, height: size, borderRadius: radius }]}>
        {url ? (
          <Image
            source={{ uri: url }}
            style={{ width: size, height: size, borderRadius: radius }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.fallback,
              { width: size, height: size, borderRadius: radius, backgroundColor: fallbackBg },
            ]}
          >
            <Text style={[styles.initials, { fontSize, color: fallbackColor }]}>
              {initials.toUpperCase()}
            </Text>
          </View>
        )}

        {loading && (
          <View style={[styles.overlay, { borderRadius: radius }]}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
      </View>

      {/* Badge lives outside the overflow:hidden circle — no more clipping */}
      {onPress && !loading && (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              bottom: 0,
              right: 0,
            },
          ]}
        >
          <Ionicons name="camera" size={Math.round(badgeSize * 0.55)} color="#fff" />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        {inner}
      </TouchableOpacity>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  circle: {
    overflow: 'hidden',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    // color is applied inline via fallbackColor prop
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    backgroundColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
});
