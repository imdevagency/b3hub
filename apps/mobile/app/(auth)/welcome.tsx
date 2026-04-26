import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/text';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptics } from '@/lib/haptics';
import { Phone } from 'lucide-react-native';

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

          <View className="gap-y-3 w-full">
            {/* Primary: Phone OTP */}
            <TouchableOpacity
              style={s.phonePrimaryBtn}
              activeOpacity={0.9}
              onPress={() => {
                haptics.light();
                router.push('/(auth)/phone-otp');
              }}
            >
              <Phone size={20} color="#fff" />
              <Text style={s.phonePrimaryBtnText}>Turpināt ar tālruņa numuru</Text>
            </TouchableOpacity>

            {/* Secondary: Email register */}
            <TouchableOpacity
              style={s.outlineBtn}
              activeOpacity={0.85}
              onPress={() => {
                haptics.light();
                router.push('/(auth)/register');
              }}
            >
              <Text style={s.outlineBtnText}>Reģistrēties ar e-pastu</Text>
            </TouchableOpacity>

            {/* Tertiary: login */}
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

            {/* Guest */}
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

const s = StyleSheet.create({
  phonePrimaryBtn: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  phonePrimaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  outlineBtn: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});
