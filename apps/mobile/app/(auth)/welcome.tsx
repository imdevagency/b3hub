import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/text';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptics } from '@/lib/haptics';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScreenContainer standalone bg="#FFFFFF" topInset={0}>
      <StatusBar style="dark" />

      <View
        className="flex-1 justify-end bg-white"
        style={{ paddingTop: insets.top + 40, paddingBottom: Math.max(insets.bottom + 16, 40) }}
      >
        <View className="px-6 pb-2 items-center w-full">
          <Text
            className="text-center tracking-tight mb-4"
            style={{
              color: '#111827',
              fontSize: 32,
              lineHeight: 40,
              fontFamily: 'Inter_800ExtraBold',
              fontWeight: '800',
            }}
          >
            Būvē{'\n'}ātrāk. Jebkur.
          </Text>

          <Text
            className="text-center text-base leading-relaxed mb-10 px-4"
            style={{ color: '#6B7280', fontFamily: 'Inter_400Regular', fontWeight: '400' }}
          >
            Materiāli, transports un atkritumi vienā viegli lietojamā lietotnē.
          </Text>

          <View className="gap-y-4 w-full">
            <TouchableOpacity
              className="w-full h-14 bg-black rounded-full items-center justify-center flex-row"
              activeOpacity={0.9}
              onPress={() => {
                haptics.light();
                router.push('/(auth)/register');
              }}
            >
              <Text
                className="text-white text-lg"
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
                className="text-base"
                style={{ color: '#111827', fontFamily: 'Inter_500Medium', fontWeight: '500' }}
              >
                Pierakstīties
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="w-full h-10 items-center justify-center"
              activeOpacity={0.7}
              onPress={() => {
                haptics.light();
                router.replace('/(buyer)/home' as never);
              }}
            >
              <Text
                className="text-sm"
                style={{ color: '#9CA3AF', fontFamily: 'Inter_400Regular', fontWeight: '400' }}
              >
                Turpināt bez konta
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
