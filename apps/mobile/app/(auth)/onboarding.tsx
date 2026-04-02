import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Dimensions, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { haptics } from '@/lib/haptics';
import {
  ShoppingCart,
  MapPin,
  FileText,
  Package,
  CheckCircle,
  Banknote,
  Truck,
  Navigation,
  CircleDot,
} from 'lucide-react-native';

export const ONBOARDING_KEY = 'b3hub_onboarding_v1';

const { width: SCREEN_W } = Dimensions.get('window');

type Slide = {
  key: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  title: string;
  subtitle: string;
  accent: string;
};

const BUYER_SLIDES: Slide[] = [
  {
    key: 'b1',
    Icon: ShoppingCart,
    title: 'Pasūtini materiālus',
    subtitle:
      'Izvēlies granulas, smiltis vai citus būvmateriālus un piesakies piegādei dažos klikšķos.',
    accent: '#00A878',
  },
  {
    key: 'b2',
    Icon: MapPin,
    title: 'Seko piegādei reāllaikā',
    subtitle: 'Mājas apstāk las transportu kartē — zini tieši, kur atrodas tava krava.',
    accent: '#3B82F6',
  },
  {
    key: 'b3',
    Icon: FileText,
    title: 'Dokumenti automātiski',
    subtitle: 'Pēc piegādes saņem pavadzīmi un rēķinu automātiski — bez papīriem.',
    accent: '#8B5CF6',
  },
];

const SELLER_SLIDES: Slide[] = [
  {
    key: 's1',
    Icon: Package,
    title: 'Publicē savus materiālus',
    subtitle: 'Pievieno produktus katalogam — cenas, daudzumus un piegādes zonas vienuviet.',
    accent: '#00A878',
  },
  {
    key: 's2',
    Icon: CheckCircle,
    title: 'Apstiprina pasūtījumus',
    subtitle: 'Saņem paziņojumus un apstiprina ienākošos pasūtījumus vienā skārienā.',
    accent: '#F59E0B',
  },
  {
    key: 's3',
    Icon: Banknote,
    title: 'Saņem maksājumus',
    subtitle: 'Maksājumi tiek automātiski pārskaitīti uz tavu kontu pēc piegādes apstiprināšanas.',
    accent: '#10B981',
  },
];

const DRIVER_SLIDES: Slide[] = [
  {
    key: 'd1',
    Icon: Truck,
    title: 'Pieņem darbus',
    subtitle: 'Redzi pieejamos transporta uzdevumus un izvēlies tos, kas tev der.',
    accent: '#00A878',
  },
  {
    key: 'd2',
    Icon: Navigation,
    title: 'Naviguē uz adresi',
    subtitle: 'Katra darba adrese tieši navigācijā — bez papildus soļiem.',
    accent: '#3B82F6',
  },
  {
    key: 'd3',
    Icon: CircleDot,
    title: 'Apstiprina piegādi',
    subtitle:
      'Nofotografē kravas nodošanu un atzīmē darbu kā izpildītu — maksājums tiek apstrādāts automātiski.',
    accent: '#10B981',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const flatRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const slides: Slide[] =
    user?.canTransport && !user?.canSell
      ? DRIVER_SLIDES
      : user?.canSell && !user?.canTransport
        ? SELLER_SLIDES
        : BUYER_SLIDES;

  const finish = async () => {
    haptics.success();
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/');
  };

  const next = () => {
    haptics.light();
    if (activeIndex < slides.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
      setActiveIndex(activeIndex + 1);
    } else {
      finish();
    }
  };

  const isLast = activeIndex === slides.length - 1;

  return (
    <ScreenContainer standalone bg="#fff" style={{ alignItems: 'center' }}>
      {/* Skip */}
      <TouchableOpacity style={s.skipBtn} onPress={finish} activeOpacity={0.7}>
        <Text style={s.skipText}>Izlaist</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={slides}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          setActiveIndex(idx);
        }}
        renderItem={({ item }) => (
          <View style={[s.slide, { width: SCREEN_W }]}>
            <View style={[s.iconWrap, { backgroundColor: item.accent + '1A' }]}>
              <item.Icon size={56} color={item.accent} />
            </View>
            <Text style={s.slideTitle}>{item.title}</Text>
            <Text style={s.slideSub}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Dot indicators */}
      <View style={s.dots}>
        {slides.map((_, i) => (
          <View key={i} style={[s.dot, activeIndex === i && s.dotActive]} />
        ))}
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[s.cta, { marginBottom: insets.bottom + 24 }]}
        onPress={next}
        activeOpacity={0.85}
      >
        <Text style={s.ctaText}>{isLast ? 'Sākt!' : 'Nākamais →'}</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  skipBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  slideTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  slideSub: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#00A878',
  },
  cta: {
    width: SCREEN_W - 48,
    backgroundColor: '#00A878',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#fff',
  },
});
