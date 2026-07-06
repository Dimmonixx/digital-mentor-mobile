import GlobalHeader from '@/components/global-header';
import { API_BASE_URL } from '@/constants/config';
import { getFirebaseDB } from '@/constants/firebase';
import { useAuth } from '@/hooks/useAuth';
import { executeWithAiLimit } from '@/services/aiRequestService';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { get, off, onValue, push, ref, remove, set } from 'firebase/database';
import { TrendingUpDown } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Clipboard,
    FlatList,
    Image,
    ImageBackground,
    Modal,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ADMIN_USERNAME = 'Dimmonix';

// Функция для сравнения дат (один и тот же день)
const isSameDay = (timestamp1: number, timestamp2: number): boolean => {
  const date1 = new Date(timestamp1);
  const date2 = new Date(timestamp2);
  return date1.getDate() === date2.getDate() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getFullYear() === date2.getFullYear();
};

// Форматирование даты для разделителя
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(timestamp, today.getTime())) {
    return 'Сегодня';
  } else if (isSameDay(timestamp, yesterday.getTime())) {
    return 'Вчера';
  } else {
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }
};

// Форматирование времени сессии
const formatSessionTime = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

interface Message {
  id: string;
  username: string;
  text: string;
  timestamp: number;
  reactions?: { [emoji: string]: number };
  photoURL?: string;
  isThinking?: boolean;
}

const AnimatedMessage = ({ children }: { children: React.ReactNode }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
};

export default function ChatScreen() {
  const { role: aiRole } = useLocalSearchParams<{ role?: string }>();
  const { user } = useAuth();
  const userId = user?.uid || user?.id || 'anonymous';
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [showUsernameInput, setShowUsernameInput] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [currentDiamonds, setCurrentDiamonds] = useState((globalThis as any).getDiamondBalance?.() ?? 0);
  const [aiDailyLimit, setAiDailyLimit] = useState<number>(() => (globalThis as any).getAiDailyLimit?.() ?? 0);
  const [onlineUsersCount, setOnlineUsersCount] = useState(0);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(0);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  
  // Animation for AI thinking text
  const thinkingOpacity = useRef(new Animated.Value(1)).current;
  
  // Animation for online indicator pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  
  useEffect(() => {
    if (aiThinking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(thinkingOpacity, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(thinkingOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      thinkingOpacity.setValue(1);
    }
  }, [aiThinking]);

  // Логика сессии AI чата - вынесена в отдельную функцию
  const checkSession = async () => {
    console.log('=== CHECK SESSION START ===', { userId, userEmail: user?.email, aiRole });
    console.log('=== CHECK SESSION ===', { userId, aiRole, sessionTimeLeft });
    const sessionKey = `ai_chat_session_${userId}_${aiRole}`;
    const lastSessionStr = await AsyncStorage.getItem(sessionKey);
    const lastSession = lastSessionStr ? parseInt(lastSessionStr, 10) : 0;
    const now = Date.now();
    const timeSinceLastSession = now - lastSession;
    const SESSION_DURATION = 300000; // 5 минут

    if (!lastSession || timeSinceLastSession > SESSION_DURATION) {
      // Прошло больше 5 минут или сессии нет - списываем энергию
      const allowed = await executeWithAiLimit(user?.email || '', async () => {
        await AsyncStorage.setItem(sessionKey, String(now));
        return true;
      });
      console.log('=== EXECUTE RESULT ===', { allowed });
      (globalThis as any).forceDiamondUpdate?.();
      if (!allowed) {
        return false;
      }
      setSessionTimeLeft(SESSION_DURATION);
    } else {
      // Меньше 5 минут - бесплатно
      const timeLeft = SESSION_DURATION - timeSinceLastSession;
      setSessionTimeLeft(timeLeft);
    }
    return true;
  };

  useEffect(() => {
    if (!userId || userId === 'anonymous') return;
    loadUsername();
    setupFirebaseListener();
    checkSession().then(allowed => {
      if (!allowed) router.back();
    });
  }, [userId, aiRole]);

  // Таймер сессии - уменьшает оставшееся время каждую секунду
  useEffect(() => {
    if (sessionTimeLeft <= 0) return;
    const interval = setInterval(() => {
      setSessionTimeLeft(prev => {
        const next = Math.max(0, prev - 1000);
        if (next === 0) {
          setTimeout(() => checkSession(), 500);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionTimeLeft]);

  // Синхронизация баланса алмазов с _layout (аналогично balance.tsx)
  useEffect(() => {
    setCurrentDiamonds((globalThis as any).getDiamondBalance?.() ?? 0);
    setAiDailyLimit((globalThis as any).getAiDailyLimit?.() ?? 15);
    const prev = (globalThis as any).forceDiamondUpdate;
    (globalThis as any).forceDiamondUpdate = () => {
      setCurrentDiamonds((globalThis as any).getDiamondBalance?.() ?? 0);
      setAiDailyLimit((globalThis as any).getAiDailyLimit?.() ?? 15);
      prev?.();
    };
    return () => {
      (globalThis as any).forceDiamondUpdate = prev;
    };
  }, []);

  // Подписка на онлайн-статус пользователей (вызывается после загрузки username)
  useEffect(() => {
    if (username) {
      const cleanup = setupOnlineStatus();
      return cleanup;
    }
  }, [username]);

  // Подписка на онлайн-статус пользователей
  const setupOnlineStatus = () => {
    const activeUsersRef = ref(getFirebaseDB(), 'chat_active_users');

    // Добавляем текущего пользователя в список активных
    const addUserToOnline = async () => {
      if (username) {
        const userRef = ref(getFirebaseDB(), `chat_active_users/${username}`);
        await set(userRef, {
          username: username,
          lastSeen: Date.now(),
        });
      }
    };

    // Удаляем текущего пользователя из списка активных при выходе
    const removeUserFromOnline = async () => {
      if (username) {
        const userRef = ref(getFirebaseDB(), `chat_active_users/${username}`);
        await remove(userRef);
      }
    };

    // Очищаем старые записи (старше 5 минут)
    const cleanupOldUsers = async () => {
      const snapshot = await get(activeUsersRef);
      if (snapshot.val()) {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        const users = snapshot.val();
        Object.keys(users).forEach(key => {
          if (users[key].lastSeen < fiveMinutesAgo) {
            remove(ref(getFirebaseDB(), `chat_active_users/${key}`));
          }
        });
      }
    };

    addUserToOnline();
    cleanupOldUsers();

    // Подписываемся на изменения списка активных пользователей
    const unsubscribe = onValue(activeUsersRef, (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        const activeUsers = Object.keys(data).length;
        setOnlineUsersCount(activeUsers);
      } else {
        setOnlineUsersCount(0);
      }
    });

    // Обновляем lastSeen каждые 2 минуты
    const heartbeatInterval = setInterval(() => {
      addUserToOnline();
    }, 2 * 60 * 1000);

    // При размонтировании компонента удаляем пользователя
    return () => {
      removeUserFromOnline();
      off(activeUsersRef);
      clearInterval(heartbeatInterval);
    };
  };

  // Подсчет активных пользователей (сообщения за последние 5 минут) - удалено, теперь используем реальный онлайн-статус

  useEffect(() => {
    scrollToBottom(true);
  }, [messages]);

  const loadUsername = async () => {
    try {
      const savedUsername = await AsyncStorage.getItem('chat_username');
      if (savedUsername) {
        setUsername(savedUsername);
      } else {
        setShowUsernameInput(true);
      }
    } catch (error) {
      console.error('Error loading username:', error);
      setShowUsernameInput(true);
    }
  };

  const saveUsername = async (name: string) => {
    try {
      await AsyncStorage.setItem('chat_username', name);
      setUsername(name);
      setShowUsernameInput(false);
    } catch (error) {
      console.error('Error saving username:', error);
    }
  };

  const setupFirebaseListener = () => {
    console.log('DEBUG userId:', userId, 'aiRole:', aiRole);
    const messagesRef = ref(getFirebaseDB(), `global_chat/${userId}/${aiRole || 'technician'}`);
    const unsubscribe = onValue(messagesRef, (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        const messageList: Message[] = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          username: value.username,
          text: value.text || '',
          timestamp: value.timestamp,
          reactions: value.reactions || {},
          photoURL: value.photoURL || null,
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
        setMessages(messageList);
      }
    });
    return () => off(messagesRef);
  };

  const getClaudeResponse = async (userMessage: string, history: Message[], userRole?: string) => {
    const formData = new FormData();
    formData.append('message', userMessage);
    const historyPayload = history.slice(-10).map(msg => ({
      role: msg.username === 'ИИ-Ассистент 🤖' ? 'assistant' : 'user',
      content: msg.text,
    }));
    formData.append('history', JSON.stringify(historyPayload));
    formData.append('role', userRole === 'doctor' ? 'doctor' : 'technician');
    const res = await fetch(`${API_BASE_URL}/chat-ai`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json() as { success: boolean; result?: string; error?: string };
    if (!data.success) throw new Error(data.error ?? 'Ошибка ИИ-ассистента');
    return data.result ?? null;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !username.trim()) return;
    const text = newMessage.trim();
    setNewMessage('');
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const messagesRef = ref(getFirebaseDB(), `global_chat/${userId}/${aiRole || 'technician'}`);
      await push(messagesRef, {
        username: username,
        text,
        timestamp: Date.now(),
      });

      if (aiRole === 'doctor' || aiRole === 'technician') {
        // Проверяем сессию перед отправкой запроса к ИИ
        console.log('=== SEND MESSAGE SESSION CHECK ===', { sessionTimeLeft });
        if (sessionTimeLeft <= 0) {
          const allowed = await checkSession();
          if (!allowed) {
            return;
          }
        }

        setAiThinking(true);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
        const aiReply = await getClaudeResponse(text, messages, aiRole);
        setAiThinking(false);
        if (aiReply) {
          await push(messagesRef, {
            username: 'ИИ-Ассистент 🤖',
            text: aiReply,
            timestamp: Date.now() + 1,
            isAI: true,
          });
          setUserScrolledUp(false);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setAiThinking(false);
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    const messageRef = ref(getFirebaseDB(), `global_chat/${userId}/${aiRole || 'technician'}/${messageId}/reactions/${emoji}`);
    const snapshot = await get(messageRef);
    const current = snapshot.val() || 0;
    await set(messageRef, current + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const deleteMessage = async (messageId: string) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const messageRef = ref(getFirebaseDB(), `global_chat/${userId}/${aiRole || 'technician'}/${messageId}`);
      await remove(messageRef);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const deleteAllChatMessages = async () => {
    try {
      const messagesRef = ref(getFirebaseDB(), `global_chat/${userId}/${aiRole || 'technician'}`);
      await remove(messagesRef);
      setMessages([]);
      setShowMenu(false);
    } catch (error) {
      console.error('Error deleting all messages:', error);
    }
  };

  const sendPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    
    if (!result.canceled && result.assets[0]) {
      try {
        const base64 = result.assets[0].base64;
        
        const formData = new FormData();
        formData.append('key', 'baf4665c8590576c2b7b1b4cfa2502e3');
        formData.append('image', base64 as string);
        
        const response = await fetch('https://api.imgbb.com/1/upload', {
          method: 'POST',
          body: formData,
        });
        
        const data = await response.json();
        console.log('ImgBB response:', JSON.stringify(data));
        const photoURL = data.data?.url;
        
        if (!photoURL) {
          console.error('ImgBB error:', data);
          return;
        }
        
        const messagesRef = ref(getFirebaseDB(), `global_chat/${userId}/${aiRole || 'technician'}`);
        await push(messagesRef, {
          username: username,
          text: '',
          photoURL: photoURL,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error('Photo upload error:', error);
      }
    }
  };

  const scrollToBottom = (animated = true) => {
    if (!userScrolledUp) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated });
      }, 100);
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    // Индикатор "AI думает..." — рендерим как псевдо-сообщение внутри списка
    if (item.isThinking) {
      return (
        <AnimatedMessage>
          <View style={[styles.messageContainer, styles.otherMessageContainer]}>
            <View style={[styles.messageBubble, styles.otherMessageBubble]}>
              <Text style={styles.messageUsername}>ИИ-Ассистент 🤖</Text>
              <Animated.Text style={[styles.aiThinkingText, { opacity: thinkingOpacity }]}>
                Печатает...
              </Animated.Text>
            </View>
          </View>
        </AnimatedMessage>
      );
    }

    const isMyMessage = item.username === username;
    const timeString = new Date(item.timestamp).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});

    // Проверяем, нужно ли показывать разделитель даты
    const showDateSeparator = index === 0 || !isSameDay(item.timestamp, messages[index - 1].timestamp);

    return (
      <>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>{formatDate(item.timestamp)}</Text>
          </View>
        )}
        <AnimatedMessage>
          <TouchableOpacity
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setSelectedMessage(item);
            setShowMenu(true);
          }}
          delayLongPress={500}
          activeOpacity={isMyMessage ? 0.7 : 1}
          style={[
            styles.messageContainer,
            isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
          ]}
        >
          <View style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
            item.photoURL && !item.text ? { backgroundColor: 'transparent', padding: 0 } : {}
          ]}>
            {!isMyMessage && (
              <Text style={styles.messageUsername}>{item.username}</Text>
            )}
            {item.photoURL && (
              <View style={{position:'relative'}}>
                <TouchableOpacity onPress={() => setSelectedPhoto(item.photoURL!)}>
                  <Image
                    source={{ uri: item.photoURL }}
                    style={{
                      width: 220,
                      height: 220,
                      borderRadius: 12
                    }}
                    resizeMode="cover"
                    onError={(e) => console.log('Image error:', e.nativeEvent.error)}
                    onLoad={() => console.log('Image loaded!')}
                  />
                </TouchableOpacity>
                <Text style={{
                  position:'absolute',
                  bottom: 8,
                  right: 8,
                  color:'#ffffff',
                  fontSize: 11,
                  backgroundColor:'rgba(0,0,0,0.4)',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 8,
                }}>
                  {timeString}
                </Text>
              </View>
            )}
            {!item.photoURL && item.username === 'ИИ-Ассистент 🤖' ? (
              <Markdown style={{
                body: { color: '#ffffff', fontSize: 15, backgroundColor: 'transparent' },
                strong: { color: '#f2ca50' },
                bullet_list: { color: '#ffffff' },
                ordered_list: { color: '#ffffff' },
                code_inline: { backgroundColor: 'transparent', color: '#f2ca50', borderRadius: 4 },
                fence: { backgroundColor: 'transparent', borderRadius: 8 },
                heading1: { color: '#f2ca50' },
                heading2: { color: '#f2ca50' },
                paragraph: { color: '#ffffff', marginTop: 0, marginBottom: 4 },
              }}>
                {item.text}
              </Markdown>
            ) : !item.photoURL && (
              <Text style={[
                styles.messageText,
                isMyMessage ? styles.myMessageText : styles.otherMessageText,
              ]}>
                {item.text}
              </Text>
            )}
            {!item.photoURL && (
              <Text style={[
                styles.messageTime,
                { textAlign: isMyMessage ? 'right' : 'left', marginTop: 8 }
              ]}>
                {timeString}
              </Text>
            )}
            {item.reactions && Object.keys(item.reactions).length > 0 && (
              <View style={{
                position: 'absolute',
                bottom: 4,
                right: 4,
                flexDirection: 'row',
                flexWrap: 'wrap'
              }}>
                {Object.entries(item.reactions).map(([emoji, count]) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => addReaction(item.id, emoji)}
                    style={{
                      flexDirection: 'row',
                      backgroundColor: 'transparent',
                      borderRadius: 12,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      marginRight: 4,
                      marginBottom: 4,
                      borderWidth: 1,
                      borderColor: '#ffffff20'
                    }}>
                    <Text style={{fontSize: 14, color: '#ffffff'}}>{emoji} {count as number}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </AnimatedMessage>
      </>
    );
  };

  if (showUsernameInput) {
    return (
      <ImageBackground
        source={require('@/assets/images/background.png')}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <StatusBar barStyle="light-content" backgroundColor="#031427" />
        <View style={styles.usernameSetup}>
          <Text style={styles.usernameTitle}>Введите ваше имя</Text>
          <TextInput
            style={styles.usernameInput}
            placeholder="Ваше имя"
            placeholderTextColor="#ffffff60"
            value={username}
            onChangeText={setUsername}
            maxLength={20}
          />
          <TouchableOpacity
            style={styles.usernameButton}
            onPress={() => saveUsername(username)}
            disabled={!username.trim()}
          >
            <Text style={styles.usernameButtonText}>Продолжить</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{flex:1}}>
      <ImageBackground
        source={require('@/assets/images/background.png')}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        {/* Header — такой же как на главной */}
        <GlobalHeader
          diamonds={currentDiamonds}
          aiDailyLimit={aiDailyLimit}
        />

        {/* Chat sub-bar: назад */}
        <View style={styles.chatSubBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.chatBackButton}>
            <Ionicons name="arrow-back" size={24} color="#f2ca50" />
          </TouchableOpacity>
          {sessionTimeLeft > 0 && (
            <Text style={styles.sessionTimer}>⚡-1 • {formatSessionTime(sessionTimeLeft)}</Text>
          )}
        </View>

        {/* Messages List + Input Area */}
        <View style={{ flex: 1, flexDirection: 'column' }}>
          {messages.length === 0 && !aiThinking ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles" size={60} color="#f2ca5080" />
              <Text style={styles.emptyStateTitle}>Начните общение</Text>
              <Text style={styles.emptyStateSubtitle}>Задайте вопрос AI наставнику</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={aiThinking ? [...messages, { id: '__thinking__', username: 'ИИ-Ассистент 🤖', text: '', timestamp: Date.now(), isThinking: true }] : messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              contentContainerStyle={styles.messagesContainer}
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
              ListFooterComponent={null}
            />
          )}

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
        <Modal visible={showMenu} transparent animationType="fade">
          <TouchableOpacity 
            style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)'}}
            onPress={() => setShowMenu(false)}
          >
            <View style={{
              position:'absolute', bottom: 100, alignSelf:'center',
              backgroundColor:'#0a1628', borderRadius:16, 
              borderWidth:1, borderColor:'#f2ca50', overflow:'hidden'
            }}>
              <View style={{flexDirection:'row', justifyContent:'space-around', 
                padding:12, borderBottomWidth:1, borderBottomColor:'#f2ca5030'}}>
                {['👍','❤️','🔥','😂','😮'].map(emoji => (
                  <TouchableOpacity key={emoji} onPress={() => {
                    addReaction(selectedMessage!.id, emoji);
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
              <TouchableOpacity onPress={() => {
                if(selectedMessage) deleteMessage(selectedMessage.id);
                setShowMenu(false);
              }} style={{padding:16, flexDirection:'row', gap:12}}>
                <Ionicons name="trash" size={20} color="#ff4444"/>
                <Text style={{color:'#ff4444', fontSize:16}}>Удалить</Text>
              </TouchableOpacity>
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
          </TouchableOpacity>
        </Modal>


        {/* Input Area */}
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 24 }]}>
          <View style={styles.inputWrapper}>
            <TouchableOpacity 
              onPress={sendPhoto} 
              style={{ paddingHorizontal: 8 }}
            >
              <Ionicons name="image-outline" size={24} color="#f2ca50" />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              placeholder="Сообщение..."
              placeholderTextColor="#ffffff60"
              value={newMessage}
              onChangeText={setNewMessage}
              maxLength={500}
              multiline={true}
            />
            <TouchableOpacity
              style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!newMessage.trim()}
            >
              <TrendingUpDown size={24} color="#031427" />
            </TouchableOpacity>
          </View>
        </View>
        </View>

        {/* Photo Modal */}
        <Modal visible={!!selectedPhoto} transparent animationType="fade">
          <TouchableOpacity 
            style={{flex:1, backgroundColor:'rgba(0,0,0,0.9)', justifyContent:'center', alignItems:'center'}}
            onPress={() => setSelectedPhoto(null)}
          >
            <Image 
              source={{uri: selectedPhoto || ''}} 
              style={{width:'100%', height:'70%'}}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </Modal>
      </ImageBackground>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  chatSubBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(242, 202, 80, 0.12)',
    backgroundColor: 'rgba(13, 17, 26, 0.6)',
  },
  chatSubBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatBackButton: {
    paddingRight: 10,
  },
  sessionTimer: {
    color: '#f2ca50',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  chatOnlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  chatOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  chatOnlineText: {
    color: '#f2ca50',
    fontSize: 12,
    fontWeight: '700',
  },
  chatAiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chatAiLabel: {
    color: '#8e9bb0',
    fontSize: 12,
    marginRight: 8,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#031427',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f2ca5030',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4caf50',
  },
  onlineText: {
    color: '#ffffff',
    fontSize: 12,
    opacity: 0.8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconBtn: {
    padding: 4,
  },
  usernameSetup: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  usernameTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  usernameInput: {
    backgroundColor: '#ffffff10',
    color: '#ffffff',
    fontSize: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f2ca50',
    width: '100%',
    marginBottom: 20,
  },
  usernameButton: {
    backgroundColor: '#f2ca50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  usernameButtonText: {
    color: '#031427',
    fontSize: 16,
    fontWeight: '600',
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  messageContainer: {
    marginVertical: 4,
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  myMessageBubble: {
    backgroundColor: '#8B6914',
  },
  otherMessageBubble: {
    backgroundColor: '#1a1a1a',
  },
  messageUsername: {
    color: '#f2ca50',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#ffffff',
  },
  inputContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  inputWrapper: {
    backgroundColor: '#0a1628',
    borderWidth: 1,
    borderColor: '#f2ca50',
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    paddingHorizontal: 4,
    minHeight: 44,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: '#f2ca50',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#f2ca5050',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    color: '#ffffff40',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    color: '#ffffff30',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  messageTime: {
    color: '#ffffff50',
    fontSize: 11,
    marginTop: 4,
  },
  aiThinkingText: {
    color: '#f2ca50',
    fontSize: 14,
  },
  aiThinkingContainer: {
    alignItems: 'flex-start',
    marginVertical: 4,
    paddingHorizontal: 20,
  },
  aiThinkingBubble: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  dateSeparator: {
    alignSelf: 'center',
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginVertical: 8,
  },
  dateSeparatorText: {
    color: '#f2ca50',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollButton: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f2ca50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});