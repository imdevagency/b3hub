import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOrder } from '@/lib/order-context';
import { t } from '@/lib/translations';

function formatDisplay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('lv-LV', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function OrderConfirmation() {
  const router = useRouter();
  const { state, reset } = useOrder();
  const order = state.confirmedOrder;

  if (!order) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.centerText}>Nav pasūtījuma.</Text>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/home')} style={s.centerLink}>
            <Text style={s.centerLinkText}>Atpakaļ uz sākumu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const wasteInfo = t.skipHire.step2.types[order.wasteCategory];
  const sizeInfo = t.skipHire.step3.sizes[order.skipSize];
  const wasteLabel = wasteInfo?.label ?? order.wasteCategory;
  const sizeLabel = sizeInfo ? `${sizeInfo.label} (${sizeInfo.volume})` : order.skipSize;

  const details = [
    { label: t.skipHire.confirmation.location, value: order.location },
    { label: t.skipHire.confirmation.size, value: sizeLabel },
    { label: t.skipHire.confirmation.wasteType, value: wasteLabel },
    { label: t.skipHire.confirmation.deliveryDate, value: formatDisplay(order.deliveryDate) },
    { label: t.skipHire.confirmation.price, value: `€${order.price} ${order.currency}` },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {/* Success icon */}
        <View style={s.iconWrap}>
          <Text style={s.successIcon}>🎉</Text>
        </View>

        <Text style={s.title}>{t.skipHire.confirmation.title}</Text>
        <Text style={s.subtitle}>{t.skipHire.confirmation.subtitle}</Text>

        {/* Order number highlight card */}
        <View style={s.orderNumCard}>
          <Text style={s.orderNumLabel}>{t.skipHire.confirmation.orderNumber}</Text>
          <Text style={s.orderNum}>{order.orderNumber}</Text>
        </View>

        {/* Order details */}
        <View style={s.detailsCard}>
          {details.map((row, i) => (
            <View key={i} style={[s.detailRow, i < details.length - 1 && s.detailRowBorder]}>
              <Text style={s.detailLabel}>{row.label}</Text>
              <Text style={s.detailValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Status badge */}
        <View style={s.statusBadge}>
          <View style={s.statusDot} />
          <Text style={s.statusText}>{order.status}</Text>
        </View>

        {/* CTA buttons */}
        <TouchableOpacity
          style={s.primaryBtn}
          onPress={() => {
            reset();
            router.replace('/(tabs)/home');
          }}
          activeOpacity={0.8}
        >
          <Text style={s.primaryBtnText}>{t.skipHire.confirmation.backHome}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.secondaryBtn}
          onPress={() => {
            reset();
            router.replace('/order');
          }}
          activeOpacity={0.8}
        >
          <Text style={s.secondaryBtnText}>{t.skipHire.confirmation.newOrder}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  centerText: { fontSize: 16, color: '#6b7280' },
  centerLink: { paddingVertical: 8 },
  centerLinkText: { color: '#dc2626', fontWeight: '600' },
  body: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 40 },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  successIcon: { fontSize: 44 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 28,
  },
  orderNumCard: {
    backgroundColor: '#dc2626',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    marginBottom: 20,
  },
  orderNumLabel: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  orderNum: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: 1.5 },
  detailsCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  detailLabel: { fontSize: 14, color: '#6b7280' },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    maxWidth: '55%',
    textAlign: 'right',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    backgroundColor: '#ecfdf5',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 32,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  statusText: { color: '#10b981', fontWeight: '600', fontSize: 13 },
  primaryBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  secondaryBtnText: { color: '#374151', fontSize: 16, fontWeight: '600' },
});
