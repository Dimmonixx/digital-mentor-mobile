import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { off, onValue, ref } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    AppState,
    FlatList,
    ImageBackground,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getFirebaseDB } from '@/constants/firebase';
import { useAuth } from '@/hooks/useAuth';
import { playSuccessSound } from '@/utils/audio';

const API_BASE = 'http://62.238.13.160:8000';

interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

export default function PartnerChatScreen() {
  const insets = useSafeAreaInsets();
  const { user, role } = useAuth();
  const { partnerId, partnerName, partnerRole } = useLocalSearchParams<{
    partnerId: string;
    partnerName: string;
    partnerRole: string;
  }>();

  const [chatId, setChatId] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [inputAreaHeight, setInputAreaHeight] = useState(80);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const appState = useRef(AppState.currentState);
  const flatListRef = useRef<FlatList>(null);
  const localLastSeenTimestamp = useRef(Date.now());

  const currentUserId = user?.uid || user?.id || '';

  const { doctorId, technicianId } = (() => {
    if (role === 'doctor') {
      return { doctorId: currentUserId, technicianId: partnerId };
    }
    return { doctorId: partnerId, technicianId: currentUserId };
  })();

  useEffect(() => {
    if (!currentUserId || !partnerId || !role) return;

    let cancelled = false;

    const initChat = async () => {
      try {
        setChatLoading(true);
        setChatError(null);

        const response = await fetch(`${API_BASE}/chat/get-or-create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doctor_id: doctorId, technician_id: technicianId }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const detail = data.detail || `Ошибка ${response.status}`;
          if (!cancelled) setChatError(detail);
          return;
        }

        if (!cancelled && data.chat_id) {
          setChatId(data.chat_id);
        }
      } catch (e) {
        console.error('[partner-chat] initChat error:', e);
        if (!cancelled) setChatError('Не удалось подключиться к серверу чата');
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    };

    initChat();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, partnerId, role, doctorId, technicianId]);

  useEffect(() => {
    if (!chatId) return;

    // Устанавливаем флаг что мы в чате (сохраняем chatId)
    (globalThis as any).isInPartnerChat = chatId;

    // Сбрасываем unreadChatsCount для конкретного чата при входе
    (globalThis as any).resetChatUnread?.(chatId);

    // Обновляем lastSeenTimestamp при входе в чат
    if ((globalThis as any).updateChatLastSeen) {
      (globalThis as any).updateChatLastSeen(chatId);
    }

    const messagesRef = ref(getFirebaseDB(), `chat_messages/${chatId}`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setMessages([]);
        return;
      }
      const list: ChatMessage[] = Object.entries(data).map(([id, value]: [string, any]) => ({
        id,
        senderId: value.senderId || '',
        text: value.text || '',
        timestamp: value.timestamp || 0,
      }));
      list.sort((a, b) => a.timestamp - b.timestamp);
      
      // Check if new message from partner
      const lastMessage = list[list.length - 1];
      if (lastMessage && lastMessage.senderId !== currentUserId && lastMessage.timestamp > localLastSeenTimestamp.current) {
        localLastSeenTimestamp.current = lastMessage.timestamp;
        // Звук только если приложение не активно, иначе вибрация
        if (appState.current !== 'active') {
          playSuccessSound();
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        // Обновляем lastSeen если приложение активно - предотвратит бейдж при выходе
        if (appState.current === 'active' && (globalThis as any).updateChatLastSeen) {
          (globalThis as any).updateChatLastSeen(chatId);
        }
      }
      
      setMessages(list);
      
      // Принудительный скролл вниз при открытии экрана
      if (list.length > 0) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
      }
    });

    return () => {
      // Сбрасываем флаг при выходе
      (globalThis as any).isInPartnerChat = null;
      off(messagesRef, 'value', unsubscribe);
    };
  }, [chatId, currentUserId, userScrolledUp]);

  // AppState listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: any) => {
      appState.current = nextAppState as any;
      if (nextAppState === 'active' && chatId && (globalThis as any).updateChatLastSeen) {
        (globalThis as any).updateChatLastSeen(chatId);
      }
    });

    return () => subscription.remove();
  }, [chatId]);

  const scrollToBottom = (animated = true) => {
    if (!userScrolledUp) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated });
      }, 100);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !chatId || !currentUserId) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const response = await fetch(`${API_BASE}/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          sender_id: currentUserId,
          text,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail = data.detail || `Ошибка ${response.status}`;
        console.error('[partner-chat] send error:', detail);
        Alert.alert('Ошибка отправки', detail);
        setInputText(text);
      } else {
        // Обновляем lastSeen после успешной отправки
        if ((globalThis as any).updateChatLastSeen) {
          (globalThis as any).updateChatLastSeen(chatId);
        }
        // Сбрасываем флаг скролла и скроллим вниз
        setUserScrolledUp(false);
        scrollToBottom(true);
      }
    } catch (e) {
      console.error('[partner-chat] send exception:', e);
      Alert.alert('Ошибка отправки', 'Не удалось отправить сообщение. Проверьте соединение.');
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === currentUserId;
    return (
      <View style={[styles.messageRow, isMe ? styles.myRow : styles.partnerRow]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.partnerBubble]}>
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.partnerMessageText]}>
            {item.text}
          </Text>
          <Text style={styles.timeText}>{formatTime(item.timestamp)}</Text>
        </View>
      </View>
    );
  };

  if (chatLoading) {
    return (
      <View style={styles.container}>
        <ImageBackground
          source={require('@/assets/images/background.png')}
          style={styles.background}
          resizeMode="cover"
        >
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#f2ca50" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {partnerName || 'Коллега'}
            </Text>
            <View style={styles.backButton} />
          </View>
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#f2ca50" />
            <Text style={styles.hintText}>Подключение к серверу чата...</Text>
          </View>
        </ImageBackground>
      </View>
    );
  }

  if (chatError) {
    return (
      <View style={styles.container}>
        <ImageBackground
          source={require('@/assets/images/background.png')}
          style={styles.background}
          resizeMode="cover"
        >
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#f2ca50" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {partnerName || 'Коллега'}
            </Text>
            <View style={styles.backButton} />
          </View>
          <View style={styles.center}>
            <Ionicons name="warning-outline" size={48} color="#f2ca50" />
            <Text style={styles.errorText}>{chatError}</Text>
            <Text style={styles.hintText}>Возможно, партнёрство не активно.</Text>
          </View>
        </ImageBackground>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground
        source={require('@/assets/images/background.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#f2ca50" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(partnerName || 'К')[0].toUpperCase()}</Text>
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {partnerName || 'Коллега'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {partnerRole === 'doctor' ? 'Врач' : partnerRole === 'technician' ? 'Техник' : 'Коллега'}
              </Text>
            </View>
          </View>
          <View style={styles.backButton} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listContent, { paddingBottom: inputAreaHeight + 16 }]}
            automaticallyAdjustKeyboardInsets={true}
            keyboardDismissMode="on-drag"
            onContentSizeChange={() => scrollToBottom(true)}
            onScroll={(event) => {
              const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
              const distanceFromBottom = contentSize.height - (contentOffset.y || 0) - layoutMeasurement.height;
              if (distanceFromBottom > 100) {
                setUserScrolledUp(true);
              } else if (distanceFromBottom < 50) {
                setUserScrolledUp(false);
              }
            }}
            scrollEventThrottle={16}
            ListEmptyComponent={(
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={56} color="#f2ca5080" />
                <Text style={styles.emptyTitle}>Начните диалог</Text>
                <Text style={styles.emptySubtitle}>Отправьте первое сообщение коллеге</Text>
              </View>
            )}
          />

          <View
            onLayout={(e) => setInputAreaHeight(e.nativeEvent.layout.height)}
            style={[styles.inputArea, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}
          >
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder="Сообщение..."
                placeholderTextColor="#ffffff60"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={!inputText.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#031427" />
                ) : (
                  <Ionicons name="send" size={20} color="#031427" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#031427',
  },
  background: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f2ca50',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f2ca50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#031427',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: '#f2ca50',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    color: '#f2ca50',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  hintText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 80,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 6,
  },
  messageRow: {
    width: '100%',
    marginBottom: 10,
  },
  myRow: {
    alignItems: 'flex-end',
  },
  partnerRow: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myBubble: {
    backgroundColor: '#f2ca50',
    borderBottomRightRadius: 4,
  },
  partnerBubble: {
    backgroundColor: '#1a2233',
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.2)',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#031427',
  },
  partnerMessageText: {
    color: '#ffffff',
  },
  timeText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  inputArea: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: 'rgba(3,20,39,0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(242,202,80,0.15)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a1628',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f2ca50',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  textInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    maxHeight: 100,
    minHeight: 40,
    paddingTop: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f2ca50',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#f2ca5060',
  },
});
