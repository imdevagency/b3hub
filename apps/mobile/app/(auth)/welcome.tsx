import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { StatusBar } from 'expo-status-bar';

const { width: W } = Dimensions.get('window');

// ── Slides ─────────────────────────────────────────────────────
interface Slide {
  key: string;
  emoji: string;
  circleBg: string;
  tag: string;
  title: string;
  subtitle: string;
}

const SLIDES: Slide[] = [
  {
    key: 'materials',
    emoji: '🪨',
    circleBg: '#fed7aa',
    tag: 'MATERIĀLI',
    title: 'Celtniecības materiāli\npiegādāti uz objektu',
    subtitle:
      'Smiltis, grants, šķembas un desmitiem citu materiālu — pasūti ar dažiem pieskārieniem.',
  },
  {
    key: 'container',
    emoji: '🗑️',
    circleBg: '#bbf7d0',
    tag: 'KONTEINERS',
    title: 'Iznomā konteineru\njebkurai vajadzībai',
    subtitle: 'Atkritumi, drupatas, gružu izvešana — piegāde un savākšana iekļauta cenā.',
  },
  {
    key: 'freight',
    emoji: '🚚',
    circleBg: '#bfdbfe',
    tag: 'PĀRVADĀJUMI',
    title: 'Uzticami kravas\npārvadājumi ar GPS',
    subtitle:
      'Reāllaika izsekošana, automātisks svara protokols un atgriešanās braucienu plānošana.',
  },
];

// ── Dot indicator ──────────────────────────────────────────────
function Dots({ active, count }: { active: number; count: number }) {
  return (
    <View style={s.dotsRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[s.dot, i === active ? s.dotActive : s.dotInactive]} />
      ))}
    </View>
  );
}

// ── Slide card ─────────────────────────────────────────────────
function SlideCard({ item }: { item: Slide }) {
  return (
    <View style={s.slide}>
      {/* Illustration */}
      <View style={s.illustrationWrap}>
        <View style={[s.circle, { backgroundColor: item.circleBg }]}>
          <Text style={s.emoji}>{item.emoji}</Text>
        </View>
        {/* Decorative rings */}
        <View style={[s.ring, s.ring1, { borderColor: item.circleBg }]} />
        <View style={[s.ring, s.ring2, { borderColor: item.circleBg }]} />
      </View>

      {/* Text */}
      <View style={s.textBlock}>
        <View style={s.tagPill}>
          <Text style={s.tagText}>{item.tag}</Text>
        </View>
        <Text style={s.slideTitle}>{item.title}</Text>
        <Text style={s.slideSubtitle}>{item.subtitle}</Text>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────
export default function WelcomeScreen() {
  const router = useRouter();
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: false,
  });

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / W);
    setActiveIdx(idx);
  };

  const goNext = () => {
    if (activeIdx < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: activeIdx + 1, animated: true });
      setActiveIdx(activeIdx + 1);
    } else {
      router.push('/(auth)/register');
    }
  };

  const isLast = activeIdx === SLIDES.length - 1;

  return (
    <ScreenContainer standalone bg="#fff">
      <StatusBar style="dark" />

      {/* Skip button */}
      {!isLast && (
        <TouchableOpacity
          style={s.skipBtn}
          onPress={() => router.push('/(auth)/register')}
          activeOpacity={0.7}
        >
          <Text style={s.skipText}>Izlaist</Text>
        </TouchableOpacity>
      )}

      {/* Logo badge */}
      <View style={s.logoBadge}>
        <View style={s.logoBox}>
          <Text style={s.logoText}>B3</Text>
        </View>
        <Text style={s.logoLabel}>B3Hub</Text>
      </View>

      {/* Carousel */}
      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item }) => <SlideCard item={item} />}
        style={s.list}
      />

      {/* Footer */}
      <View style={s.footer}>
        <Dots active={activeIdx} count={SLIDES.length} />

        <TouchableOpacity style={s.primaryBtn} activeOpacity={0.85} onPress={goNext}>
          <Text style={s.primaryBtnText}>{isLast ? 'Sākt — tas ir bezmaksas' : 'Tālāk'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.secondaryBtn}
          activeOpacity={0.8}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={s.secondaryBtnText}>
            Jau ir konts? <Text style={s.secondaryBtnLink}>Pierakstīties</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.partnerRow}
          activeOpacity={0.7}
          onPress={() => router.push('/(auth)/partner')}
        >
          <Text style={s.partnerText}>Kļūt par partneri →</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  skipBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  skipText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },

  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 4,
  },
  logoBox: {
    width: 36,
    height: 36,
    backgroundColor: '#dc2626',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  logoLabel: { fontSize: 17, fontWeight: '700', color: '#111827' },

  list: { flex: 1 },

  slide: {
    width: W,
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 0,
  },
  illustrationWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  circle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  emoji: { fontSize: 72 },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.5,
    opacity: 0.4,
  },
  ring1: { width: 230, height: 230 },
  ring2: { width: 290, height: 290, opacity: 0.2 },

  textBlock: { paddingBottom: 20, gap: 10 },
  tagPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagText: { fontSize: 11, fontWeight: '700', color: '#6b7280', letterSpacing: 0.8 },
  slideTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 36,
  },
  slideSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    lineHeight: 22,
  },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 8,
    gap: 10,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dot: { height: 6, borderRadius: 999 },
  dotActive: { width: 24, backgroundColor: '#dc2626' },
  dotInactive: { width: 6, backgroundColor: '#e5e7eb' },

  primaryBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  secondaryBtn: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  secondaryBtnText: { color: '#6b7280', fontWeight: '500', fontSize: 15 },
  secondaryBtnLink: { color: '#dc2626', fontWeight: '700' },

  partnerRow: { alignItems: 'center', paddingTop: 2 },
  partnerText: { fontSize: 13, color: '#9ca3af', fontWeight: '500' },
});
