import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Search, X, MapPin, Navigation2 } from 'lucide-react-native';
import type { GeocodeSuggestion } from '@/components/map';
import { t } from '@/lib/translations';
import { colors } from '@/lib/theme';

export interface Step1Props {
  floating?: boolean;
  searchText: string;
  onSearchChange: (v: string) => void;
  loadingSug: boolean;
  suggestions: GeocodeSuggestion[];
  confirmedAddress: string;
  onPickSuggestion: (s: GeocodeSuggestion) => void;
  onUseMyLocation: () => void;
  onClearSearch: () => void;
}

export function Step1Location({
  floating,
  searchText,
  onSearchChange,
  loadingSug,
  suggestions,
  confirmedAddress,
  onPickSuggestion,
  onUseMyLocation,
  onClearSearch,
}: Step1Props) {
  return (
    <View style={{ flex: 1 }}>
      {/* Unified white card: search + GPS + suggestions */}
      <View style={floating ? s1.cardShadow : s1.cardShadowInline}>
        <View style={s1.card}>
          {/* Search row */}
          <View style={s1.cardSearchRow}>
            <Search size={15} color="#9ca3af" />
            <TextInput
              style={s1.searchInput}
              placeholder={t.skipHire.step1.placeholder}
              placeholderTextColor="#9ca3af"
              value={searchText}
              onChangeText={onSearchChange}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              autoFocus={floating}
            />
            {loadingSug ? (
              <ActivityIndicator size="small" color="#9ca3af" />
            ) : searchText.length > 0 ? (
              <TouchableOpacity
                onPress={onClearSearch}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={15} color="#9ca3af" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Divider */}
          <View style={s1.cardDivider} />

          {/* GPS row — always first */}
          <TouchableOpacity style={s1.suggRow} onPress={onUseMyLocation} activeOpacity={0.75}>
            <View style={s1.myLocIcon}>
              <Navigation2 size={14} color="#2563eb" />
            </View>
            <Text style={[s1.suggText, { fontWeight: '600', color: '#2563eb' }]}>
              Izmantot manu atrašanās vietu
            </Text>
          </TouchableOpacity>

          {/* Typed suggestions */}
          {suggestions.map((item) => (
            <React.Fragment key={item.id}>
              <View style={s1.cardDivider} />
              <TouchableOpacity
                style={s1.suggRow}
                onPress={() => onPickSuggestion(item)}
                activeOpacity={0.7}
              >
                <View style={s1.suggDotCol}>
                  <View style={s1.suggDot} />
                </View>
                <Text style={s1.suggText} numberOfLines={2}>
                  {item.place_name}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* Confirmed address chip */}
      {confirmedAddress ? (
        <View style={s1.confirmedRow}>
          <MapPin size={13} color="#059669" />
          <Text style={s1.confirmedText} numberOfLines={2}>
            {confirmedAddress}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s1 = StyleSheet.create({
  // Shadow wrapper (floating over map)
  cardShadow: {
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
    }),
  },
  // Shadow wrapper (inside sheet — lighter shadow)
  cardShadowInline: {
    borderRadius: 14,
    backgroundColor: '#fff',
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  cardSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.bgMuted,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.textPrimary, padding: 0 },
  myLocIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  suggRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  suggDotCol: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  suggText: { flex: 1, fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  confirmedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
  },
  confirmedText: { flex: 1, fontSize: 13, color: colors.success, lineHeight: 18 },
});
