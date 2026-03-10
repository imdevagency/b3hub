import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ArrowLeft, Package, Truck } from 'lucide-react-native';
import { t } from '../../lib/translations';

const WEB_BASE = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://b3hub.lv';

export default function PartnerScreen() {
  const router = useRouter();

  return (
    <ScreenContainer standalone bg="#fff">
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Nav bar */}
      <View style={s.nav}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={s.title}>{t.partner.title}</Text>
        <Text style={s.subtitle}>{t.partner.subtitle}</Text>

        {/* Seller card */}
        <TouchableOpacity
          style={[s.card, s.sellerCard]}
          activeOpacity={0.85}
          onPress={() => Linking.openURL(WEB_BASE + '/apply?type=seller')}
        >
          <View style={[s.iconWrap, s.sellerIcon]}>
            <Package size={28} color="#374151" />
          </View>
          <Text style={s.cardTitle}>{t.partner.seller.title}</Text>
          <Text style={s.cardDesc}>{t.partner.seller.desc}</Text>
          <View style={[s.ctaRow]}>
            <Text style={[s.cardCta, s.sellerCta]}>{t.partner.seller.cta}</Text>
          </View>
        </TouchableOpacity>

        {/* Carrier card */}
        <TouchableOpacity
          style={[s.card, s.carrierCard]}
          activeOpacity={0.85}
          onPress={() => Linking.openURL(WEB_BASE + '/apply?type=carrier')}
        >
          <View style={[s.iconWrap, s.carrierIcon]}>
            <Truck size={28} color="#374151" />
          </View>
          <Text style={s.cardTitle}>{t.partner.carrier.title}</Text>
          <Text style={s.cardDesc}>{t.partner.carrier.desc}</Text>
          <View style={s.ctaRow}>
            <Text style={[s.cardCta, s.carrierCta]}>{t.partner.carrier.cta}</Text>
          </View>
        </TouchableOpacity>

        {/* Footer note */}
        <Text style={s.note}>{t.partner.note}</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    lineHeight: 22,
    marginBottom: 32,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderTopWidth: 4,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sellerCard: { borderTopColor: '#374151' },
  carrierCard: { borderTopColor: '#374151' },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sellerIcon: { backgroundColor: '#f3f4f6' },
  carrierIcon: { backgroundColor: '#f3f4f6' },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 21,
    marginBottom: 20,
  },
  ctaRow: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 16,
  },
  cardCta: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sellerCta: { color: '#374151' },
  carrierCta: { color: '#374151' },
  note: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    paddingHorizontal: 16,
  },
});
