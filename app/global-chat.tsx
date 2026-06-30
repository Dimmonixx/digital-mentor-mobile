import GlobalHeader from '@/components/global-header';
import { API_BASE_URL } from '@/constants/config';
import { getFirebaseDB } from '@/constants/firebase';
import { executeWithAiLimit } from '@/services/aiRequestService';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router } from 'expo-router';
import { get, off, onValue, push, ref, remove, set } from 'firebase/database';
import { TrendingUpDown } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Clipboard,
    FlatList,
    Image,
    ImageBackground,
    Modal,
    StatusBar,
    StyleSheet,
    Switch,
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

interface Message {
  id: string;
  username: string;
  text: string;
  timestamp: number;
  reactions?: { [emoji: string]: number };
  photoURL?: string;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [showUsernameInput, setShowUsernameInput] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiAssistantEnabled, setAiAssistantEnabled] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [currentDiamonds, setCurrentDiamonds] = useState((globalThis as any).getDiamondBalance?.() ?? 0);
  const [aiDailyLimit, setAiDailyLimit] = useState<number>((globalThis as any).getAiDailyLimit?.() ?? 15);
  const [onlineUsersCount, setOnlineUsersCount] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  
  // Animation for AI thinking text
  const thinkingOpacity = useRef(new Animated.Value(1)).current;
  
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

  useEffect(() => {
    loadUsername();
    setupFirebaseListener();
  }, []);

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
    scrollToBottom();
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
    const messagesRef = ref(getFirebaseDB(), 'chat_messages');
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
      const messagesRef = ref(getFirebaseDB(), 'chat_messages');
      await push(messagesRef, {
        username: username,
        text,
        timestamp: Date.now(),
      });

      if (aiAssistantEnabled) {
        const rawUser = await AsyncStorage.getItem('user');
        const userObj = rawUser ? JSON.parse(rawUser) : null;
        const userEmail = userObj?.email || '';
        const userRole = userObj?.role || 'technician';
        setAiThinking(true);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        const aiReply = await executeWithAiLimit(userEmail, () => getClaudeResponse(text, messages, userRole));
        setAiThinking(false);
        if (aiReply) {
          await push(messagesRef, {
            username: 'ИИ-Ассистент 🤖',
            text: aiReply,
            timestamp: Date.now() + 1,
            isAI: true,
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setAiThinking(false);
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    const messageRef = ref(getFirebaseDB(), `chat_messages/${messageId}/reactions/${emoji}`);
    const snapshot = await get(messageRef);
    const current = snapshot.val() || 0;
    await set(messageRef, current + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const deleteMessage = async (messageId: string) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const messageRef = ref(getFirebaseDB(), `chat_messages/${messageId}`);
      await remove(messageRef);
    } catch (error) {
      console.error('Error deleting message:', error);
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
        
        const messagesRef = ref(getFirebaseDB(), 'chat_messages');
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

  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
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
                body: { color: '#ffffff', fontSize: 15 },
                strong: { color: '#f2ca50' },
                bullet_list: { color: '#ffffff' },
                ordered_list: { color: '#ffffff' },
                code_inline: { backgroundColor: '#ffffff20', color: '#f2ca50', borderRadius: 4 },
                fence: { backgroundColor: '#ffffff10', borderRadius: 8 },
                heading1: { color: '#f2ca50' },
                heading2: { color: '#f2ca50' },
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
                      backgroundColor: '#ffffff15',
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
    <View style={{flex:1}}>
      <Stack.Screen options={{ headerShown: false }} />
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

        {/* Chat sub-bar: назад + онлайн + ИИ режим */}
        <View style={styles.chatSubBar}>
          <View style={styles.chatSubBarLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.chatBackButton}>
              <Ionicons name="arrow-back" size={24} color="#f2ca50" />
            </TouchableOpacity>
            <View style={styles.chatOnlineRow}>
              <View style={styles.chatOnlineDot} />
              <Text style={styles.chatOnlineText}>{onlineUsersCount} онлайн</Text>
            </View>
          </View>
          <View style={styles.chatAiRow}>
            <Text style={styles.chatAiLabel}>ИИ</Text>
            <Switch
              value={aiAssistantEnabled}
              onValueChange={setAiAssistantEnabled}
              trackColor={{ false: '#1a2233', true: '#f2ca50' }}
              thumbColor={aiAssistantEnabled ? '#ffffff' : '#a0a0a0'}
              ios_backgroundColor="#1a2233"
            />
          </View>
        </View>

        {/* Messages List */}
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles" size={60} color="#f2ca5080" />
            <Text style={styles.emptyStateTitle}>Начните общение</Text>
            <Text style={styles.emptyStateSubtitle}>Задайте вопрос AI наставнику</Text>
          </View>
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              style={styles.messagesList}
              contentContainerStyle={[styles.messagesContainer, { paddingBottom: 160 }]}
              onContentSizeChange={scrollToBottom}
              onScroll={(event) => {
                const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
                const distanceFromBottom = contentSize.height - (contentOffset.y || 0) - layoutMeasurement.height;
                setShowScrollButton(distanceFromBottom > 100);
              }}
              scrollEventThrottle={16}
              ListFooterComponent={aiThinking ? (
                <View style={styles.aiThinkingContainer}>
                  <View style={styles.aiThinkingBubble}>
                    <Animated.Text style={[styles.aiThinkingText, { opacity: thinkingOpacity }]}>
                      AI думает...
                    </Animated.Text>
                  </View>
                </View>
              ) : null}
            />
          </>
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
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Scroll Down Button */}
        {showScrollButton && (
          <TouchableOpacity
            style={{
              position: 'absolute',
              bottom: 150,
              right: 20,
              backgroundColor: '#f2ca50',
              borderRadius: 25,
              width: 44,
              height: 44,
              justifyContent: 'center',
              alignItems: 'center',
              elevation: 5,
              zIndex: 9999,
            }}
            onPress={() => flatListRef.current?.scrollToEnd({ animated: true })}
          >
            <Ionicons name="chevron-down" size={24} color="#031427" />
          </TouchableOpacity>
        )}

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
  chatOnlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  chatOnlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  chatOnlineText: {
    color: '#4CAF50',
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
});