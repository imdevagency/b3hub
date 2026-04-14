/**
 * (buyer)/field-passes.tsx — Buyer: B3 Fields site access passes
 *
 * Lists all field passes for the buyer's company.
 * Allows creating a new pass via a BottomSheet form.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiFieldPass } from '@/lib/api';
import type { ApiFrameworkContract } from '@/lib/api/company';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';
import {
  Ticket,
  Plus,
  ExternalLink,
  Calendar,
  Truck,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react-native';
import { colors, spacing, radius } from '@/lib/theme';

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
  EXPIRED: { label: 'Beigusies', bg: '#f3f4f6', color: '#9ca3af' },
  REVOKED: { label: 'Atsaukta', bg: '#fef2f2', color: '#ef4444' },
} as const;

// ── Main screen ───────────────────────────────────────────────────────────────

export default function FieldPassesScreen() {
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const [passes, setPasses] = useState<ApiFieldPass[]>([]);
  const [contracts, setContracts] = useState<ApiFrameworkContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [driverName, setDriverName] = useState('');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = useState(
    new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
  );
  const [wasteClassCode, setWasteClassCode] = useState('');
  const [estimatedTonnes, setEstimatedTonnes] = useState('');

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const [ps, cs] = await Promise.all([
          api.fieldPasses.getAll(token),
          api.frameworkContracts.list(token),
        ]);
        setPasses(ps);
        // Only field contracts with active status and available balance
        setContracts(
          cs.filter(
            (c) =>
              (c as ApiFrameworkContract & { isFieldContract?: boolean }).isFieldContract &&
              c.status === 'ACTIVE',
          ),
        );
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

  const handleCreate = async () => {
    if (!token) return;
    if (!selectedContractId) {
      Alert.alert('Kļūda', 'Izvēlieties līgumu');
      return;
    }
    if (!vehiclePlate.trim()) {
      Alert.alert('Kļūda', 'Ievadiet transportlīdzekļa numuru');
      return;
    }
    setCreating(true);
    try {
      await api.fieldPasses.create(
        {
          contractId: selectedContractId,
          vehiclePlate: vehiclePlate.trim(),
          driverName: driverName.trim() || undefined,
          validFrom: new Date(validFrom).toISOString(),
          validTo: new Date(validTo).toISOString(),
          wasteClassCode: wasteClassCode.trim() || undefined,
          estimatedTonnes: estimatedTonnes ? parseFloat(estimatedTonnes) : undefined,
        },
        token,
      );
      haptics.success();
      showToast('Caurlaide izveidota', 'success');
      setShowCreate(false);
      resetForm();
      load(true);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Neizdevās izveidot caurlaidi', 'error');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setSelectedContractId('');
    setVehiclePlate('');
    setDriverName('');
    setValidFrom(new Date().toISOString().slice(0, 10));
    setValidTo(new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10));
    setWasteClassCode('');
    setEstimatedTonnes('');
  };

  const todayPasses = passes.filter(
    (p) => p.status === 'ACTIVE' && isToday(p.validFrom, p.validTo),
  );

  return (
    <ScreenContainer>
      <ScreenHeader
        title="Lauka caurlaides"
        rightAction={
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setShowCreate(true);
            }}
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.md,
              padding: spacing.sm,
            }}
          >
            <Plus size={18} color="#fff" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.base, gap: spacing.base, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
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
                  <Text style={{ fontSize: 12, color: '#6b7280' }}> · {p.driverName}</Text>
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
            subtitle="Izveidojiet pirmo lauka caurlaidi, nospiežot +"
          />
        ) : (
          passes.map((pass) => <PassCard key={pass.id} pass={pass} />)
        )}
      </ScrollView>

      {/* Create pass sheet */}
      <BottomSheet
        visible={showCreate}
        onClose={() => {
          setShowCreate(false);
          resetForm();
        }}
        title="Jauna caurlaide"
      >
        <ScrollView
          style={{ padding: spacing.base }}
          contentContainerStyle={{ gap: spacing.md }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Contract picker */}
          <View style={{ gap: spacing.xs }}>
            <Text variant="muted" size="sm">
              Līgums *
            </Text>
            {contracts.length === 0 ? (
              <View
                style={{
                  backgroundColor: '#fef9c3',
                  borderRadius: radius.md,
                  padding: spacing.md,
                }}
              >
                <Text style={{ fontSize: 13, color: '#92400e' }}>
                  Nav aktīvu lauka līgumu. Vispirms aktivizējiet lauka līgumu.
                </Text>
              </View>
            ) : (
              contracts.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => {
                    haptics.light();
                    setSelectedContractId(c.id);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderColor: selectedContractId === c.id ? colors.primary : colors.border,
                    backgroundColor: selectedContractId === c.id ? '#f0fdf4' : colors.bgCard,
                    padding: spacing.md,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: 'Inter_600SemiBold',
                        fontSize: 14,
                        color: colors.textPrimary,
                      }}
                    >
                      {c.contractNumber}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                      {c.title}
                    </Text>
                  </View>
                  {selectedContractId === c.id && <CheckCircle2 size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Vehicle plate */}
          <View style={{ gap: spacing.xs }}>
            <Text variant="muted" size="sm">
              Auto numurs *
            </Text>
            <TextInput
              value={vehiclePlate}
              onChangeText={(v) => setVehiclePlate(v.toUpperCase())}
              placeholder="AB-1234"
              autoCapitalize="characters"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                fontSize: 15,
                fontFamily: 'Inter_400Regular',
                color: colors.textPrimary,
                backgroundColor: colors.bgCard,
                letterSpacing: 1,
              }}
            />
          </View>

          {/* Driver name */}
          <View style={{ gap: spacing.xs }}>
            <Text variant="muted" size="sm">
              Šofera vārds (nav obligāts)
            </Text>
            <TextInput
              value={driverName}
              onChangeText={setDriverName}
              placeholder="Jānis Bērziņš"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                fontSize: 14,
                fontFamily: 'Inter_400Regular',
                color: colors.textPrimary,
                backgroundColor: colors.bgCard,
              }}
            />
          </View>

          {/* Date range */}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text variant="muted" size="sm">
                Derīgs no *
              </Text>
              <TextInput
                value={validFrom}
                onChangeText={setValidFrom}
                placeholder="YYYY-MM-DD"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  fontSize: 14,
                  fontFamily: 'Inter_400Regular',
                  color: colors.textPrimary,
                  backgroundColor: colors.bgCard,
                }}
              />
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text variant="muted" size="sm">
                Derīgs līdz *
              </Text>
              <TextInput
                value={validTo}
                onChangeText={setValidTo}
                placeholder="YYYY-MM-DD"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  fontSize: 14,
                  fontFamily: 'Inter_400Regular',
                  color: colors.textPrimary,
                  backgroundColor: colors.bgCard,
                }}
              />
            </View>
          </View>

          {/* Waste code */}
          <View style={{ gap: spacing.xs }}>
            <Text variant="muted" size="sm">
              EWC atkritumu kods (nav obligāts)
            </Text>
            <TextInput
              value={wasteClassCode}
              onChangeText={setWasteClassCode}
              placeholder="17 05 04"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                fontSize: 14,
                fontFamily: 'Inter_400Regular',
                color: colors.textPrimary,
                backgroundColor: colors.bgCard,
              }}
            />
          </View>

          {/* Estimated tonnes */}
          <View style={{ gap: spacing.xs }}>
            <Text variant="muted" size="sm">
              Paredzamais svars (t)
            </Text>
            <TextInput
              value={estimatedTonnes}
              onChangeText={setEstimatedTonnes}
              placeholder="12.5"
              keyboardType="decimal-pad"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                fontSize: 14,
                fontFamily: 'Inter_400Regular',
                color: colors.textPrimary,
                backgroundColor: colors.bgCard,
              }}
            />
          </View>

          <Button
            onPress={handleCreate}
            isLoading={creating}
            disabled={creating || !selectedContractId || !vehiclePlate.trim()}
          >
            Izveidot caurlaidi
          </Button>

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </BottomSheet>
    </ScreenContainer>
  );
}

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
          <Text style={{ fontSize: 12, color: '#b91c1c', flex: 1 }}>{pass.revokedReason}</Text>
        </View>
      )}
    </View>
  );
}
