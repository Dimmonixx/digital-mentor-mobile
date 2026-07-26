import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { get, off, onValue, ref, remove, set } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    AppState,
    Clipboard,
    FlatList,
    Image,
    ImageBackground,
    KeyboardAvoidingView,
    Modal,
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

const PRESET_AVATARS = [
  require('../assets/avatars/avatar_1.jpg'),
  require('../assets/avatars/avatar_2.jpg'),
  require('../assets/avatars/avatar_3.jpg'),
];

interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  messageType?: string;
  imageUri?: string;
  analysisData?: {
    vitaShade?: string;
    confidence?: number;
    photo_quality?: string;
    neck?: string;
    body?: string;
    edge?: string;
    effects?: string;
    features?: string;
    secondary_subtones?: string;
    zones?: any;
  };
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
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [partnerAvatar, setPartnerAvatar] = useState<{
    avatarType?: 'custom' | 'preset';
    avatarPresetId?: number;
    avatarUrl?: string;
  }>({});
  const [partnerLastSeen, setPartnerLastSeen] = useState<number>(0);
  const [fullscreenImageUri, setFullscreenImageUri] = useState<string | null>(null);
  const [expandedAnalysisIds, setExpandedAnalysisIds] = useState<Set<string>>(new Set());
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
    setShowScrollButton(false);

    // Сбрасываем unreadChatsCount для конкретного чата при входе
    (globalThis as any).resetChatUnread?.(chatId);

    // Обновляем lastSeenTimestamp при входе в чат
    if ((globalThis as any).updateChatLastSeen) {
      (globalThis as any).updateChatLastSeen(chatId);
    }

    // Записываем myLastSeen в Firebase для статуса прочтения партнёром
    const myLastSeenRef = ref(getFirebaseDB(), `users/${currentUserId}/chatLastSeen/${chatId}`);
    set(myLastSeenRef, Date.now());

    // Устанавливаем chatOpenedAt в globalThis при первом входе
    if (!(globalThis as any)[`chatOpenedAt_${chatId}`]) {
      (globalThis as any)[`chatOpenedAt_${chatId}`] = Date.now();
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
        messageType: value.messageType || 'text',
        imageUri: value.imageUri || '',
        analysisData: value.analysisData || undefined,
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
        // Обновляем myLastSeen в Firebase для статуса прочтения партнёром в реальном времени
        if (appState.current === 'active') {
          const myLastSeenRef = ref(getFirebaseDB(), `users/${currentUserId}/chatLastSeen/${chatId}`);
          set(myLastSeenRef, Date.now());
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
      const partnerId = currentUserId === doctorId ? technicianId : doctorId;
      (globalThis as any).clearPartnerUnread?.(partnerId);
      off(messagesRef, 'value', unsubscribe);
    };
  }, [chatId, currentUserId, doctorId, technicianId]);

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

  // Загрузка аватарки партнёра
  useEffect(() => {
    if (!partnerId) return;

    const loadPartnerAvatar = async () => {
      try {
        const profileRef = ref(getFirebaseDB(), `users/${partnerId}/profile`);
        const profileSnap = await get(profileRef);
        if (profileSnap.exists()) {
          const profileData = profileSnap.val();
          setPartnerAvatar({
            avatarType: profileData.avatarType,
            avatarPresetId: profileData.avatarPresetId,
            avatarUrl: profileData.avatarUrl,
          });
        }
      } catch (error) {
        console.error('Error loading partner avatar:', error);
      }
    };

    loadPartnerAvatar();
  }, [partnerId]);

  // Слушатель для partnerLastSeen
  useEffect(() => {
    if (!chatId || !partnerId) return;

    const lastSeenRef = ref(getFirebaseDB(), `users/${partnerId}/chatLastSeen/${chatId}`);
    const unsubscribe = onValue(lastSeenRef, (snapshot) => {
      if (snapshot.exists()) {
        setPartnerLastSeen(snapshot.val());
        // Принудительный ре-рендер для обновления звёздочек
        setMessages(prev => [...prev]);
      }
    });

    return () => off(lastSeenRef, 'value', unsubscribe);
  }, [chatId, partnerId]);

  const scrollToBottom = (animated = true) => {
    if (!userScrolledUp) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated });
      }, 100);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const messageRef = ref(getFirebaseDB(), `chat_messages/${chatId}/${messageId}`);
      await remove(messageRef);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const deleteAllChatMessages = async () => {
    try {
      const messagesRef = ref(getFirebaseDB(), `chat_messages/${chatId}`);
      await remove(messagesRef);
      setMessages([]);
      setShowMenu(false);
    } catch (error) {
      console.error('Error deleting all messages:', error);
    }
  };

  // Сокращённое имя партнёра с инициалами
  const getShortName = () => {
    if (!partnerName) return 'К';
    const parts = (partnerName || '').split(' ').filter(w => w.length > 0);
    const shortName = parts[0] + ' ' + parts[1]?.[0] + '.' + (parts[2] ? parts[2][0] + '.' : '');
    return shortName;
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
  const chatOpenedAt = (globalThis as any)[`chatOpenedAt_${chatId}`] || 0;
  const isRead = isMe && partnerLastSeen > 0 && item.timestamp < partnerLastSeen && partnerLastSeen > chatOpenedAt;
  const isAnalysis = item.messageType === 'color_analysis';

  if (isAnalysis) {
    return (
      <View style={[styles.messageRow, isMe ? styles.myRow : styles.partnerRow]}>
        <TouchableOpacity
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setSelectedMessage(item);
            setShowMenu(true);
          }}
          delayLongPress={500}
          activeOpacity={1}
          style={{ maxWidth: '78%' }}
        >
          <View style={{
            backgroundColor: '#0d0f14',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(242,202,80,0.4)',
            overflow: 'hidden',
          }}>
            {!isMe && (
              <Text style={[styles.messageSenderName, { paddingHorizontal: 12, paddingTop: 10 }]}>
                {getShortName()}
              </Text>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 8 }}>
              <Ionicons name="color-palette-outline" size={16} color="#f2ca50" />
              <Text style={{ color: '#f2ca50', fontSize: 13, fontWeight: '700' }}>Анализ цвета VITA</Text>
            </View>

            {!!item.imageUri && (
              <TouchableOpacity onPress={() => setFullscreenImageUri(item.imageUri!)} activeOpacity={0.9}>
                <Image
                  source={{ uri: item.imageUri }}
                  style={{ width: '100%', height: 140, marginTop: 8 }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}

            <View style={{ padding: 12 }}>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>
                {item.analysisData?.vitaShade || '—'}
              </Text>
              {typeof item.analysisData?.confidence === 'number' && (
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
                  Уверенность: {item.analysisData.confidence}%
                </Text>
              )}
              {!!item.analysisData?.photo_quality && (
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
                  Качество фото: {item.analysisData.photo_quality}
                </Text>
              )}

              {expandedAnalysisIds.has(item.id) && (
                <View style={{ marginTop: 10, gap: 10 }}>
                  {!!item.analysisData?.neck && (
                    <View>
                      <Text style={{ color: '#f2ca50', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                        Шейка (Пришеечная зона)
                      </Text>
                      <Text style={{ color: '#fff', fontSize: 13, lineHeight: 18, marginTop: 2 }}>
                        {item.analysisData.neck}
                      </Text>
                    </View>
                  )}
                  {!!item.analysisData?.body && (
                    <View>
                      <Text style={{ color: '#f2ca50', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                        Тело зуба (Центральная часть)
                      </Text>
                      <Text style={{ color: '#fff', fontSize: 13, lineHeight: 18, marginTop: 2 }}>
                        {item.analysisData.body}
                      </Text>
                    </View>
                  )}
                  {!!item.analysisData?.edge && (
                    <View>
                      <Text style={{ color: '#f2ca50', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                        Режущий край
                      </Text>
                      <Text style={{ color: '#fff', fontSize: 13, lineHeight: 18, marginTop: 2 }}>
                        {item.analysisData.edge}
                      </Text>
                    </View>
                  )}
                  {!!item.analysisData?.effects && (
                    <View>
                      <Text style={{ color: '#f2ca50', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                        Интенсивность и эффекты
                      </Text>
                      <Text style={{ color: '#fff', fontSize: 13, lineHeight: 18, marginTop: 2 }}>
                        {item.analysisData.effects}
                      </Text>
                    </View>
                  )}
                  {!!item.analysisData?.features && (
                    <View>
                      <Text style={{ color: '#f2ca50', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                        Особенности
                      </Text>
                      <Text style={{ color: '#fff', fontSize: 13, lineHeight: 18, marginTop: 2 }}>
                        {item.analysisData.features}
                      </Text>
                    </View>
                  )}
                  {!!item.analysisData?.secondary_subtones && (
                    <View>
                      <Text style={{ color: '#f2ca50', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                        Сопутствующие субтоны
                      </Text>
                      <Text style={{ color: '#fff', fontSize: 13, lineHeight: 18, marginTop: 2 }}>
                        {item.analysisData.secondary_subtones}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {!!(item.analysisData?.body || item.analysisData?.neck || item.analysisData?.edge) && (
                <TouchableOpacity
                  onPress={() => {
                    setExpandedAnalysisIds(prev => {
                      const next = new Set(prev);
                      if (next.has(item.id)) {
                        next.delete(item.id);
                      } else {
                        next.add(item.id);
                      }
                      return next;
                    });
                  }}
                  style={{ marginTop: 10 }}
                >
                  <Text style={{ color: '#f2ca50', fontSize: 12, fontWeight: '600' }}>
                    {expandedAnalysisIds.has(item.id) ? 'Свернуть' : 'Показать полное описание'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.timeRow, { paddingHorizontal: 12, paddingBottom: 8 }]}>
              <Text style={styles.timeText}>{formatTime(item.timestamp)}</Text>
              {isMe && (
                <Text style={[styles.readStatus, isRead ? styles.readStatusRead : styles.readStatusSent]}>
                  {isRead ? '★' : '✦'}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.messageRow, isMe ? styles.myRow : styles.partnerRow]}>
      <TouchableOpacity
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setSelectedMessage(item);
          setShowMenu(true);
        }}
        delayLongPress={500}
        activeOpacity={1}
        style={{ flex: 1 }}
      >
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.partnerBubble]}>
          {!isMe && (
            <Text style={styles.messageSenderName}>{getShortName()}</Text>
          )}
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.partnerMessageText]}>
            {item.text}
          </Text>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(item.timestamp)}</Text>
            {isMe && (
              <Text style={[styles.readStatus, isRead ? styles.readStatusRead : styles.readStatusSent]}>
                {isRead ? '★' : '✦'}
              </Text>
            )}
          </View>
        </View>
        </TouchableOpacity>
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
            {(() => {
              const getAvatarSource = () => {
                if (partnerAvatar.avatarType === 'custom' && partnerAvatar.avatarUrl) {
                  return { uri: partnerAvatar.avatarUrl };
                }
                if (partnerAvatar.avatarType === 'preset' && partnerAvatar.avatarPresetId) {
                  return PRESET_AVATARS[partnerAvatar.avatarPresetId - 1] || PRESET_AVATARS[0];
                }
                return null;
              };
              const avatarSource = getAvatarSource();
              const initial = (partnerName || 'К')[0].toUpperCase();
              
              return (
                <View style={styles.avatar}>
                  {avatarSource ? (
                    <Image source={avatarSource} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>{initial}</Text>
                  )}
                </View>
              );
            })()}
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {getShortName() || 'Коллега'}
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
            contentContainerStyle={[styles.listContent, { paddingBottom: inputAreaHeight + 16, paddingRight: 52 }]}
            automaticallyAdjustKeyboardInsets={true}
            keyboardDismissMode="on-drag"
            onContentSizeChange={() => scrollToBottom(true)}
            onScroll={(event) => {
              const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
              const distanceFromBottom = contentSize.height - (contentOffset.y || 0) - layoutMeasurement.height;
              if (distanceFromBottom > 100) {
                setUserScrolledUp(true);
                setShowScrollButton(true);
              } else if (distanceFromBottom < 50) {
                setUserScrolledUp(false);
                setShowScrollButton(false);
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

          {/* Scroll to bottom button */}
          {showScrollButton && (
            <TouchableOpacity
              style={styles.scrollButton}
              onPress={() => {
                flatListRef.current?.scrollToEnd({ animated: true });
                setShowScrollButton(false);
                setUserScrolledUp(false);
              }}
            >
              <Ionicons name="chevron-down" size={24} color="#031427" />
            </TouchableOpacity>
          )}

          {/* Context Menu Modal */}
          {showMenu && (
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'flex-end',
              paddingBottom: 100,
            }}>
              <TouchableOpacity 
                style={{flex:1}}
                onPress={() => setShowMenu(false)}
              />
              <View style={{
                marginHorizontal: 20,
                backgroundColor:'#0a1628', borderRadius:16, 
                borderWidth:1, borderColor:'#f2ca50', overflow:'hidden'
              }}>
                <View style={{flexDirection:'row', justifyContent:'space-around', 
                  padding:12, borderBottomWidth:1, borderBottomColor:'#f2ca5030'}}>
                  {['👍','❤️','🔥','😂','😮'].map(emoji => (
                    <TouchableOpacity key={emoji} onPress={() => {
                      // addReaction(selectedMessage!.id, emoji);
                      setShowMenu(false);
                    }}>
                      <Text style={{fontSize:28}}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={() => {
                  Clipboard.setString(selectedMessage?.text || '');
                  setShowMenu(false);
                }} style={{padding:16, flexDirection:'row', gap:12}}>
                  <Ionicons name="copy" size={20} color="#f2ca50"/>
                  <Text style={{color:'#ffffff', fontSize:16}}>Копировать</Text>
                </TouchableOpacity>
                <View style={{height:1, backgroundColor:'#f2ca5030'}}/>
                {selectedMessage?.senderId === currentUserId && (
                  <TouchableOpacity onPress={() => {
                    if(selectedMessage) deleteMessage(selectedMessage.id);
                    setShowMenu(false);
                  }} style={{padding:16, flexDirection:'row', gap:12}}>
                    <Ionicons name="trash" size={20} color="#ff4444"/>
                    <Text style={{color:'#ff4444', fontSize:16}}>Удалить</Text>
                  </TouchableOpacity>
                )}
                <View style={{height:1, backgroundColor:'#f2ca5030'}}/>
                <TouchableOpacity onPress={() => {
                  setShowMenu(false);
                  Alert.alert(
                    'Удалить все сообщения',
                    'Вы уверены? Это удалит всю историю чата.',
                    [
                      { text: 'Отмена', style: 'cancel' },
                      { text: 'Удалить', style: 'destructive', onPress: deleteAllChatMessages },
                    ]
                  );
                }} style={{padding:16, flexDirection:'row', gap:12}}>
                  <Ionicons name="trash-bin" size={20} color="#ff4444"/>
                  <Text style={{color:'#ff4444', fontSize:16}}>Удалить все в чате</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Полноэкранный просмотр фото ── */}
          <Modal
            visible={!!fullscreenImageUri}
            transparent
            animationType="fade"
            onRequestClose={() => setFullscreenImageUri(null)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
              <TouchableOpacity
                style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }}
                onPress={() => setFullscreenImageUri(null)}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              {!!fullscreenImageUri && (
                <Image
                  source={{ uri: fullscreenImageUri }}
                  style={{ width: '100%', height: '80%' }}
                  resizeMode="contain"
                />
              )}
            </View>
          </Modal>

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
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  messageAvatarContainer: {
    alignItems: 'center',
    marginRight: 8,
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  messageAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f2ca50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageAvatarText: {
    color: '#031427',
    fontSize: 12,
    fontWeight: 'bold',
  },
  messageAvatarName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    marginTop: 2,
  },
  messageSenderName: {
    color: '#f2ca50',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  readStatus: {
    fontSize: 11,
    marginLeft: 4,
  },
  readStatusRead: {
    color: '#f2ca50',
  },
  readStatusSent: {
    color: '#888',
  },
  scrollButton: {
    position: 'absolute',
    bottom: 130,
    right: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f2ca50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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
    backgroundColor: '#1a2a4a',
    borderWidth: 1.5,
    borderColor: '#f2ca50',
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
    color: '#ffffff',
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
