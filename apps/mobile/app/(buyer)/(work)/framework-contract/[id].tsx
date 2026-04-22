/**
 * (buyer)/framework-contract/[id].tsx
 *
 * Buyer: framework contract detail — positions with progress and call-off release.
 */

import React, { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  TouchableOpacity,
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { Calendar as RNCalendar } from 'react-native-calendars';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import {
  api,
  type ApiAdvanceInvoice,
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
import { useToast } from '@/components/ui/Toast';
import {
  Calendar,
  Clock,
  Package,
  Receipt,
  Send,
  Trash2,
  TrendingUp,
  Truck,
} from 'lucide-react-native';
import { colors } from '@/lib/theme';

const CONTRACT_STATUS: Record<
  FrameworkContractStatus,
  { label: string; bg: string; color: string }
> = {
  DRAFT: { label: 'Melnraksts', bg: '#fef3c7', color: '#92400e' },
  ACTIVE: { label: 'Aktīvs', bg: '#dcfce7', color: colors.successText },
  COMPLETED: { label: 'Pabeigts', bg: '#f0f9ff', color: '#0369a1' },
  EXPIRED: { label: 'Beidzies', bg: '#f3f4f6', color: colors.textMuted },
  CANCELLED: { label: 'Atcelts', bg: '#fef2f2', color: colors.dangerText },
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
  const { token, user } = useAuth();
  const toast = useToast();
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
  const [datePickerFor, setDatePickerFor] = useState<'pickup' | 'delivery' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Advance invoices
  const [advanceInvoices, setAdvanceInvoices] = useState<ApiAdvanceInvoice[]>([]);
  const [isFieldContract, setIsFieldContract] = useState(false);
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNotes, setAdvanceNotes] = useState('');
  const [creatingAdvance, setCreatingAdvance] = useState(false);

  const load = useCallback(
    async (skeleton = true) => {
      if (!token || !id) return;
      if (skeleton) setLoading(true);
      try {
        const [data, advances] = await Promise.all([
          api.frameworkContracts.get(String(id), token),
          api.frameworkContracts
            .listAdvanceInvoices(String(id), token)
            .then((v) => v)
            .catch((): ApiAdvanceInvoice[] | null => null),
        ]);
        setContract(data);
        if (advances !== null) {
          setAdvanceInvoices(advances);
          setIsFieldContract(true);
        } else {
          setIsFieldContract(false);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Neizdevās ielādēt līgumu');
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
      toast.error(e instanceof Error ? e.message : 'Neizdevās aktivizēt līgumu');
    } finally {
      setActivating(false);
    }
  };

  const handleCreateAdvance = async () => {
    if (!token || !contract) return;
    const amount = parseFloat(advanceAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast.error('Ievadiet derīgu summu.');
      return;
    }
    setCreatingAdvance(true);
    try {
      const newInvoice = await api.frameworkContracts.createAdvanceInvoice(
        contract.id,
        amount,
        advanceNotes.trim() || undefined,
        token,
      );
      setAdvanceInvoices((prev) => [...prev, newInvoice]);
      setAdvanceAmount('');
      setAdvanceNotes('');
      setShowAdvanceForm(false);
      haptics.success();
      toast.success('Avansa rēķins izveidots!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Neizdevās izveidot avansa rēķinu.');
    } finally {
      setCreatingAdvance(false);
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
      toast.error(e instanceof Error ? e.message : 'Neizdevās izveidot darba uzdevumu');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer bg="#ffffff">
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!contract) {
    return (
      <ScreenContainer bg="#ffffff">
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
  // Only allow call-off creation when contract is ACTIVE and user has permission
  const canRelease =
    contract.status === 'ACTIVE' && (user?.permReleaseCallOffs ?? !user?.companyRole); // solo users (no companyRole) can always release

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
    <ScreenContainer bg="#ffffff">
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
            tintColor="#00A878"
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

        {/* Advance Invoices */}
        {advanceInvoices.length > 0 || isFieldContract ? (
          <>
            <SectionLabel label="Avansa rēķini" />
            <InfoSection
              icon={<Receipt size={14} color="#6b7280" />}
              title="Avansa maksājumi"
              right={
                !showAdvanceForm ? (
                  <TouchableOpacity onPress={() => setShowAdvanceForm(true)}>
                    <Text size="sm" style={s.advanceAddLink}>
                      + Pievienot
                    </Text>
                  </TouchableOpacity>
                ) : undefined
              }
            >
              {advanceInvoices.length === 0 && (
                <View style={s.advanceEmptyWrap}>
                  <Text variant="muted" size="sm">
                    Nav avansa rēķinu.
                  </Text>
                </View>
              )}
              {advanceInvoices.map((inv, idx) => (
                <View
                  key={inv.id}
                  style={[s.advRow, idx < advanceInvoices.length - 1 && s.advRowBorder]}
                >
                  <View style={{ flex: 1 }}>
                    <Text size="sm" style={s.advNumber}>
                      {inv.invoiceNumber}
                    </Text>
                    <Text variant="muted" size="sm">
                      Termiņš: {formatDateShort(inv.dueDate ?? '')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={s.advTotal}>
                      €{inv.total.toLocaleString('lv-LV', { minimumFractionDigits: 2 })}
                    </Text>
                    <StatusPill
                      label={
                        inv.paymentStatus === 'PAID'
                          ? 'Apmaksāts'
                          : inv.paymentStatus === 'OVERDUE'
                            ? 'Kavēts'
                            : 'Gaida'
                      }
                      bg={
                        inv.paymentStatus === 'PAID'
                          ? '#dcfce7'
                          : inv.paymentStatus === 'OVERDUE'
                            ? '#fef2f2'
                            : '#fef3c7'
                      }
                      color={
                        inv.paymentStatus === 'PAID'
                          ? colors.successText
                          : inv.paymentStatus === 'OVERDUE'
                            ? colors.dangerText
                            : '#92400e'
                      }
                      size="sm"
                    />
                  </View>
                </View>
              ))}

              {showAdvanceForm && (
                <View style={s.advForm}>
                  <Text style={s.fieldLabel}>Summa (€) *</Text>
                  <TextInput
                    style={s.input}
                    value={advanceAmount}
                    onChangeText={setAdvanceAmount}
                    placeholder="Piem. 500.00"
                    placeholderTextColor="#9ca3af"
                    keyboardType="decimal-pad"
                  />
                  <Text style={s.fieldLabel}>Piezīmes</Text>
                  <TextInput
                    style={[s.input, s.inputMulti]}
                    value={advanceNotes}
                    onChangeText={setAdvanceNotes}
                    placeholder="Papildinformācija..."
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={2}
                  />
                  <View style={s.advFormActions}>
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => {
                        setShowAdvanceForm(false);
                        setAdvanceAmount('');
                        setAdvanceNotes('');
                      }}
                    >
                      Atcelt
                    </Button>
                    <Button size="sm" onPress={handleCreateAdvance} isLoading={creatingAdvance}>
                      Izveidot rēķinu
                    </Button>
                  </View>
                </View>
              )}
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
          <Pressable style={s.dateBtn} onPress={() => setDatePickerFor('pickup')}>
            <Calendar size={15} color="#6b7280" />
            <Text style={s.dateBtnText}>{pickupDate}</Text>
          </Pressable>

          <Text style={s.fieldLabel}>Piegādes datums *</Text>
          <Pressable style={s.dateBtn} onPress={() => setDatePickerFor('delivery')}>
            <Calendar size={15} color="#6b7280" />
            <Text style={s.dateBtnText}>{deliveryDate}</Text>
          </Pressable>

          {/* Date picker modal */}
          <Modal
            visible={datePickerFor !== null}
            transparent
            animationType="fade"
            onRequestClose={() => setDatePickerFor(null)}
          >
            <Pressable style={s.dateModalOverlay} onPress={() => setDatePickerFor(null)}>
              <Pressable style={s.dateModalCard} onPress={(e) => e.stopPropagation()}>
                <Text style={s.dateModalTitle}>
                  {datePickerFor === 'pickup' ? 'Iekraušanas datums' : 'Piegādes datums'}
                </Text>
                <RNCalendar
                  minDate={new Date().toISOString().split('T')[0]}
                  current={datePickerFor === 'pickup' ? pickupDate : deliveryDate}
                  markedDates={{
                    [datePickerFor === 'pickup' ? pickupDate : deliveryDate]: {
                      selected: true,
                      selectedColor: '#111827',
                      selectedTextColor: '#fff',
                    },
                  }}
                  onDayPress={(day: { dateString: string }) => {
                    if (datePickerFor === 'pickup') setPickupDate(day.dateString);
                    else setDeliveryDate(day.dateString);
                    setDatePickerFor(null);
                  }}
                  theme={{
                    calendarBackground: '#ffffff',
                    selectedDayBackgroundColor: '#111827',
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: '#6b7280',
                    dayTextColor: '#111827',
                    textDisabledColor: '#d1d5db',
                    arrowColor: '#111827',
                    monthTextColor: '#111827',
                    textDayFontWeight: '500',
                    textMonthFontWeight: '700',
                    textDayHeaderFontWeight: '600',
                  }}
                  enableSwipeMonths
                />
              </Pressable>
            </Pressable>
          </Modal>

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
  sectionRightText: { fontWeight: '700', color: colors.textSecondary },
  sectionBody: { paddingHorizontal: 14, paddingVertical: 14, paddingBottom: 2, gap: 10 },
  sectionBlock: { padding: 14, gap: 12 },
  positionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, lineHeight: 21 },
  progressBlock: { gap: 6 },
  progRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressValue: { fontWeight: '700', color: colors.textPrimary },
  progressMeta: { marginTop: 2 },
  progTrack: {
    height: 7,
    backgroundColor: colors.bgMuted,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progFill: {
    height: 7,
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  progFillDone: { backgroundColor: '#059669' },
  callOffList: {
    backgroundColor: colors.bgSubtle,
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
    borderBottomColor: colors.border,
  },
  callOffCopy: { flex: 1, gap: 2 },
  callOffNumber: { fontWeight: '700', color: colors.textPrimary },
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
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.bgSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  inputMulti: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  submitBtnSpacing: { marginTop: 20 },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 4,
  },
  dateBtnText: { fontSize: 15, color: colors.textPrimary, fontFamily: 'Inter_500Medium' },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  dateModalCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 16,
    width: '100%',
    maxWidth: 380,
  },
  dateModalTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
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
    backgroundColor: colors.bgSubtle,
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
    color: colors.textPrimary,
  },
  costKpiActual: { color: colors.success },
  costKpiOver: { color: colors.danger },
  costPosRow: {
    backgroundColor: colors.bgSubtle,
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
  costPosDesc: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  costPosAmt: { fontWeight: '700', color: colors.textPrimary },
  costNoPriceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  // Advance invoices
  advanceAddLink: { color: colors.primary, fontWeight: '700' },
  advanceEmptyWrap: { paddingHorizontal: 14, paddingVertical: 10 },
  advRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  advRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  advNumber: { fontWeight: '600', color: colors.textPrimary },
  advTotal: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  advForm: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4, gap: 8 },
  advFormActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
});
