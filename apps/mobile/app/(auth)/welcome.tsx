import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/text';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Package, MapPin, FileText } from 'lucide-react-native';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScreenContainer standalone bg="#000" topInset={0}>
      <StatusBar style="light" />

      {/* Main Content Area */}
      <View
        className="flex-1 px-base pb-2xl justify-between"
        style={{ paddingTop: insets.top + 80 }}
      >
        {/* Top: Logo / Branding */}
        <View>
          <View className="w-16 h-16 bg-white rounded-xl items-center justify-center mb-xl">
            <Text
              className="text-3xl text-black"
              style={{ fontFamily: 'Inter_700Bold', fontWeight: '700' }}
            >
              B3
            </Text>
          </View>

          <Text
            className="text-4xl text-white mb-md"
            style={{ fontFamily: 'Inter_800ExtraBold', fontWeight: '800' }}
          >
            Būvē ātrāk.
          </Text>
          <Text
            className="text-xl text-text-disabled"
            style={{ fontFamily: 'Inter_500Medium', fontWeight: '500' }}
          >
            Viss tavai būvei.{'\n'}Materiāli un transports vienā lietotnē.
          </Text>

          {/* Feature bullets */}
          <View style={styles.featureList}>
            {(
              [
                { Icon: Package, text: 'Materiāli, transports, konteineri — vienā vietā' },
                { Icon: MapPin, text: 'GPS izsekošana reāllaikā' },
                { Icon: FileText, text: 'Dokumenti automātiski — bez papīriem' },
              ] as const
            ).map(({ Icon, text }) => (
              <View key={text} style={styles.featureRow}>
                <Icon size={18} color="#6b7280" strokeWidth={1.5} />
                <Text style={styles.featureText}>{text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom: Action Area */}
        <View className="w-full gap-y-base" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
          <TouchableOpacity
            className="w-full h-14 bg-white rounded-xl items-center justify-center flex-row"
            activeOpacity={0.8}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text
              className="text-lg text-black"
              style={{ fontFamily: 'Inter_700Bold', fontWeight: '700' }}
            >
              Sākt
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="w-full h-14 items-center justify-center"
            activeOpacity={0.8}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text className="text-lg text-text-disabled">
              Jau ir konts?{' '}
              <Text
                className="text-white underline"
                style={{ fontFamily: 'Inter_700Bold', fontWeight: '700' }}
              >
                Pierakstīties
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  featureList: {
    marginTop: 36,
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
    flex: 1,
    lineHeight: 22,
  },
});
