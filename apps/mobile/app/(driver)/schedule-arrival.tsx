/**
 * Driver arrival scheduling screen.
 * After accepting a job, driver sets their planned arrival time.
 * Buyer receives a notification with the ±90min window.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, ChevronUp, ChevronDown } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';

function padZ(n: number) {
  return String(n).padStart(2, '0');
}

function formatWindow(hour: number, minute: number) {
  const baseMs = hour * 3600000 + minute * 60000;
  const startMs = baseMs - 90 * 60000;
  const endMs = baseMs + 90 * 60000;

  const toHHMM = (ms: number) => {
    const totalMin = Math.round(ms / 60000);
    const h = Math.floor((((totalMin % 1440) + 1440) % 1440) / 60);
    const m = ((totalMin % 60) + 60) % 60;
    return `${padZ(h)}:${padZ(m)}`;
  };

  return `${toHHMM(startMs)} – ${toHHMM(endMs)}`;
}

export default function ScheduleArrivalScreen() {
  const { jobId, pickupDate } = useLocalSearchParams<{ jobId: string; pickupDate: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const defaultHour = pickupDate ? new Date(pickupDate).getHours() : 9;

  const [hour, setHour] = useState(defaultHour > 0 ? defaultHour : 9);
  const [minute, setMinute] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const displayDate = pickupDate
    ? new Date(pickupDate).toLocaleDateString('lv-LV', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : '—';

  const windowLabel = formatWindow(hour, minute);

  const handleConfirm = async () => {
    if (!jobId || !token) return;
    haptics.medium();
    setSubmitting(true);

    // Build ISO timestamp using pickupDate's date + selected hour/minute
    let plannedDate: Date;
    if (pickupDate) {
      plannedDate = new Date(pickupDate);
      plannedDate.setHours(hour, minute, 0, 0);
    } else {
      plannedDate = new Date();
      plannedDate.setHours(hour, minute, 0, 0);
    }

    try {
      await api.transportJobs.scheduleArrival(
        jobId,
        { plannedArrivalAt: plannedDate.toISOString() },
        token,
      );
      haptics.success();
      router.replace('/(driver)/active');
    } catch {
      haptics.error();
      Alert.alert('Kļūda', 'Neizdevās saglabāt laiku. Mēģini vēlreiz.');
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    haptics.light();
    router.replace('/(driver)/active');
  };

  return (
    <ScreenContainer bg="white">
      <ScreenHeader title="Plānotais ierašanās laiks" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Date display */}
        <View style={styles.datePill}>
          <Clock size={16} color="#6b7280" />
          <Text style={styles.dateText}>{displayDate}</Text>
        </View>

        {/* Description */}
        <Text style={styles.description}>
          Norādiet plānoto ierašanās laiku. Klients saņems paziņojumu ar ±90 minūšu logu.
        </Text>

        {/* Time stepper */}
        <View style={styles.timeRow}>
          {/* Hours */}
          <View style={styles.stepperWrap}>
            <Text style={styles.stepperLabel}>Stundas</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => {
                haptics.light();
                setHour((h) => (h + 1) % 24);
              }}
              activeOpacity={0.8}
            >
              <ChevronUp size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.stepValue}>{padZ(hour)}</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => {
                haptics.light();
                setHour((h) => (h - 1 + 24) % 24);
              }}
              activeOpacity={0.8}
            >
              <ChevronDown size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          <Text style={styles.colon}>:</Text>

          {/* Minutes */}
          <View style={styles.stepperWrap}>
            <Text style={styles.stepperLabel}>Minūtes</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => {
                haptics.light();
                setMinute((m) => (m + 15) % 60);
              }}
              activeOpacity={0.8}
            >
              <ChevronUp size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.stepValue}>{padZ(minute)}</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => {
                haptics.light();
                setMinute((m) => (m - 15 + 60) % 60);
              }}
              activeOpacity={0.8}
            >
              <ChevronDown size={22} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Window preview */}
        <View style={styles.windowCard}>
          <Text style={styles.windowCardLabel}>Klients saņems paziņojumu</Text>
          <Text style={styles.windowCardTime}>{windowLabel}</Text>
          <Text style={styles.windowCardSub}>±90 min logs</Text>
        </View>

        {/* CTA */}
        <Button
          variant="default"
          size="lg"
          className="w-full"
          onPress={handleConfirm}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator size="small" color="#fff" /> : 'Apstiprināt laiku'}
        </Button>

        {/* Skip link */}
        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} activeOpacity={0.7}>
          <Text style={styles.skipText}>Izlaist</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    gap: 20,
    paddingBottom: 48,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  dateText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#374151',
    textTransform: 'capitalize',
  },
  description: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
    lineHeight: 21,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 8,
  },
  colon: {
    fontSize: 40,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    lineHeight: 100,
    marginTop: 20,
  },
  stepperWrap: {
    alignItems: 'center',
    gap: 4,
  },
  stepperLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  stepBtn: {
    width: 56,
    height: 40,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    fontSize: 52,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    lineHeight: 64,
    width: 80,
    textAlign: 'center',
  },
  windowCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 4,
  },
  windowCardLabel: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  windowCardTime: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    letterSpacing: -0.5,
  },
  windowCardSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#9ca3af',
  },
});
