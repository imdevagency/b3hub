/**
 * (seller)/catalog.tsx
 *
 * Read-only catalog view for mobile sellers.
 *
 * Rationale: creating/editing material listings (photos, price tiers, availability
 * blocks, descriptions, delivery radius) is a back-office task. Yard managers and
 * owners should manage the catalog on the web portal. On mobile, sellers only
 * need to:
 *   1. See what is listed
 *   2. Quickly flip an item in/out of stock
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  Switch,
  Linking,
  Alert,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiMaterial } from '@/lib/api';
import { UNIT_SHORT } from '@/lib/materials';
import { useMaterialCatalogue } from '@/lib/use-material-catalogue';
import { PackageSearch, ExternalLink, Leaf, CalendarOff } from 'lucide-react-native';
import { colors } from '@/lib/theme';
import type { ApiAvailabilityBlock } from '@/lib/api/materials';

const WEB_CATALOG_URL = 'https://b3hub.lv/dashboard/materials';

function MaterialRow({
  item,
  onToggleStock,
  onBlockDates,
}: {
  item: ApiMaterial;
  onToggleStock: (id: string, next: boolean) => void;
  onBlockDates: (item: ApiMaterial) => void;
}) {
  const { categoryLabels } = useMaterialCatalogue();
  const categoryLabel = categoryLabels[item.category] ?? item.category;
  const unit = UNIT_SHORT[item.unit] ?? item.unit;
  const thumb = item.images?.[0];

  return (
    <View style={s.row}>
      <View style={s.thumb}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={s.thumbImg} />
        ) : (
          <PackageSearch size={22} color={colors.textMuted} strokeWidth={1.5} />
        )}
      </View>

      <View style={s.body}>
        <View style={s.titleRow}>
          <Text style={s.name} numberOfLines={1}>
            {item.name}
          </Text>
          {item.isRecycled && <Leaf size={14} color="#16a34a" />}
        </View>
        <Text style={s.meta} numberOfLines={1}>
          {categoryLabel} · €{item.basePrice.toFixed(2)}/{unit}
        </Text>
        <View style={s.pillRow}>
          <StatusPill
            label={item.inStock ? 'Pieejams' : 'Nav krājumā'}
            bg={item.inStock ? '#dcfce7' : '#f3f4f6'}
            color={item.inStock ? '#166534' : '#6b7280'}
            size="sm"
          />
          {typeof item.stockQty === 'number' && (
            <Text style={s.stockText}>
              {item.stockQty} {unit}
            </Text>
          )}
        </View>
      </View>

      <Switch
        value={item.inStock}
        onValueChange={(next) => {
          haptics.light();
          onToggleStock(item.id, next);
        }}
        trackColor={{ false: '#e5e7eb', true: '#86efac' }}
        thumbColor={item.inStock ? '#16a34a' : '#f3f4f6'}
      />
      <TouchableOpacity
        style={s.blockBtn}
        onPress={() => onBlockDates(item)}
        activeOpacity={0.75}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <CalendarOff size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

export default function SellerCatalogScreen() {
  const { token } = useAuth();
  const toast = useToast();

  const [materials, setMaterials] = useState<ApiMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [blockTarget, setBlockTarget] = useState<ApiMaterial | null>(null);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockNote, setBlockNote] = useState('');
  const [savingBlock, setSavingBlock] = useState(false);
  const [blocks, setBlocks] = useState<ApiAvailabilityBlock[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  const fetchMaterials = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!token) return;
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        const res = await api.materials.getAll(token);
        const items = Array.isArray(res) ? res : res.items;
        setMaterials(items);
      } catch {
        toast.error('Neizdevās ielādēt katalogu');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, toast],
  );

  useFocusEffect(
    useCallback(() => {
      fetchMaterials('initial');
    }, [fetchMaterials]),
  );

  const toggleStock = useCallback(
    async (id: string, next: boolean) => {
      if (!token) return;
      const prev = materials;
      setMaterials((cur) => cur.map((m) => (m.id === id ? { ...m, inStock: next } : m)));
      try {
        await api.materials.update(id, { inStock: next }, token);
        haptics.success();
      } catch {
        setMaterials(prev);
        haptics.error();
        toast.error('Neizdevās atjaunināt statusu');
      }
    },
    [materials, token, toast],
  );

  const openBlockDates = useCallback(
    async (item: ApiMaterial) => {
      if (!token) return;
      haptics.light();
      setBlockTarget(item);
      setBlockStart('');
      setBlockEnd('');
      setBlockNote('');
      setLoadingBlocks(true);
      try {
        const res = await api.materials.getAvailability(item.id, token);
        setBlocks(res);
      } catch {
        setBlocks([]);
      } finally {
        setLoadingBlocks(false);
      }
    },
    [token],
  );

  const saveBlock = useCallback(async () => {
    if (!token || !blockTarget || !blockStart || !blockEnd) return;
    setSavingBlock(true);
    try {
      const newBlock = await api.materials.addAvailabilityBlock(
        blockTarget.id,
        { startDate: blockStart, endDate: blockEnd, note: blockNote.trim() || undefined },
        token,
      );
      setBlocks((prev) => [...prev, newBlock]);
      setBlockStart('');
      setBlockEnd('');
      setBlockNote('');
      haptics.success();
      toast.success('Bloķēšana pievienota');
    } catch {
      haptics.error();
      toast.error('Neizdevās pievienot bloķēšanu');
    } finally {
      setSavingBlock(false);
    }
  }, [token, blockTarget, blockStart, blockEnd, blockNote, toast]);

  const removeBlock = useCallback(
    async (blockId: string) => {
      if (!token || !blockTarget) return;
      try {
        await api.materials.removeAvailabilityBlock(blockTarget.id, blockId, token);
        setBlocks((prev) => prev.filter((b) => b.id !== blockId));
        haptics.light();
      } catch {
        toast.error('Neizdevās dzēst bloķēšanu');
      }
    },
    [token, blockTarget, toast],
  );

  const openWeb = useCallback(async () => {
    haptics.light();
    const supported = await Linking.canOpenURL(WEB_CATALOG_URL);
    if (supported) {
      Linking.openURL(WEB_CATALOG_URL);
    } else {
      Alert.alert('Atveriet b3hub.lv pārlūkā', WEB_CATALOG_URL);
    }
  }, []);

  return (
    <>
      <ScreenContainer bg="white">
        <ScreenHeader title="Mans katalogs" />
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchMaterials('refresh')}
              tintColor={colors.textMuted}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Info banner */}
          <View style={s.banner}>
            <Text style={s.bannerTitle}>Pārvaldiet katalogu tīmeklī</Text>
            <Text style={s.bannerSub}>
              Lai pievienotu vai rediģētu materiālus, cenu līmeņus un fotoattēlus, izmantojiet
              portālu b3hub.lv. Šeit varat ātri mainīt pieejamību.
            </Text>
            <TouchableOpacity style={s.bannerBtn} onPress={openWeb} activeOpacity={0.85}>
              <Text style={s.bannerBtnText}>Atvērt portālu</Text>
              <ExternalLink size={14} color={colors.white} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={s.list}>
              {[0, 1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </View>
          ) : materials.length === 0 ? (
            <EmptyState
              icon={<PackageSearch size={32} color={colors.textMuted} strokeWidth={1.5} />}
              title="Nav materiālu"
              subtitle="Jūsu uzņēmumam vēl nav pievienotu materiālu. Pievienojiet tos tīmekļa portālā."
            />
          ) : (
            <View style={s.list}>
              {materials.map((item) => (
                <MaterialRow
                  key={item.id}
                  item={item}
                  onToggleStock={toggleStock}
                  onBlockDates={openBlockDates}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </ScreenContainer>

      {/* Availability block modal */}
      <Modal
        visible={!!blockTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setBlockTarget(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setBlockTarget(null)} />
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Bloķēt datumus — {blockTarget?.name}</Text>
          <Text style={s.modalSub}>
            Norādiet periodu, kad materiāls nav pieejams (piem., karantīnas apkope)
          </Text>

          {loadingBlocks ? (
            <ActivityIndicator
              size="small"
              color={colors.textMuted}
              style={{ marginVertical: 12 }}
            />
          ) : blocks.length > 0 ? (
            <View style={{ gap: 6, marginBottom: 8 }}>
              {blocks.map((b) => (
                <View key={b.id} style={s.blockRow}>
                  <Text style={s.blockText}>
                    {b.startDate} → {b.endDate}
                    {b.note ? ` (${b.note})` : ''}
                  </Text>
                  <TouchableOpacity
                    onPress={() => removeBlock(b.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={s.blockRemove}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text style={s.blockEmpty}>Nav aktīvu bloķēšanu</Text>
          )}

          <Text style={s.modalLabel}>Sākuma datums (GGGG-MM-DD)</Text>
          <TextInput
            style={s.modalInput}
            value={blockStart}
            onChangeText={setBlockStart}
            placeholder="2025-01-01"
            placeholderTextColor={colors.textMuted}
            keyboardType="numbers-and-punctuation"
          />
          <Text style={[s.modalLabel, { marginTop: 10 }]}>Beigu datums (GGGG-MM-DD)</Text>
          <TextInput
            style={s.modalInput}
            value={blockEnd}
            onChangeText={setBlockEnd}
            placeholder="2025-01-07"
            placeholderTextColor={colors.textMuted}
            keyboardType="numbers-and-punctuation"
          />
          <Text style={[s.modalLabel, { marginTop: 10 }]}>Iemesls (neobligāts)</Text>
          <TextInput
            style={s.modalInput}
            value={blockNote}
            onChangeText={setBlockNote}
            placeholder="Piem., iekārtu apkope"
            placeholderTextColor={colors.textMuted}
          />
          <TouchableOpacity
            style={[s.modalSaveBtn, (!blockStart || !blockEnd || savingBlock) && { opacity: 0.5 }]}
            onPress={saveBlock}
            disabled={!blockStart || !blockEnd || savingBlock}
            activeOpacity={0.8}
          >
            {savingBlock ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.modalSaveBtnText}>Pievienot bloķēšanu</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 48 },
  banner: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  bannerSub: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },
  bannerBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  bannerBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
  },
  list: {
    paddingHorizontal: 20,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#f4f5f7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  body: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  stockText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  blockBtn: { padding: 4, marginLeft: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
    gap: 4,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  modalSub: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: 8 },
  modalLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: '#fff',
  },
  modalSaveBtn: {
    backgroundColor: '#166534',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
  },
  modalSaveBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  blockText: { fontSize: 13, color: colors.textPrimary, flex: 1 },
  blockRemove: { fontSize: 15, color: '#ef4444', paddingLeft: 8 },
  blockEmpty: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic', marginBottom: 4 },
});
