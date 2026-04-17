import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/text';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptics } from '@/lib/haptics';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScreenContainer standalone bg="#000" topInset={0}>
      <StatusBar style="light" />

      <View className="flex-1 justify-between" style={{ paddingTop: insets.top + 20 }}>
        {/* Top half: Logo */}
        <View className="px-6 pt-10">
          <Text
            className="text-white text-3xl tracking-tighter"
            style={{ fontFamily: 'Inter_800ExtraBold', fontWeight: '800' }}
          >
            B3
          </Text>
        </View>

        {/* Bottom half: Value prop & actions */}
        <View className="px-6 pb-8" style={{ paddingBottom: Math.max(insets.bottom + 16, 40) }}>
          <Text
            className="text-white tracking-tight mb-4"
            style={{
              fontSize: 56,
              lineHeight: 60,
              fontFamily: 'Inter_800ExtraBold',
              fontWeight: '800',
            }}
          >
            Būvē{'\n'}ātrāk.
          </Text>

          <Text
            className="text-gray-400 text-lg leading-relaxed mb-10"
            style={{ fontFamily: 'Inter_500Medium', fontWeight: '500' }}
          >
            Materiāli, transports un atkritumi{'\n'}vienā viegli lietojamā lietotnē.
          </Text>

          <View className="gap-y-4">
            <TouchableOpacity
              className="w-full h-14 bg-white rounded-full items-center justify-center flex-row"
              activeOpacity={0.9}
              onPress={() => {
                haptics.light();
                router.push('/(auth)/register');
              }}
            >
              <Text
                className="text-black text-lg"
                style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600' }}
              >
                Sākt
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="w-full h-14 items-center justify-center"
              activeOpacity={0.8}
              onPress={() => {
                haptics.light();
                router.push('/(auth)/login');
              }}
            >
              <Text
                className="text-gray-400 text-base"
                style={{ fontFamily: 'Inter_500Medium', fontWeight: '500' }}
              >
                Jau ir konts?{' '}
                <Text
                  className="text-white"
                  style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600' }}
                >
                  Pierakstīties
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
