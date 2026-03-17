import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiChatRoom } from '@/lib/api';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { t } from '@/lib/translations';
import { MessageCircle, Truck, Trash2, ChevronRight } from 'lucide-react-native';

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Tikko';
  if (diffMin < 60) return `${diffMin} min. atpakaļ`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Pirms ${diffH} st.`;
  const diffD = Math.floor(diffH / 24);
  return `Pirms ${diffD} d.`;
}

export default function MessagesScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<ApiChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await api.chat.myRooms(token);
        setRooms(data);
      } catch {
        setError('Neizdevās ielādēt sarakstes');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    load();
  }, [load]);

  const renderItem = ({ item }: { item: ApiChatRoom }) => {
    const isDisposal = item.jobType === 'WASTE_COLLECTION';
    const Icon = isDisposal ? Trash2 : Truck;
    const iconBg = isDisposal ? '#f0fdf4' : '#eff6ff';
    const iconColor = isDisposal ? '#16a34a' : '#2563eb';
    const title = item.cargoType ?? (isDisposal ? 'Atkritumu izvešana' : 'Kravas pārvadāšana');
    const subtitle =
      item.pickupCity && item.deliveryCity
        ? `${item.pickupCity} → ${item.deliveryCity}`
        : item.jobNumber;

    return (
      <TouchableOpacity
        style={s.roomRow}
        activeOpacity={0.85}
        onPress={() =>
          router.push({
            pathname: '/chat/[jobId]',
            params: { jobId: item.jobId, title },
          } as any)
        }
      >
        <View style={[s.avatar, { backgroundColor: iconBg }]}>
          <Icon size={22} color={iconColor} strokeWidth={1.8} />
        </View>
        <View style={s.roomBody}>
          <View style={s.roomTop}>
            <Text style={s.roomTitle} numberOfLines={1}>
              {title}
            </Text>
            {item.lastMessage && (
              <Text style={s.roomTime}>{formatRelative(item.lastMessage.createdAt)}</Text>
            )}
          </View>
          <Text style={s.roomSub} numberOfLines={1}>
            {subtitle}
          </Text>
          {item.lastMessage && (
            <Text style={s.lastMsg} numberOfLines={1}>
              <Text style={s.lastMsgName}>{item.lastMessage.senderName}: </Text>
              {item.lastMessage.body}
            </Text>
          )}
        </View>
        <ChevronRight size={16} color="#d1d5db" />
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer standalone topInset={0}>
      <ScreenHeader title={t.nav.messages} withTopInset />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => load()}>
            <Text style={s.retryText}>Mēģināt vēlreiz</Text>
          </TouchableOpacity>
        </View>
      ) : rooms.length === 0 ? (
        <EmptyState
          icon={<MessageCircle size={32} color="#9ca3af" strokeWidth={1.5} />}
          title="Nav aktīvu sarunu"
          subtitle="Sarakste ar piegādātājiem un šoferiem parādīsies šeit, tiklīdz tiks veikts pasūtījums."
        />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(r) => r.jobId}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          contentContainerStyle={{ paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={s.sep} />}
        />
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  errorText: { fontSize: 15, color: '#6b7280', textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#111827',
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  roomBody: { flex: 1, gap: 2 },
  roomTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4 },
  roomTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  roomTime: { fontSize: 12, color: '#9ca3af', flexShrink: 0 },
  roomSub: { fontSize: 13, color: '#6b7280' },
  lastMsg: { fontSize: 13, color: '#9ca3af', marginTop: 1 },
  lastMsgName: { fontWeight: '600', color: '#6b7280' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#f3f4f6', marginLeft: 76 },
});
