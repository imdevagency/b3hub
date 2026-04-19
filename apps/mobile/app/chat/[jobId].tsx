import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Send,
  MessageCircle,
  Plus,
  Smile,
  Mic,
  MoreHorizontal,
  ChevronLeft,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/auth-context';
import { ApiChatMessage } from '@/lib/api';
import { useChat } from '@/lib/use-chat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { SkeletonCard } from '@/components/ui/Skeleton';

export default function ChatScreen() {
  const { jobId, title } = useLocalSearchParams<{ jobId: string; title?: string }>();
  const { token, user } = useAuth();
  const router = useRouter();
  const fallbackHome = user?.canTransport
    ? '/(driver)/home'
    : user?.canSell
      ? '/(seller)/home'
      : '/(buyer)/home';

  const [input, setInput] = useState('');
  const [sendingImage, setSendingImage] = useState(false);

  const { messages, loading, connected, sending, sendMessage, sendImageMessage } = useChat({
    jobId: String(jobId),
    token,
    currentUser: user ? { id: user.id, firstName: user.firstName, lastName: user.lastName } : null,
  });
  // Derive the other participant's name from received messages
  const otherParticipantName = messages.find((m) => m.senderId !== user?.id)?.senderName ?? null;
  const displayName = otherParticipantName ?? String(title ?? 'Čats');
  const flatListRef = useRef<FlatList>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    haptics.light();
    const text = input.trim();
    setInput('');
    try {
      await sendMessage(text);
    } catch {
      setInput(text); // restore on error
    }
  };

  const handlePickImage = async () => {
    if (sending || sendingImage) return;
    Alert.alert('Pievienot foto', '', [
      {
        text: 'Uzņemt foto',
        onPress: async () => {
          const { granted } = await ImagePicker.requestCameraPermissionsAsync();
          if (!granted) {
            Alert.alert('', 'Nepieciešama piekļuve kamerai.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: 'images',
            quality: 0.5,
            base64: true,
            allowsEditing: true,
            aspect: [4, 3],
          });
          if (!result.canceled && result.assets?.[0]?.base64) {
            setSendingImage(true);
            haptics.light();
            try {
              await sendImageMessage(result.assets[0].base64, 'image/jpeg');
            } catch {
              Alert.alert('', 'Neizdevās nosūtīt attēlu.');
            } finally {
              setSendingImage(false);
            }
          }
        },
      },
      {
        text: 'Izvēlēties no galerijas',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            quality: 0.5,
            base64: true,
            allowsEditing: true,
            aspect: [4, 3],
          });
          if (!result.canceled && result.assets?.[0]?.base64) {
            setSendingImage(true);
            haptics.light();
            try {
              await sendImageMessage(result.assets[0].base64, 'image/jpeg');
            } catch {
              Alert.alert('', 'Neizdevās nosūtīt attēlu.');
            } finally {
              setSendingImage(false);
            }
          }
        },
      },
      { text: 'Atcelt', style: 'cancel' },
    ]);
  };

  const renderMessage = ({ item }: { item: ApiChatMessage }) => {
    const isOwn = item.senderId === user?.id;
    return (
      <View style={[styles.msgRowWrapper, isOwn && styles.msgRowWrapperOwn]}>
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.chatImage} resizeMode="cover" />
          ) : null}
          {item.body ? (
            <Text style={[styles.bodyText, isOwn ? styles.bodyTextOwn : styles.bodyTextOther]}>
              {item.body}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.timeText, isOwn ? styles.timeTextOwn : styles.timeTextOther]}>
          {new Date(item.createdAt)
            .toLocaleTimeString('lv-LV', {
              hour: 'numeric',
              minute: '2-digit',
            })
            .replace(/^0/, '') + (new Date(item.createdAt).getHours() >= 12 ? 'pm' : 'am')}
        </Text>
      </View>
    );
  };

  const insets = useSafeAreaInsets();

  return (
    <ScreenContainer standalone bg="#f4f5f7" noAnimation>
      {/* Modern Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(fallbackHome as any))}
        >
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.avatar}>
            <View style={styles.avatarInitials}>
              <Text style={styles.avatarInitialsText}>
                {displayName
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </Text>
            </View>
          </View>
          <View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {displayName}
            </Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, !connected && styles.statusDotOffline]} />
              <Text style={styles.statusText}>{connected ? 'Tiešsaistē' : 'Bezsaistē'}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.headerBtn}>
          <MoreHorizontal size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages or states */}
        {loading ? (
          <View style={styles.centerBox}>
            <SkeletonCard count={6} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.centerBox}>
            <MessageCircle size={44} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Sāciet sarunu</Text>
            <Text style={styles.emptyHint}>Ziņas ir redzamas tikai jums un otrai pusei</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Input bar */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={handlePickImage}
            disabled={sendingImage}
          >
            {sendingImage ? (
              <ActivityIndicator size="small" color="#111827" />
            ) : (
              <Plus size={22} color="#111827" />
            )}
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              placeholder="Rakstiet..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={1000}
            />
            {!!input.trim() && !sending ? (
              <TouchableOpacity style={styles.inlineActionBtn} onPress={handleSend}>
                <Send size={20} color="#111827" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.inlineActionBtn}>
                {sending ? (
                  <ActivityIndicator size="small" color="#111827" />
                ) : (
                  <Smile size={20} color="#6b7280" />
                )}
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.circleBtn}>
            <Mic size={20} color="#111827" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // Center empty/loading states
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#6b7280',
  },
  emptyHint: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Modern Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 8,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f4f5f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
  },
  avatarInitialsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  statusDotOffline: {
    backgroundColor: '#d1d5db',
  },
  statusText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },

  // Messages list
  list: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 20,
    paddingBottom: 16,
  },

  msgRowWrapper: {
    alignItems: 'flex-start',
    gap: 4,
  },
  msgRowWrapperOwn: {
    alignItems: 'flex-end',
  },

  // Bubbles
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleOwn: {
    backgroundColor: '#F3E4A4', // Matching the pale yellow from screenshot
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bodyTextOwn: {
    color: '#111827',
  },
  bodyTextOther: {
    color: '#111827',
  },
  timeText: {
    fontSize: 11,
    color: '#9ca3af',
  },
  timeTextOwn: {
    textAlign: 'right',
  },
  timeTextOther: {
    textAlign: 'left',
  },

  // Input Container
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32, // Accommodate safe area nicely
    backgroundColor: '#f4f5f7',
  },
  circleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  textInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 13,
    fontSize: 15,
    lineHeight: 22,
    color: '#111827',
    textAlignVertical: 'center',
  },
  inlineActionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Image bubble
  chatImage: {
    width: 220,
    height: 165,
    borderRadius: 12,
    marginBottom: 4,
  },
});
