/**
 * (buyer)/framework-contract/[id].tsx
 *
 * Buyer: framework contract detail — positions with progress and call-off release.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import {
  api,
  type ApiFrameworkContract,
  type ApiFrameworkPosition,
  type FrameworkContractStatus,
  type CreateCallOffInput,
} from '@/lib/api';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { formatDate, formatDateShort } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/button';
import { DetailRow } from '@/components/ui/DetailRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { InfoSection } from '@/components/ui/InfoSection';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { StatusPill } from '@/components/ui/StatusPill';
import { Text } from '@/components/ui/text';
import { Calendar, Clock, Package, Send, Trash2, TrendingUp, Truck } from 'lucide-react-native';

const CONTRACT_STATUS: Record<
  FrameworkContractStatus,
  { label: string; bg: string; color: string }
> = {
  DRAFT: { label: 'Melnraksts', bg: '#fef3c7', color: '#92400e' },
  ACTIVE: { label: 'Aktīvs', bg: '#dcfce7', color: '#15803d' },
  COMPLETED: { label: 'Pabeigts', bg: '#f0f9ff', color: '#0369a1' },
  EXPIRED: { label: 'Beidzies', bg: '#f3f4f6', color: '#6b7280' },
  CANCELLED: { label: 'Atcelts', bg: '#fef2f2', color: '#b91c1c' },
};

const POSITION_TYPE_LABEL: Record<
  string,
  { label: string; icon: React.ComponentType<{ size?: number; color?: string }> }
> = {
  MATERIAL_DELIVERY: { label: 'Materiālu piegāde', icon: Package },
  WASTE_DISPOSAL: { label: 'Atkritumu izvešana', icon: Trash2 },
  FREIGHT_TRANSPORT: { label: 'Kravas pārvadāšana', icon: Truck },
};

const CALLOFF_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Pieejams',
  ASSIGNED: 'Piešķirts',
  ACCEPTED: 'Apstiprināts',
  EN_ROUTE_PICKUP: 'Brauc uz iekraušanu',
  AT_PICKUP: 'Pie iekraušanas',
  LOADED: 'Iekrauts',
  EN_ROUTE_DELIVERY: 'Brauc uz piegādi',
  AT_DELIVERY: 'Pie piegādes',
  DELIVERED: 'Piegādāts',
  CANCELLED: 'Atcelts',
};

function ProgressBar({ pct, complete = false }: { pct: number; complete?: boolean }) {
  return (
    <View style={s.progTrack}>
      <View
        style={[
          s.progFill,
          complete && s.progFillDone,
          { width: `${Math.min(100, pct)}%` as const },
        ]}
      />
    </View>
  );
}

function PositionSection({
  position,
  canRelease,
  onRelease,
}: {
  position: ApiFrameworkPosition;
  canRelease: boolean;
  onRelease: (position: ApiFrameworkPosition) => void;
}) {
  const typeMeta = POSITION_TYPE_LABEL[position.positionType] ?? {
    label: position.positionType,
    icon: Package,
  };
  const PosIcon = typeMeta.icon;
  const posPct = Math.min(100, position.progressPct);
  const callOffCount = position.callOffs?.length ?? 0;

  return (
    <InfoSection
      icon={<PosIcon size={14} color="#6b7280" />}
      title={typeMeta.label}
      right={
        <Text size="sm" style={s.sectionRightText}>
          {posPct.toFixed(0)}%
        </Text>
      }
    >
      <View style={s.sectionBlock}>
        <Text style={s.positionTitle}>{position.description}</Text>

        <View style={s.progressBlock}>
          <View style={s.progRow}>
            <Text variant="muted" size="sm">
              {position.consumedQty.toFixed(1)} / {position.agreedQty.toFixed(1)} {position.unit}
            </Text>
            <Text size="sm" style={s.progressValue}>
              {posPct.toFixed(0)}%
            </Text>
          </View>
          <ProgressBar pct={posPct} complete={posPct >= 100} />
          <Text variant="muted" size="sm" style={s.progressMeta}>
            Atlikušie: {position.remainingQty.toFixed(1)} {position.unit}
            {position.unitPrice != null
              ? ` · €${position.unitPrice.toFixed(2)}/${position.unit}`
              : ''}
          </Text>
        </View>

        <DetailRow
          label="Maršruts"
          value={
            position.pickupCity && position.deliveryCity
              ? `${position.pickupCity} → ${position.deliveryCity}`
              : (position.pickupCity ?? position.deliveryCity ?? null)
          }
        />
        <DetailRow label="Darba uzdevumi" value={String(callOffCount)} last={callOffCount === 0} />

        {callOffCount > 0 ? (
          <View style={s.callOffList}>
            {(position.callOffs ?? []).slice(0, 3).map((callOff, index, items) => (
              <View
                key={callOff.id}
                style={[s.callOffRow, index < items.length - 1 && s.callOffRowBorder]}
              >
                <View style={s.callOffCopy}>
                  <Text size="sm" style={s.callOffNumber}>
                    {callOff.jobNumber}
                  </Text>
                  <Text variant="muted" size="sm">
                    {CALLOFF_STATUS_LABEL[callOff.status] ?? callOff.status}
                  </Text>
                </View>
                {callOff.cargoWeight != null ? (
                  <Text variant="muted" size="sm">
                    {(callOff.cargoWeight / 1000).toFixed(1)} t
                  </Text>
                ) : null}
              </View>
            ))}
            {callOffCount > 3 ? (
              <Text variant="muted" size="sm" style={s.moreCallOffs}>
                +{callOffCount - 3} vairāk
              </Text>
            ) : null}
          </View>
        ) : null}

        {canRelease && position.remainingQty > 0 ? (
          <Button variant="outline" onPress={() => onRelease(position)}>
            <View style={s.releaseBtnInner}>
              <Send size={14} color="#00A878" />
              <Text style={s.releaseBtnLabel}>Izlaist darba uzdevumu</Text>
            </View>
          </Button>
        ) : null}
      </View>
    </InfoSection>
  );
}

export default function FrameworkContractDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();

  const [contract, setContract] = useState<ApiFrameworkContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activating, setActivating] = useState(false);
  const [callOffPosition, setCallOffPosition] = useState<ApiFrameworkPosition | null>(null);
  const [qty, setQty] = useState('');
  const [pickupDate, setPickupDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  });
  const [callOffNotes, setCallOffNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(
    async (skeleton = true) => {
      if (!token || !id) return;
      if (skeleton) setLoading(true);
      try {
        const data = await api.frameworkContracts.get(String(id), token);
        setContract(data);
      } catch (e) {
        Alert.alert('Kļūda', e instanceof Error ? e.message : 'Neizdevās ielādēt līgumu');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, id],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleActivate = async () => {
    if (!token || !contract || activating) return;
    setActivating(true);
    try {
      const updated = await api.frameworkContracts.activate(contract.id, token);
      setContract(updated);
      haptics.success();
    } catch (e) {
      Alert.alert('Kļūda', e instanceof Error ? e.message : 'Neizdevās aktivizēt līgumu');
    } finally {
      setActivating(false);
    }
  };

  const openCallOff = (position: ApiFrameworkPosition) => {
    haptics.light();
    setCallOffPosition(position);
    setQty('');
    setPickupDate(new Date().toISOString().split('T')[0]);
    const next = new Date();
    next.setDate(next.getDate() + 1);
    setDeliveryDate(next.toISOString().split('T')[0]);
    setCallOffNotes('');
  };

  const handleCallOff = async () => {
    if (!token || !contract || !callOffPosition) return;

    const qtyNum = parseFloat(qty.replace(',', '.'));
    if (isNaN(qtyNum) || qtyNum <= 0) {
      Alert.alert('Ievadiet pareizu daudzumu');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate) || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
      Alert.alert('Datumu formāts: GGGG-MM-DD');
      return;
    }

    setSubmitting(true);
    try {
      const dto: CreateCallOffInput = {
        quantity: qtyNum,
        pickupDate,
        deliveryDate,
        notes: callOffNotes.trim() || undefined,
      };
      const result = await api.frameworkContracts.createCallOff(
        contract.id,
        callOffPosition.id,
        dto,
        token,
      );
      haptics.success();
      setCallOffPosition(null);
      Alert.alert(
        '✓ Darba uzdevums izveidots',
        `${result.jobNumber} ir pievienots darbu sludinājumu dēlim.`,
        [{ text: 'Labi' }],
      );
      load(false);
    } catch (e) {
      Alert.alert('Kļūda', e instanceof Error ? e.message : 'Neizdevās izveidot darba uzdevumu');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer standalone bg="#ffffff">
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!contract) {
    return (
      <ScreenContainer standalone bg="#ffffff">
        <EmptyState
          icon={<TrendingUp size={28} color="#9ca3af" />}
          title="Līgums nav atrasts"
          subtitle="Šo rāmjlīgumu nevarēja ielādēt vai tas vairs nav pieejams."
          action={
            <Button variant="outline" onPress={() => router.back()}>
              Atpakaļ
            </Button>
          }
        />
      </ScreenContainer>
    );
  }

  const status = CONTRACT_STATUS[contract.status] ?? CONTRACT_STATUS.ACTIVE;
  const overallPct = Math.min(100, contract.totalProgressPct);
  const canRelease = contract.status === 'ACTIVE';

  // Job costing
  const positionsWithPrice = contract.positions.filter((p) => p.unitPrice != null);
  const totalBudget = positionsWithPrice.reduce(
    (sum, p) => sum + p.agreedQty * (p.unitPrice ?? 0),
    0,
  );
  const totalActual = positionsWithPrice.reduce(
    (sum, p) => sum + p.consumedQty * (p.unitPrice ?? 0),
    0,
  );
  const totalRemaining = totalBudget - totalActual;
  const costPct = totalBudget > 0 ? Math.min(100, (totalActual / totalBudget) * 100) : 0;

  const period = `${formatDate(contract.startDate)}${
    contract.endDate ? ` – ${formatDate(contract.endDate)}` : ''
  }`;

  return (
    <ScreenContainer standalone bg="#ffffff">
      <ScreenHeader
        title={contract.title}
        rightAction={
          <StatusPill label={status.label} bg={status.bg} color={status.color} size="sm" />
        }
      />

      {contract.status === 'DRAFT' && (
        <View style={s.draftBanner}>
          <View style={{ flex: 1 }}>
            <Text style={s.draftBannerTitle}>Melnraksts</Text>
            <Text variant="muted" size="sm">
              Aktivizējiet, lai varētu izlaist darba uzdevumus.
            </Text>
          </View>
          <Button size="sm" onPress={handleActivate} isLoading={activating} style={s.activateBtn}>
            Aktivizēt
          </Button>
        </View>
      )}

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(false);
            }}
            tintColor="#111827"
          />
        }
      >
        <InfoSection
          icon={<Calendar size={14} color="#6b7280" />}
          title="Kopsavilkums"
          right={
            <Text size="sm" style={s.sectionRightText}>
              {contract.contractNumber}
            </Text>
          }
        >
          <View style={s.sectionBody}>
            <View style={s.progressBlock}>
              <View style={s.progRow}>
                <Text variant="muted" size="sm">
                  Izpilde
                </Text>
                <Text size="sm" style={s.progressValue}>
                  {overallPct.toFixed(0)}%
                </Text>
              </View>
              <ProgressBar pct={overallPct} complete={overallPct >= 100} />
              <Text variant="muted" size="sm" style={s.progressMeta}>
                {contract.totalConsumedQty.toFixed(1)} / {contract.totalAgreedQty.toFixed(1)} vien.
              </Text>
            </View>

            <DetailRow label="Periods" value={period} />
            <DetailRow label="Pozīcijas" value={String(contract.positions.length)} />
            <DetailRow label="Darba uzdevumi" value={String(contract.totalCallOffs)} />
            <DetailRow label="Piezīmes" value={contract.notes ?? null} last />
          </View>
        </InfoSection>

        {/* ── Job Costing ── */}
        <SectionLabel label="Izmaksu analīze" />
        <InfoSection icon={<TrendingUp size={14} color="#6b7280" />} title="Budžeta pārskats">
          {totalBudget > 0 ? (
            <View style={s.sectionBody}>
              {/* 3 KPI tiles */}
              <View style={s.costKpiRow}>
                <View style={s.costKpi}>
                  <Text variant="muted" size="sm">
                    Plānotāis
                  </Text>
                  <Text style={s.costKpiValue}>
                    €
                    {totalBudget.toLocaleString('lv-LV', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>
                <View style={[s.costKpi, s.costKpiMid]}>
                  <Text variant="muted" size="sm">
                    Patērētais
                  </Text>
                  <Text style={[s.costKpiValue, s.costKpiActual]}>
                    €
                    {totalActual.toLocaleString('lv-LV', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>
                <View style={[s.costKpi, s.costKpiLast]}>
                  <Text variant="muted" size="sm">
                    Atlikums
                  </Text>
                  <Text style={[s.costKpiValue, totalRemaining < 0 && s.costKpiOver]}>
                    {totalRemaining < 0 ? '-' : ''}€
                    {Math.abs(totalRemaining).toLocaleString('lv-LV', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>
              </View>

              {/* Overall cost progress */}
              <View style={s.progressBlock}>
                <View style={s.progRow}>
                  <Text variant="muted" size="sm">
                    Izmantotais budžets
                  </Text>
                  <Text size="sm" style={s.progressValue}>
                    {costPct.toFixed(0)}%
                  </Text>
                </View>
                <ProgressBar pct={costPct} complete={costPct >= 100} />
              </View>

              {/* Per-position cost rows */}
              {positionsWithPrice.map((pos) => {
                const posBudget = pos.agreedQty * (pos.unitPrice ?? 0);
                const posActual = pos.consumedQty * (pos.unitPrice ?? 0);
                const posRemaining = posBudget - posActual;
                const posCostPct = posBudget > 0 ? Math.min(100, (posActual / posBudget) * 100) : 0;
                return (
                  <View key={pos.id} style={s.costPosRow}>
                    <View style={s.costPosHeader}>
                      <Text style={s.costPosDesc} numberOfLines={1}>
                        {pos.description}
                      </Text>
                      <Text size="sm" style={s.costPosAmt}>
                        €{posActual.toFixed(0)} / €{posBudget.toFixed(0)}
                      </Text>
                    </View>
                    <ProgressBar pct={posCostPct} complete={posCostPct >= 100} />
                    <Text variant="muted" size="sm">
                      Atlikums: €{posRemaining.toFixed(2)} · €{pos.unitPrice?.toFixed(2)}/{pos.unit}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={s.costNoPriceBanner}>
              <TrendingUp size={16} color="#9ca3af" />
              <Text variant="muted" size="sm" style={{ flex: 1 }}>
                Pievienojiet vienību cenas pozīcijās, lai rēķētu izmaksu analīzi.
              </Text>
            </View>
          )}
        </InfoSection>

        <SectionLabel label={`Pozīcijas (${contract.positions.length})`} />

        {contract.positions.length === 0 ? (
          <EmptyState
            icon={<Package size={28} color="#9ca3af" />}
            title="Nav pievienotu pozīciju"
            subtitle="Kad līgumam būs pozīcijas, tās parādīsies šeit ar progresu un darba uzdevumiem."
          />
        ) : (
          contract.positions.map((position) => (
            <PositionSection
              key={position.id}
              position={position}
              canRelease={canRelease}
              onRelease={openCallOff}
            />
          ))
        )}

        {contract.recentCallOffs.length > 0 ? (
          <>
            <SectionLabel label="Nesenie darba uzdevumi" />
            <InfoSection icon={<Clock size={14} color="#6b7280" />} title="Pēdējās aktivitātes">
              {contract.recentCallOffs.map((callOff, index) => (
                <View
                  key={callOff.id}
                  style={[
                    s.recentRow,
                    index < contract.recentCallOffs.length - 1 && s.recentRowBorder,
                  ]}
                >
                  <View style={s.recentCopy}>
                    <Text size="sm" style={s.callOffNumber}>
                      {callOff.jobNumber}
                    </Text>
                    <View style={s.recentMeta}>
                      <Clock size={11} color="#9ca3af" />
                      <Text variant="muted" size="sm">
                        {formatDateShort(callOff.pickupDate)}
                      </Text>
                      {callOff.deliveryCity ? (
                        <>
                          <Text variant="muted" size="sm">
                            ·
                          </Text>
                          <Text variant="muted" size="sm">
                            {callOff.deliveryCity}
                          </Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  <Text variant="muted" size="sm" style={s.recentStatus}>
                    {CALLOFF_STATUS_LABEL[callOff.status] ?? callOff.status}
                  </Text>
                </View>
              ))}
            </InfoSection>
          </>
        ) : null}
      </ScrollView>

      <BottomSheet
        visible={callOffPosition !== null}
        onClose={() => setCallOffPosition(null)}
        title="Izlaist darba uzdevumu"
        subtitle={callOffPosition?.description}
        scrollable
      >
        <View style={s.formWrap}>
          <Text style={s.fieldLabel}>Daudzums ({callOffPosition?.unit ?? 't'}) *</Text>
          <TextInput
            style={s.input}
            value={qty}
            onChangeText={setQty}
            placeholder={`Piem. ${callOffPosition?.remainingQty?.toFixed(1) ?? '10'}`}
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
          />

          <Text style={s.fieldLabel}>Iekraušanas datums *</Text>
          <TextInput
            style={s.input}
            value={pickupDate}
            onChangeText={setPickupDate}
            placeholder="GGGG-MM-DD"
            placeholderTextColor="#9ca3af"
            keyboardType="numbers-and-punctuation"
          />

          <Text style={s.fieldLabel}>Piegādes datums *</Text>
          <TextInput
            style={s.input}
            value={deliveryDate}
            onChangeText={setDeliveryDate}
            placeholder="GGGG-MM-DD"
            placeholderTextColor="#9ca3af"
            keyboardType="numbers-and-punctuation"
          />

          <Text style={s.fieldLabel}>Piezīmes</Text>
          <TextInput
            style={[s.input, s.inputMulti]}
            value={callOffNotes}
            onChangeText={setCallOffNotes}
            placeholder="Papildinformācija šoferim..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
          />

          <Button onPress={handleCallOff} isLoading={submitting} style={s.submitBtnSpacing}>
            Izveidot darba uzdevumu
          </Button>
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 12 },
  sectionRightText: { fontWeight: '700', color: '#374151' },
  sectionBody: { paddingHorizontal: 14, paddingVertical: 14, paddingBottom: 2, gap: 10 },
  sectionBlock: { padding: 14, gap: 12 },
  positionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', lineHeight: 21 },
  progressBlock: { gap: 6 },
  progRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressValue: { fontWeight: '700', color: '#111827' },
  progressMeta: { marginTop: 2 },
  progTrack: {
    height: 7,
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progFill: {
    height: 7,
    backgroundColor: '#111827',
    borderRadius: 999,
  },
  progFillDone: { backgroundColor: '#059669' },
  callOffList: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    overflow: 'hidden',
  },
  callOffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  callOffRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  callOffCopy: { flex: 1, gap: 2 },
  callOffNumber: { fontWeight: '700', color: '#111827' },
  moreCallOffs: { paddingHorizontal: 12, paddingVertical: 10 },
  releaseBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  releaseBtnLabel: { fontSize: 14, fontWeight: '700', color: '#00A878' },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  recentRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  recentCopy: { flex: 1, gap: 4 },
  recentMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  recentStatus: { textAlign: 'right', maxWidth: 110 },
  formWrap: { paddingHorizontal: 20, paddingBottom: 32 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  inputMulti: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  submitBtnSpacing: { marginTop: 20 },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#fef9c3',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  draftBannerTitle: { fontSize: 13, fontWeight: '700', color: '#92400e', marginBottom: 2 },
  activateBtn: { minWidth: 90 },
  // Job costing
  costKpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  costKpi: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 10,
    gap: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  costKpiMid: {},
  costKpiLast: {},
  costKpiValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  costKpiActual: { color: '#059669' },
  costKpiOver: { color: '#dc2626' },
  costPosRow: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  costPosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  costPosDesc: { flex: 1, fontSize: 13, fontWeight: '600', color: '#374151' },
  costPosAmt: { fontWeight: '700', color: '#111827' },
  costNoPriceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
});
