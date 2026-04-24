/**
 * (buyer)/field-passes.tsx — Buyer: B3 Fields site access passes
 *
 * Read-only list. Passes (QR codes) are shown so drivers can present them at
 * the gate. Creating/revoking a pass is a back-office task — use b3hub.lv.
 */
import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, Linking } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiFieldPass } from '@/lib/api';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/text';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';
import {
  Ticket,
  ExternalLink,
  Calendar,
  Truck,
  User,
  FileText,
  CheckCircle2,
  XCircle,
} from 'lucide-react-native';
import { colors, spacing, radius } from '@/lib/theme';

const WEB_PASSES_URL = 'https://b3hub.lv/dashboard/field-passes';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function isToday(from: string, to: string) {
  const now = new Date();
  return new Date(from) <= now && new Date(to) >= now;
}

const STATUS_CFG = {
  ACTIVE: { label: 'Aktīva', bg: '#ecfdf5', color: '#10b981' },
  EXPIRED: { label: 'Beigusies', bg: '#f3f4f6', color: colors.textDisabled },
  REVOKED: { label: 'Atsaukta', bg: '#fef2f2', color: '#ef4444' },
} as const;

// ── Pass card ─────────────────────────────────────────────────────────────────

function PassCard({ pass }: { pass: ApiFieldPass }) {
  const cfg = STATUS_CFG[pass.status] ?? STATUS_CFG.EXPIRED;
  const active = pass.status === 'ACTIVE' && isToday(pass.validFrom, pass.validTo);
  const { showToast } = useToast();

  const handleOpenPdf = () => {
    if (!pass.fileUrl) {
      showToast('PDF vēl netiek gatavots', 'info');
      return;
    }
    Linking.openURL(pass.fileUrl).catch(() => showToast('Neizdevās atvērt PDF', 'error'));
  };

  return (
    <View
      style={{
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: active ? '#a7f3d0' : colors.border,
        padding: spacing.base,
        gap: spacing.sm,
      }}
    >
      {/* Top row */}
      <View
        style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.textPrimary }}>
            {pass.vehiclePlate}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>{pass.passNumber}</Text>
        </View>
        <StatusPill label={cfg.label} bg={cfg.bg} color={cfg.color} />
      </View>

      {/* Details */}
      <View style={{ gap: spacing.xs }}>
        {pass.driverName && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <User size={12} color={colors.textMuted} />
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>{pass.driverName}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Calendar size={12} color={colors.textMuted} />
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>
            {fmtDate(pass.validFrom)} – {fmtDate(pass.validTo)}
          </Text>
        </View>
        {pass.estimatedTonnes && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Truck size={12} color={colors.textMuted} />
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              {pass.estimatedTonnes} t paredzēts
              {pass.actualNetTonnes ? ` · ${pass.actualNetTonnes} t reāls` : ''}
            </Text>
          </View>
        )}
        {pass.wasteClassCode && (
          <Text style={{ fontSize: 12, color: colors.textMuted }}>EWC {pass.wasteClassCode}</Text>
        )}
      </View>

      {/* PDF button */}
      <TouchableOpacity
        onPress={handleOpenPdf}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          alignSelf: 'flex-start',
        }}
        activeOpacity={0.7}
      >
        <FileText size={13} color={colors.primary} />
        <Text style={{ fontSize: 13, color: colors.primary, fontFamily: 'Inter_500Medium' }}>
          {pass.fileUrl ? 'Atvērt PDF' : 'PDF gatavošanā...'}
        </Text>
        {pass.fileUrl && <ExternalLink size={11} color={colors.primary} />}
      </TouchableOpacity>

      {/* Revoked reason */}
      {pass.status === 'REVOKED' && pass.revokedReason && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            backgroundColor: '#fef2f2',
            borderRadius: radius.sm,
            padding: spacing.sm,
          }}
        >
          <XCircle size={12} color="#ef4444" />
          <Text style={{ fontSize: 12, color: colors.dangerText, flex: 1 }}>
            {pass.revokedReason}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function FieldPassesScreen() {
  const { token, user } = useAuth();
  const _router = useRouter();
  React.useEffect(() => {
    if (user && !user.isCompany) _router.replace('/(buyer)/profile');
  }, [user, _router]);
  if (user && !user.isCompany) return null;
  const { showToast } = useToast();

  const [passes, setPasses] = useState<ApiFieldPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const ps = await api.fieldPasses.getAll(token);
        setPasses(ps);
      } catch {
        if (!silent) showToast('Neizdevās ielādēt caurlaides', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, showToast],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleRefresh = () => {
    haptics.light();
    setRefreshing(true);
    load(true);
  };

  const todayPasses = passes.filter(
    (p) => p.status === 'ACTIVE' && isToday(p.validFrom, p.validTo),
  );

  return (
    <ScreenContainer>
      <ScreenHeader title="Lauka caurlaides" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.base, gap: spacing.base, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Web CTA */}
        <TouchableOpacity
          style={{
            backgroundColor: '#eff6ff',
            borderRadius: radius.lg,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: '#bfdbfe',
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
          activeOpacity={0.8}
          onPress={() => Linking.openURL(WEB_PASSES_URL)}
        >
          <ExternalLink size={16} color="#2563eb" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1d4ed8' }}>
              Pārvaldīt caurlaides — b3hub.lv
            </Text>
            <Text style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>
              Izveidot, atsaukt un apskatīt visas caurlaides
            </Text>
          </View>
        </TouchableOpacity>

        {/* Today strip */}
        {todayPasses.length > 0 && (
          <View
            style={{
              backgroundColor: '#ecfdf5',
              borderRadius: radius.lg,
              padding: spacing.md,
              gap: spacing.sm,
              borderWidth: 1,
              borderColor: '#a7f3d0',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <CheckCircle2 size={16} color="#10b981" />
              <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#065f46', fontSize: 13 }}>
                Šodien klātesošs — {todayPasses.length} auto
              </Text>
            </View>
            {todayPasses.map((p) => (
              <View
                key={p.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
              >
                <Truck size={13} color="#10b981" />
                <Text style={{ fontSize: 13, color: '#047857', fontFamily: 'Inter_500Medium' }}>
                  {p.vehiclePlate}
                </Text>
                {p.driverName ? (
                  <Text style={{ fontSize: 12, color: colors.textMuted }}> · {p.driverName}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* List */}
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : passes.length === 0 ? (
          <EmptyState
            icon={<Ticket size={40} color={colors.textMuted} />}
            title="Nav caurlaiž"
            subtitle="Izveidojiet caurlaides b3hub.lv portālā"
          />
        ) : (
          passes.map((pass) => <PassCard key={pass.id} pass={pass} />)
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
