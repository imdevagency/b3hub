import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Send } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiSupportMessage } from '@/lib/api/chat';
import { colors, spacing, radius } from '@/lib/theme';

// ── Bubble ────────────────────────────────────────────────────────────────

function Bubble({ msg, myId }: { msg: ApiSupportMessage; myId: string }) {
  const isMe = !msg.fromAdmin;
  const time = new Date(msg.createdAt).toLocaleTimeString('lv-LV', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={[s.bubbleRow, isMe && s.bubbleRowMe]}>
      <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}>
        {!isMe && <Text style={s.bubbleSender}>{msg.senderName}</Text>}
        <Text style={[s.bubbleText, isMe && s.bubbleTextMe]}>{msg.body}</Text>
        <Text style={[s.bubbleTime, isMe && s.bubbleTimeMe]}>{time}</Text>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function SupportChatScreen() {
  const { token, user } = useAuth();

  const [messages, setMessages] = useState<ApiSupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchMessages = useCallback(async () => {
    if (!token) return;
    try {
      const result = await api.support.getMessages(token);
      setMessages(result.messages);
    } catch {
      // silently ignore poll errors
    }
  }, [token]);

  // Initial load — auto-create thread & fetch messages
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const thread = await api.support.getOrCreate(token);
        setMessages(thread.messages);
      } catch {
        // fallback to fetch
        await fetchMessages();
      } finally {
        setLoading(false);
      }
    })();
  }, [token, fetchMessages]);

  // Poll for new messages every 5 s
  useEffect(() => {
    if (!token) return;
    pollRef.current = setInterval(fetchMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [token, fetchMessages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body || sending || !token) return;
    setSending(true);
    setText('');
    try {
      const msg = await api.support.sendMessage(body, token);
      setMessages((prev) => [...prev, msg]);
    } catch {
      setText(body); // restore on error
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer standalone bg={colors.bgScreen} topBg="#111827">
        <ScreenHeader title="Atbalsts" />
        <View style={s.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer standalone bg={colors.bgScreen} topBg="#111827">
      <ScreenHeader title="Atbalsts" />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <Bubble msg={item} myId={user?.id ?? ''} />}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>
                Uzdodiet savu jautājumu — atbalsta komanda atbildēs darba laikā.
              </Text>
            </View>
          }
        />

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="Rakstiet ziņojumu…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={2000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
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

// ── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { paddingHorizontal: spacing.base, paddingTop: spacing.base, paddingBottom: spacing.sm },

  bubbleRow: { marginBottom: spacing.sm, alignItems: 'flex-start' },
  bubbleRowMe: { alignItems: 'flex-end' },

  bubble: {
    maxWidth: '80%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleOther: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  bubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleSender: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 2,
  },
  bubbleText: { fontSize: 14, color: '#111827', lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: { fontSize: 11, color: colors.textMuted, marginTop: 4, textAlign: 'right' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.7)' },

  empty: { flex: 1, paddingTop: 60, alignItems: 'center', paddingHorizontal: spacing.xl },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#F4F5F7',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: '#111827',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
});
