/**
 * Messages screen.
 * Conversation list view for the in-app chat on mobile.
 */
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiChatRoom } from '@/lib/api';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonJobRow } from '@/components/ui/Skeleton';
import { haptics } from '@/lib/haptics';
import { t } from '@/lib/translations';
import { StatusPill } from '@/components/ui/StatusPill';
import { getJobStatus } from '@/lib/status';
import { MessageCircle, Truck, Trash2, AlertCircle, RefreshCw } from 'lucide-react-native';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Tikko';
  if (diffMin < 60) return `${diffMin} min.`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} st.`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} d.`;
}

// ─── Room card ────────────────────────────────────────────────────────────────

function RoomCard({ item, onPress }: { item: ApiChatRoom; onPress: () => void }) {
  const isDisposal = item.jobType === 'WASTE_COLLECTION';
  const Icon = isDisposal ? Trash2 : Truck;
  const title =
    item.otherParticipantName ??
    item.cargoType ??
    (isDisposal ? 'Atkritumu izvešana' : 'Kravas pārvadāšana');
  const route =
    item.pickupCity && item.deliveryCity
      ? `${item.pickupCity} → ${item.deliveryCity}`
      : item.jobNumber;
  const st = getJobStatus(item.status);

  return (
    <TouchableOpacity
      className="flex-row items-center py-4 px-5 bg-white border-b border-gray-100"
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center mr-4">
        <Icon size={24} color="#111827" strokeWidth={1.5} />
      </View>

      <View className="flex-1 justify-center">
        {/* Top row: Title + Time */}
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-base font-semibold text-gray-900 flex-1 mr-2" numberOfLines={1}>
            {title}
          </Text>
          {item.lastMessage && (
            <Text className="text-xs text-gray-500">
              {formatRelative(item.lastMessage.createdAt)}
            </Text>
          )}
        </View>

        {/* Middle row: Route + Status */}
        <View className="flex-row items-center mb-1">
          <Text className="text-sm text-gray-500" style={{ flexShrink: 1 }} numberOfLines={1}>
            {route}
          </Text>
          <View className="w-1 h-1 rounded-full bg-gray-300 mx-2" />
          <StatusPill label={st.label} bg={st.bg} color={st.color} size="sm" />
        </View>

        {/* Bottom row: Message Preview */}
        {item.lastMessage ? (
          <Text className="text-sm text-gray-600 leading-5" numberOfLines={1}>
            <Text className="font-medium text-gray-900">{item.lastMessage.senderName}: </Text>
            {item.lastMessage.body}
          </Text>
        ) : (
          <Text className="text-sm text-gray-400 mt-0.5">Vēl nav ziņojumu</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const homeRoute = user?.canTransport
    ? '/(driver)/home'
    : user?.canSell
      ? '/(seller)/home'
      : '/(buyer)/home';
  const handleBack = () => (router.canGoBack() ? router.back() : router.replace(homeRoute as any));
  const [rooms, setRooms] = useState<ApiChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      load();
      pollRef.current = setInterval(() => load(true), 30_000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [load]),
  );

  return (
    <ScreenContainer bg="#ffffff" noAnimation>
      <ScreenHeader title={t.nav.messages} onBack={handleBack} noBorder />

      {loading ? (
        <View className="px-4 py-4 gap-4 flex-1">
          <SkeletonJobRow count={5} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-10 gap-3">
          <View className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-1 border border-red-100">
            <AlertCircle size={28} color="#ef4444" strokeWidth={1.6} />
          </View>
          <Text className="text-base font-bold text-gray-900">Neizdevās ielādēt</Text>
          <Text className="text-sm text-gray-500 text-center">{error}</Text>
          <TouchableOpacity
            className="flex-row items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 bg-white mt-1 shadow-sm"
            activeOpacity={0.7}
            onPress={() => load()}
          >
            <RefreshCw size={14} color="#111827" strokeWidth={2} />
            <Text className="text-gray-900 font-semibold text-sm">Mēģināt vēlreiz</Text>
          </TouchableOpacity>
        </View>
      ) : rooms.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10 min-h-[400px]">
          <View className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4 border border-gray-100">
            <MessageCircle size={28} color="#d1d5db" strokeWidth={1.5} />
          </View>
          <Text className="text-xl font-bold text-gray-900 mb-2 text-center">
            Nav aktīvu sarunu
          </Text>
          <Text className="text-base text-gray-500 font-medium text-center">
            Sarakste ar piegādātājiem un šoferiem parādīsies šeit pēc pasūtījuma veikšanas.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          className="flex-1"
          keyExtractor={(r) => r.jobId}
          removeClippedSubviews={true}
          initialNumToRender={15}
          renderItem={({ item }) => (
            <RoomCard
              item={item}
              onPress={() => {
                haptics.light();
                router.push({
                  pathname: '/chat/[jobId]',
                  params: {
                    jobId: item.jobId,
                    title:
                      item.otherParticipantName ??
                      item.cargoType ??
                      (item.jobType === 'WASTE_COLLECTION'
                        ? 'Atkritumu izvešana'
                        : 'Kravas pārvadāšana'),
                  },
                } as any);
              }}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#111827"
            />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View className="px-5 py-4 border-b border-gray-100">
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {rooms.length} {rooms.length === 1 ? 'Saruna' : 'Sarunas'}
              </Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
