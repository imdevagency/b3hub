import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Modal,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { getRecyclerWasteRecords, updateWasteRecord } from '@/lib/api';
import type { WasteRecord } from '@/lib/api';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useHeaderConfig } from '@/lib/header-context';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { FileText, Download, Scale, ChevronRight } from 'lucide-react-native';

const STAGE_SEQUENCE: Record<string, string> = {
  RECEIVED: 'SORTED',
  SORTED: 'PROCESSING',
  PROCESSING: 'PROCESSED',
};

const STAGE_LABELS: Record<string, string> = {
  RECEIVED: 'Saņemts',
  SORTED: 'Šķirots',
  PROCESSING: 'Apstrādē',
  PROCESSED: 'Apstrādāts',
  LISTED: 'Izsludināts',
  REJECTED: 'Noraidīts',
};

const APUS_LABELS: Record<string, string> = {
  NOT_REQUIRED: 'Nav nepieciešams',
  PENDING: 'Gaidīšanas rindā',
  SUBMITTED: 'Iesniegts',
  ACCEPTED: 'Apstiprināts',
  REJECTED: 'Noraidīts',
};

function RecordCard({ record, onPress }: { record: WasteRecord; onPress: () => void }) {
  const date = new Date(record.createdAt).toLocaleDateString('lv-LV', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const hasCertificate = !!record.certificateUrl;
  const nextStage = STAGE_SEQUENCE[record.processingStage ?? ''];

  return (
    <TouchableOpacity style={ls.card} activeOpacity={0.8} onPress={onPress}>
      <View style={ls.cardTop}>
        <View style={ls.cardLeft}>
          <Text style={ls.recordId}>#{record.id.slice(-6).toUpperCase()}</Text>
          <Text style={ls.date}>{date}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {hasCertificate && (
            <View style={[ls.badge, { backgroundColor: '#dcfce7' }]}>
              <Text style={[ls.badgeText, { color: '#166534' }]}>Sertificēts</Text>
            </View>
          )}
          <View style={[ls.badge, { backgroundColor: '#f0f9ff' }]}>
            <Text style={[ls.badgeText, { color: '#0369a1' }]}>
              {STAGE_LABELS[record.processingStage ?? ''] ?? record.processingStage}
            </Text>
          </View>
          {nextStage && <ChevronRight size={14} color={colors.textMuted} />}
        </View>
      </View>

      <View style={ls.row}>
        <Text style={ls.typeLabel}>{record.wasteType}</Text>
      </View>

      {record.weightKg != null && (
        <View style={ls.metaRow}>
          <Scale size={13} color={colors.textMuted} />
          <Text style={ls.metaText}>
            {record.weightKg >= 1000
              ? `${(record.weightKg / 1000).toFixed(2)} t`
              : `${record.weightKg} kg`}
            {record.recyclableWeight != null && record.recyclingRate != null
              ? ` · ${record.recyclingRate.toFixed(0)}% reciklēts`
              : ''}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function RecyclerRecordsScreen() {
  const { token } = useAuth();
  const { setConfig } = useHeaderConfig();
  const [records, setRecords] = useState<WasteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<WasteRecord | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [apusStatus, setApusStatus] = useState('');
  const [apusId, setApusId] = useState('');
  const [savingApus, setSavingApus] = useState(false);
  const [pendingProcessedRecord, setPendingProcessedRecord] = useState<WasteRecord | null>(null);
  const [weighbridgeRef, setWeighbridgeRef] = useState('');
  const [savingWeighbridge, setSavingWeighbridge] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getRecyclerWasteRecords(token);
      setRecords(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setConfig({ title: 'Atkritumu ieraksti' });
      load();
      return () => setConfig(null);
    }, [load, setConfig]),
  );

  function openRecord(r: WasteRecord) {
    setSelectedRecord(r);
    setApusStatus((r as any).apusStatus ?? '');
    setApusId((r as any).apusSubmissionId ?? '');
  }

  async function handleAdvanceStage(record: WasteRecord) {
    const nextStage = STAGE_SEQUENCE[record.processingStage ?? ''];
    if (!nextStage || !token || !record.recyclingCenterId) return;
    // When advancing to PROCESSED, prompt for weighbridge ticket reference first
    if (nextStage === 'PROCESSED') {
      setWeighbridgeRef('');
      setPendingProcessedRecord(record);
      return;
    }
    setAdvancing(true);
    try {
      const updated = await updateWasteRecord(token, record.recyclingCenterId, record.id, {
        processingStage: nextStage,
      });
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSelectedRecord(updated);
    } catch {
      Alert.alert('Kļūda', 'Neizdevās mainīt posmu. Mēģiniet vēlreiz.');
    } finally {
      setAdvancing(false);
    }
  }

  async function handleSaveApus(record: WasteRecord) {
    if (!token || !record.recyclingCenterId) return;
    setSavingApus(true);
    try {
      const updated = await updateWasteRecord(token, record.recyclingCenterId, record.id, {
        apusStatus: apusStatus || undefined,
        apusSubmissionId: apusId || undefined,
      });
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSelectedRecord(updated);
      Alert.alert('Saglabāts', 'APUS statuss atjaunināts.');
    } catch {
      Alert.alert('Kļūda', 'Neizdevās saglabāt APUS statusu.');
    } finally {
      setSavingApus(false);
    }
  }

  async function handleConfirmProcessed() {
    if (!pendingProcessedRecord || !token || !pendingProcessedRecord.recyclingCenterId) return;
    setSavingWeighbridge(true);
    try {
      const updated = await updateWasteRecord(
        token,
        pendingProcessedRecord.recyclingCenterId,
        pendingProcessedRecord.id,
        {
          processingStage: 'PROCESSED',
          weighbridgeTicketRef: weighbridgeRef.trim() || undefined,
        },
      );
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSelectedRecord(updated);
      setPendingProcessedRecord(null);
    } catch {
      Alert.alert('Kļūda', 'Neizdevās mainīt posmu. Mēģiniet vēlreiz.');
    } finally {
      setSavingWeighbridge(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </ScreenContainer>
    );
  }

  if (records.length === 0) {
    return (
      <ScreenContainer>
        <EmptyState
          icon={<FileText size={32} color="#9ca3af" />}
          title="Nav ierakstu"
          subtitle="Atkritumu pieņemšanas ieraksti parādīsīsies šeit"
        />
      </ScreenContainer>
    );
  }

  const certified = records.filter((r) => r.certificateUrl).length;
  const totalWeight = records.reduce((s, r) => s + (r.weightKg ?? 0), 0);

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        contentContainerStyle={ls.scroll}
      >
        {/* summary strip */}
        <View style={ls.summaryRow}>
          <View style={ls.summaryItem}>
            <Text style={ls.summaryValue}>{records.length}</Text>
            <Text style={ls.summaryLabel}>Kopā</Text>
          </View>
          <View style={ls.divider} />
          <View style={ls.summaryItem}>
            <Text style={ls.summaryValue}>{certified}</Text>
            <Text style={ls.summaryLabel}>Sertificēti</Text>
          </View>
          <View style={ls.divider} />
          <View style={ls.summaryItem}>
            <Text style={ls.summaryValue}>
              {totalWeight >= 1000
                ? `${(totalWeight / 1000).toFixed(1)}t`
                : `${totalWeight.toFixed(0)}kg`}
            </Text>
            <Text style={ls.summaryLabel}>Kopā svars</Text>
          </View>
        </View>

        {records.map((r) => (
          <RecordCard key={r.id} record={r} onPress={() => openRecord(r)} />
        ))}
      </ScrollView>

      {/* Detail modal */}
      <Modal
        visible={!!selectedRecord}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRecord(null)}
      >
        <Pressable style={ls.backdrop} onPress={() => setSelectedRecord(null)} />
        {selectedRecord && (
          <View style={ls.sheet}>
            <View style={ls.sheetHandle} />
            <View style={ls.sheetHeader}>
              <Text style={ls.sheetId}>#{selectedRecord.id.slice(-6).toUpperCase()}</Text>
              <TouchableOpacity onPress={() => setSelectedRecord(null)}>
                <Text style={ls.closeText}>Aizvērt</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={ls.detailRow}>
                <Text style={ls.detailLabel}>Veids</Text>
                <Text style={ls.detailVal}>{selectedRecord.wasteType}</Text>
              </View>
              <View style={ls.detailRow}>
                <Text style={ls.detailLabel}>Posms</Text>
                <Text style={ls.detailVal}>
                  {STAGE_LABELS[selectedRecord.processingStage ?? ''] ??
                    selectedRecord.processingStage}
                </Text>
              </View>
              {selectedRecord.weightKg != null && (
                <View style={ls.detailRow}>
                  <Text style={ls.detailLabel}>Svars</Text>
                  <Text style={ls.detailVal}>
                    {selectedRecord.weightKg >= 1000
                      ? `${(selectedRecord.weightKg / 1000).toFixed(2)} t`
                      : `${selectedRecord.weightKg} kg`}
                  </Text>
                </View>
              )}
              {selectedRecord.recyclingRate != null && (
                <View style={ls.detailRow}>
                  <Text style={ls.detailLabel}>Reciklēts</Text>
                  <Text style={ls.detailVal}>{selectedRecord.recyclingRate.toFixed(0)}%</Text>
                </View>
              )}

              {/* Stage advancement */}
              {STAGE_SEQUENCE[selectedRecord.processingStage ?? ''] && (
                <TouchableOpacity
                  style={ls.advanceBtn}
                  activeOpacity={0.8}
                  onPress={() => handleAdvanceStage(selectedRecord)}
                  disabled={advancing}
                >
                  {advancing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={ls.advanceBtnText}>
                      Virzīt uz:{' '}
                      {STAGE_LABELS[STAGE_SEQUENCE[selectedRecord.processingStage ?? '']]}
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Certificate download */}
              {selectedRecord.certificateUrl && (
                <TouchableOpacity
                  style={ls.downloadBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    haptics.light();
                    Linking.openURL(selectedRecord.certificateUrl!);
                  }}
                >
                  <Download size={14} color={colors.primary} />
                  <Text style={ls.downloadText}>Lejupielādēt sertifikātu</Text>
                </TouchableOpacity>
              )}

              {/* APUS tracking — always shown so licensed-center operators can update */}
              <View style={ls.apusSection}>
                <Text style={ls.apusSectionTitle}>APUS izsekošana</Text>
                <Text style={ls.apusLabel}>Statuss</Text>
                <View style={ls.apusStatusRow}>
                  {['NOT_REQUIRED', 'PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED'].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[ls.apusChip, apusStatus === s && ls.apusChipActive]}
                      onPress={() => setApusStatus(s)}
                    >
                      <Text style={[ls.apusChipText, apusStatus === s && ls.apusChipTextActive]}>
                        {APUS_LABELS[s]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={ls.apusLabel}>Iesnieguma ID</Text>
                <TextInput
                  style={ls.apusInput}
                  value={apusId}
                  onChangeText={setApusId}
                  placeholder="APUS iesnieguma numurs"
                  placeholderTextColor={colors.textMuted}
                />
                <TouchableOpacity
                  style={ls.saveApusBtn}
                  activeOpacity={0.8}
                  onPress={() => handleSaveApus(selectedRecord)}
                  disabled={savingApus}
                >
                  {savingApus ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={ls.saveApusBtnText}>Saglabāt APUS</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Weighbridge prompt — shown when advancing to PROCESSED */}
      <Modal
        visible={!!pendingProcessedRecord}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingProcessedRecord(null)}
      >
        <Pressable style={ls.backdrop} onPress={() => setPendingProcessedRecord(null)} />
        <View style={ls.weighbridgeSheet}>
          <Text style={ls.weighbridgeTitle}>Apstrādāts — svara talons</Text>
          <Text style={ls.weighbridgeSub}>
            Ievadiet svara talona numuru (neobligāts, bet ieteicams dokumentācijai)
          </Text>
          <TextInput
            style={ls.weighbridgeInput}
            value={weighbridgeRef}
            onChangeText={setWeighbridgeRef}
            placeholder="Piem., WT-2024-00123"
            placeholderTextColor={colors.textMuted}
            autoFocus
          />
          <View style={ls.weighbridgeBtns}>
            <TouchableOpacity
              style={ls.weighbridgeBtnSecondary}
              onPress={() => setPendingProcessedRecord(null)}
              activeOpacity={0.75}
            >
              <Text style={ls.weighbridgeBtnSecondaryText}>Atcelt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={ls.weighbridgeBtnPrimary}
              onPress={handleConfirmProcessed}
              disabled={savingWeighbridge}
              activeOpacity={0.8}
            >
              {savingWeighbridge ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={ls.weighbridgeBtnPrimaryText}>Apstiprināt</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const ls = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  summaryLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  divider: { width: 1, height: 32, backgroundColor: '#E5E7EB' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLeft: { gap: 2 },
  recordId: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  date: { fontSize: 12, color: colors.textMuted },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  typeLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: colors.textMuted },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 8 },
  downloadText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  // Detail modal
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    padding: 20,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetId: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  closeText: { fontSize: 14, color: colors.primary },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: { fontSize: 13, color: colors.textMuted },
  detailVal: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  advanceBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  advanceBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  apusSection: {
    marginTop: 20,
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  apusSectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  apusLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  apusStatusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  apusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
  },
  apusChipActive: { borderColor: colors.primary, backgroundColor: '#eff6ff' },
  apusChipText: { fontSize: 11, color: colors.textSecondary },
  apusChipTextActive: { color: colors.primary, fontWeight: '600' },
  apusInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: '#fff',
  },
  saveApusBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 4,
  },
  saveApusBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  weighbridgeSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  weighbridgeTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  weighbridgeSub: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  weighbridgeInput: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: '#fff',
    marginTop: 4,
  },
  weighbridgeBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  weighbridgeBtnSecondary: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  weighbridgeBtnSecondaryText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  weighbridgeBtnPrimary: {
    flex: 2,
    backgroundColor: '#166534',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  weighbridgeBtnPrimaryText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
