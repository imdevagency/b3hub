import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const FEATURES = [
  { emoji: '🏗️', title: 'Materials', desc: 'Browse & order construction materials' },
  { emoji: '📦', title: 'Containers', desc: 'Track containers and deliveries' },
  { emoji: '♻️', title: 'Recycling', desc: 'Manage waste sustainably' },
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
          <Text style={styles.title}>Welcome to B3Hub</Text>
          <Text style={styles.subtitle}>
            Your all-in-one platform for construction materials, orders, and logistics.
          </Text>
        </View>

        {/* Feature cards */}
        <View style={styles.featureCard}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureEmoji}>{f.emoji}</Text>
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.primaryBtnText}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.secondaryBtnText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logoBox: {
    width: 80,
    height: 80,
    backgroundColor: '#dc2626',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '700', color: '#111827', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#6b7280', textAlign: 'center', marginTop: 10, lineHeight: 22 },
  featureCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 20,
    padding: 24,
    gap: 16,
    marginBottom: 32,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureEmoji: { fontSize: 22 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  featureDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  buttons: { gap: 12 },
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
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  secondaryBtnText: { color: '#374151', fontWeight: '600', fontSize: 16 },
});
