import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { t } from '@/lib/translations';
import { HardHat, Trash2, Truck } from 'lucide-react-native';
import type React from 'react';

type LucideIcon = React.ComponentType<{ size?: number; color?: string }>;

interface ServiceTile {
  icon: LucideIcon;
  title: string;
  desc: string;
  bg: string;
  iconBg: string;
  iconColor: string;
}

const SERVICES: ServiceTile[] = [
  {
    icon: HardHat,
    title: t.welcome.services.materials.title,
    desc: t.welcome.services.materials.desc,
    bg: '#fff7ed',
    iconBg: '#fed7aa',
    iconColor: '#c2410c',
  },
  {
    icon: Trash2,
    title: t.welcome.services.container.title,
    desc: t.welcome.services.container.desc,
    bg: '#f0fdf4',
    iconBg: '#bbf7d0',
    iconColor: '#15803d',
  },
  {
    icon: Truck,
    title: t.welcome.services.freight.title,
    desc: t.welcome.services.freight.desc,
    bg: '#eff6ff',
    iconBg: '#bfdbfe',
    iconColor: '#1d4ed8',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>B3</Text>
          </View>
          <Text style={styles.title}>{t.welcome.title}</Text>
          <Text style={styles.subtitle}>{t.welcome.subtitle}</Text>
        </View>

        {/* Service tiles */}
        <View style={styles.tilesWrap}>
          {/* Top row — Materials + Container */}
          <View style={styles.tilesRow}>
            {SERVICES.slice(0, 2).map((s) => {
              const Icon = s.icon;
              return (
                <View key={s.title} style={[styles.tile, { backgroundColor: s.bg }]}>
                  <View style={[styles.tileIcon, { backgroundColor: s.iconBg }]}>
                    <Icon size={20} color={s.iconColor} />
                  </View>
                  <Text style={styles.tileTitle}>{s.title}</Text>
                  <Text style={styles.tileDesc}>{s.desc}</Text>
                </View>
              );
            })}
          </View>
          {/* Full-width — Freight */}
          {(() => {
            const s = SERVICES[2];
            const Icon = s.icon;
            return (
              <View style={[styles.tileFull, { backgroundColor: s.bg }]}>
                <View style={[styles.tileIcon, { backgroundColor: s.iconBg }]}>
                  <Icon size={20} color={s.iconColor} />
                </View>
                <View style={styles.tileFullText}>
                  <Text style={styles.tileTitle}>{s.title}</Text>
                  <Text style={styles.tileDesc}>{s.desc}</Text>
                </View>
              </View>
            );
          })()}
        </View>

        {/* CTA buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.primaryBtnText}>{t.welcome.getStarted}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.secondaryBtnText}>{t.welcome.signIn}</Text>
          </TouchableOpacity>
        </View>

        {/* Become a partner */}
        <TouchableOpacity
          style={styles.partnerWrap}
          activeOpacity={0.7}
          onPress={() => router.push('/(auth)/partner')}
        >
          <Text style={styles.partnerLabel}>{t.welcome.becomePartner}</Text>
          <Text style={styles.partnerCta}>{t.welcome.partnerCta}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
    gap: 28,
  },
  logoWrap: { alignItems: 'center' },
  logoBox: {
    width: 72,
    height: 72,
    backgroundColor: '#dc2626',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  title: { fontSize: 26, fontWeight: '700', color: '#111827', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },

  tilesWrap: { gap: 10 },
  tilesRow: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    minHeight: 110,
    justifyContent: 'center',
  },
  tileFull: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  tileFullText: { flex: 1 },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  tileDesc: { fontSize: 11, color: '#6b7280', marginTop: 2, lineHeight: 15 },

  buttons: { gap: 10 },
  primaryBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  secondaryBtnText: { color: '#374151', fontWeight: '600', fontSize: 16 },

  partnerWrap: { alignItems: 'center', paddingBottom: 4 },
  partnerLabel: { fontSize: 13, color: '#9ca3af' },
  partnerCta: { fontSize: 13, color: '#dc2626', fontWeight: '600', marginTop: 3 },
});
