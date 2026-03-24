import React, { useEffect, useRef } from 'react';
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
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Send, ArrowLeft, MessageCircle } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { ApiChatMessage } from '@/lib/api';
import { useChat } from '@/lib/use-chat';
import { useState } from 'react';
import { ScreenContainer } from '@/components/ui/ScreenContainer';

export default function ChatScreen() {
  const { jobId, title } = useLocalSearchParams<{ jobId: string; title?: string }>();
  const { token, user } = useAuth();
  const router = useRouter();

  const [input, setInput] = useState('');

  const { messages, loading, sending, sendMessage } = useChat({
    jobId: String(jobId),
    token,
    currentUser: user ? { id: user.id, firstName: user.firstName, lastName: user.lastName } : null,
  });

  const flatListRef = useRef<FlatList>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    try {
      await sendMessage(text);
    } catch {
      setInput(text); // restore on error
    }
  };

  const renderMessage = ({ item }: { item: ApiChatMessage }) => {
    const isOwn = item.senderId === user?.id;
    return (
      <View style={[styles.msgRow, isOwn && styles.msgRowOwn]}>
        {!isOwn && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.senderName?.[0] ?? '?').toUpperCase()}</Text>
          </View>
        )}
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          {!isOwn && <Text style={styles.senderName}>{item.senderName}</Text>}
          <Text style={[styles.bodyText, isOwn && styles.bodyTextOwn]}>{item.body}</Text>
          <Text style={[styles.timeText, isOwn && styles.timeTextOwn]}>
            {new Date(item.createdAt).toLocaleTimeString('lv-LV', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer standalone bg="#f2f2f7">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerBack}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color="#111827" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title ?? 'Čats'}
            </Text>
            <Text style={styles.headerSub}>Darba čats</Text>
          </View>
        </View>

        {/* Messages or states */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color="#111827" />
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
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Rakstiet ziņu..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f2f7' },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  headerBack: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  headerCenter: { flex: 1 },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  headerSub: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 1,
  },

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
    color: '#374151',
  },
  emptyHint: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Messages list
  list: {
    padding: 16,
    gap: 8,
    paddingBottom: 8,
  },

  // Message row
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    gap: 8,
  },
  msgRowOwn: {
    flexDirection: 'row-reverse',
  },

  // Avatar
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },

  // Bubbles
  bubble: {
    maxWidth: '72%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 3,
  },
  bubbleOwn: {
    backgroundColor: '#111827',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 2,
  },
  bodyText: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 21,
  },
  bodyTextOwn: {
    color: '#ffffff',
  },
  timeText: {
    fontSize: 10,
    color: '#9ca3af',
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  timeTextOwn: {
    color: 'rgba(255,255,255,0.5)',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    lineHeight: 20,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    backgroundColor: '#d1d5db',
  },
});
