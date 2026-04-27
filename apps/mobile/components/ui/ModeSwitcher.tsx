import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ShoppingCart, Store, Truck, ChevronDown, Check } from 'lucide-react-native';
import { useMode, AppMode, MODE_HOME } from '@/lib/mode-context';
import { t } from '@/lib/translations';
import { colors } from '@/lib/theme';

// ── Mode config ──────────────────────────────────────────────────────────────

const MODE_CONFIG: Record<
  AppMode,
  {
    label: string;
    sub: string;
    iconBg: string;
    iconColor: string;
    pillBg: string;
    pillText: string;
  }
> = {
  BUYER: {
    label: t.mode.BUYER,
    sub: 'Pasūtīt materiālus un konteinerus',
    iconBg: '#fee2e2',
    iconColor: '#111827',
    pillBg: 'rgba(220,38,38,0.10)',
    pillText: '#111827',
  },
  SUPPLIER: {
    label: t.mode.SUPPLIER,
    sub: 'Pārvaldīt pasūtījumus un katalogu',
    iconBg: '#dcfce7',
    iconColor: '#111827',
    pillBg: 'rgba(22,163,74,0.10)',
    pillText: '#15803d',
  },
  CARRIER: {
    label: t.mode.CARRIER,
    sub: 'Transporta darbi un maršruti',
    iconBg: '#fee2e2',
    iconColor: '#111827',
    pillBg: 'rgba(220,38,38,0.10)',
    pillText: '#111827',
  },
};

function ModeIcon({ mode, color, size = 16 }: { mode: AppMode; color: string; size?: number }) {
  if (mode === 'BUYER') return <ShoppingCart size={size} color={color} />;
  if (mode === 'SUPPLIER') return <Store size={size} color={color} />;
  return <Truck size={size} color={color} />;
}

// ── Main component ───────────────────────────────────────────────────────────

export function ModeSwitcher() {
  const { mode, setMode, availableModes } = useMode();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const cfg = MODE_CONFIG[mode];

  function handleSwitch(m: AppMode) {
    setOpen(false);
    if (m === mode) return;
    // Short delay so sheet can close before navigation.
    // Navigate to root '/' — index.tsx watches `mode` and redirects to the
    // correct role home. This avoids "unmatched route" when replacing across
    // different Tab group navigators (buyer ↔ seller ↔ driver).
    setTimeout(() => {
      setMode(m);
      router.replace('/' as any);
    }, 160);
  }

  return (
    <>
      {/* ── Slim bar with single active-mode pill ── */}
      <View style={styles.bar}>
        <TouchableOpacity
          style={[styles.pill, { backgroundColor: cfg.pillBg }]}
          onPress={() => setOpen(true)}
          activeOpacity={0.7}
        >
          <ModeIcon mode={mode} color={cfg.pillText} size={14} />
          <Text style={[styles.pillText, { color: cfg.pillText }]}>{cfg.label}</Text>
          <ChevronDown size={13} color={cfg.pillText} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* ── Bottom sheet modal ── */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        {/* Dim backdrop */}
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

        {/* Sheet */}
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          <Text style={styles.sheetTitle}>Mainīt lomu</Text>
          <Text style={styles.sheetSub}>Izvēlies, kādā lomā strādāt</Text>

          <View style={styles.modeList}>
            {availableModes.map((m) => {
              const c = MODE_CONFIG[m];
              const isActive = m === mode;
              return (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.modeCard,
                    isActive && { borderColor: c.iconColor, backgroundColor: c.iconBg + '40' },
                  ]}
                  onPress={() => handleSwitch(m)}
                  activeOpacity={0.75}
                >
                  {/* Icon */}
                  <View style={[styles.modeIcon, { backgroundColor: c.iconBg }]}>
                    <ModeIcon mode={m} color={c.iconColor} size={22} />
                  </View>

                  {/* Text */}
                  <View style={styles.modeCardBody}>
                    <Text style={styles.modeCardLabel}>{c.label}</Text>
                    <Text style={styles.modeCardSub}>{c.sub}</Text>
                  </View>

                  {/* Active check */}
                  {isActive && (
                    <View style={[styles.activeCheck, { backgroundColor: c.iconBg }]}>
                      <Check size={14} color={c.iconColor} strokeWidth={2.5} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Trigger bar ──
  bar: {
    backgroundColor: colors.bgCard,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Backdrop ──
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // ── Sheet ──
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sheetSub: {
    fontSize: 14,
    color: colors.textDisabled,
    marginBottom: 20,
  },

  // ── Mode cards ──
  modeList: { gap: 10 },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.bgSubtle,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#f3f4f6',
  },
  modeIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeCardBody: { flex: 1, gap: 3 },
  modeCardLabel: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  modeCardSub: { fontSize: 13, color: colors.textMuted },
  activeCheck: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
