import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useLanguage, type Lang } from '@/lib/language-context';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: 'lv', label: 'Latviešu', native: 'Latviešu' },
  { code: 'ru', label: 'Krievu', native: 'Русский' },
];

export default function LanguageScreen() {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();

  const handleSelect = (lang: Lang) => {
    if (lang !== language) {
      haptics.light();
      setLanguage(lang);
    }
    router.back();
  };

  return (
    <ScreenContainer standalone>
      <ScreenHeader title="Valoda / Язык" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <View style={s.card}>
          {LANGUAGES.map((item, i) => {
            const selected = language === item.code;
            const last = i === LANGUAGES.length - 1;
            return (
              <React.Fragment key={item.code}>
                <TouchableOpacity
                  style={s.row}
                  activeOpacity={0.7}
                  onPress={() => handleSelect(item.code)}
                >
                  <View style={s.rowBody}>
                    <Text style={s.rowLabel}>{item.native}</Text>
                    {item.native !== item.label && <Text style={s.rowSub}>{item.label}</Text>}
                  </View>
                  {selected && <Check size={20} color={colors.primary} strokeWidth={2.5} />}
                </TouchableOpacity>
                {!last && <View style={s.divider} />}
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  content: {
    padding: 16,
    paddingTop: 12,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
  },
  rowSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 16,
  },
});
