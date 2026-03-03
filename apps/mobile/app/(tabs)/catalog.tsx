import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CatalogScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.center}>
        <Text style={styles.emoji}>📦</Text>
        <Text style={styles.title}>Katalogs</Text>
        <Text style={styles.desc}>Materiālu kataloga pārvaldība</Text>
        <View style={styles.comingSoon}>
          <Text style={styles.comingSoonText}>🚧 Drīzumā pieejams</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emoji: { fontSize: 56 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  desc: { fontSize: 15, color: '#6b7280', textAlign: 'center' },
  comingSoon: {
    marginTop: 8,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  comingSoonText: { color: '#d97706', fontWeight: '600', fontSize: 14 },
});
