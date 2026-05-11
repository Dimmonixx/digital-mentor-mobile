import { OPENAI_API_KEY } from '@/constants/config';
import { database } from '@/constants/firebase';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { get, off, onValue, push, ref, remove, set } from 'firebase/database';
import { TrendingUpDown } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Clipboard,
  FlatList,
  ImageBackground,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ADMIN_USERNAME = 'Dimmonix';

interface Message {
  id: string;
  username: string;
  text: string;
  timestamp: number;
  reactions?: { [emoji: string]: number };
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
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  console.log('insets.bottom:', insets.bottom);
  
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
    const messagesRef = ref(database, 'chat_messages');
    const unsubscribe = onValue(messagesRef, (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        const messageList: Message[] = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          username: value.username,
          text: value.text,
          timestamp: value.timestamp,
          reactions: value.reactions || {},
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
        setMessages(messageList);
      }
    });
    return () => off(messagesRef);
  };

  const getAIResponse = async (userMessage: string, history: Message[]) => {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          stream: false,
          messages: [
            {
              role: 'system',
              content: 'Ты AI наставник для зубных техников. Отвечай кратко и профессионально на русском языке.'
            },
            ...history.slice(-10).map(msg => ({
              role: msg.username === 'AI Наставник 🤖' ? 'assistant' : 'user',
              content: msg.text,
            })),
            { role: 'user', content: userMessage }
          ],
          max_tokens: 500,
        }),
      });
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI error:', error);
      return null;
    }
  };

  const sendMessage = async () => {
    if (newMessage.trim() && username.trim()) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const messagesRef = ref(database, 'chat_messages');
        await push(messagesRef, {
          username: username,
          text: newMessage.trim(),
          timestamp: Date.now(),
        });
        
        setAiThinking(true);
        const aiReply = await getAIResponse(newMessage.trim(), messages);
        setAiThinking(false);
        if (aiReply) {
          await push(messagesRef, {
            username: 'AI Наставник 🤖',
            text: aiReply,
            timestamp: Date.now() + 1,
            isAI: true,
          });
        }
        
        setNewMessage('');
      } catch (error) {
        console.error('Error sending message:', error);
        setAiThinking(false);
      }
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    const messageRef = ref(database, `chat_messages/${messageId}/reactions/${emoji}`);
    const snapshot = await get(messageRef);
    const current = snapshot.val() || 0;
    await set(messageRef, current + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const deleteMessage = async (messageId: string) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const messageRef = ref(database, `chat_messages/${messageId}`);
      await remove(messageRef);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.username === username;
    const timeString = new Date(item.timestamp).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});

    return (
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
          ]}>
            {!isMyMessage && (
              <Text style={styles.messageUsername}>{item.username}</Text>
            )}
            {item.username === 'AI Наставник 🤖' ? (
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
            ) : (
              <Text style={[
                styles.messageText,
                isMyMessage ? styles.myMessageText : styles.otherMessageText,
              ]}>
                {item.text}
              </Text>
            )}
            <Text style={[
              styles.messageTime,
              { textAlign: isMyMessage ? 'right' : 'left' }
            ]}>
              {timeString}
            </Text>
            {item.reactions && (
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
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" backgroundColor="#031427" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#f2ca50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Чат Техников</Text>
        <Ionicons name="person-circle" size={32} color="#f2ca50" />
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
            contentContainerStyle={[styles.messagesContainer, { paddingBottom: 128 }]}
            onContentSizeChange={scrollToBottom}
            onScroll={(event) => {
              const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
              const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
              setShowScrollButton(distanceFromBottom > 100);
            }}
            scrollEventThrottle={16}
            ListFooterComponent={aiThinking ? (
              <View style={styles.aiThinkingContainer}>
                <View style={styles.aiThinkingBubble}>
                  <Text style={styles.aiThinkingText}>AI думает...</Text>
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
            bottom: 105,
            right: 20,
            backgroundColor: '#f2ca50',
            borderRadius: 25,
            width: 44,
            height: 44,
            justifyContent: 'center',
            alignItems: 'center',
            elevation: 5,
          }}
          onPress={() => flatListRef.current?.scrollToEnd({ animated: true })}
        >
          <Ionicons name="chevron-down" size={24} color="#031427" />
        </TouchableOpacity>
      )}

      {/* Input Area */}
      <KeyboardStickyView 
        offset={{ closed: -25, opened: 0 }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        }}
      >
        <View style={[styles.inputContainer, { paddingBottom: 12 }]}>
          <View style={styles.inputWrapper}>
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
      </KeyboardStickyView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
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
  headerTitle: {
    color: '#f2ca50',
    fontSize: 20,
    fontWeight: 'bold',
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
    paddingBottom: 12,
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
});