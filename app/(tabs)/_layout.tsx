import { Ionicons } from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Redirect, Tabs } from 'expo-router';

import * as Haptics from 'expo-haptics';

import { getFirebaseDB, getFirebaseFirestore } from '@/constants/firebase';
import { query as dbQuery, equalTo, get, off, onValue, orderByChild, ref } from 'firebase/database';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import React, { useEffect, useRef, useState } from 'react';

import { Dimensions, ImageBackground, StatusBar, StyleSheet, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';



import { HapticTab } from '@/components/haptic-tab';

import GlobalHeader from '@/components/global-header';

import AiLimitModal from '@/components/AiLimitModal';
import DrawerMenu from '@/components/DrawerMenu';
import { emailToKey } from '@/constants/auth';

import { HeaderHeightProvider } from '../../context/HeaderHeightContext';

import { playSuccessSound } from '../../utils/audio';



const { width: SCREEN_WIDTH } = Dimensions.get('window');



const countNewOrdersForUser = (orders: { status?: string; doctorId?: string; technicianId?: string }[], currentUser: { id?: string; uid?: string; role?: string }) => {

  return orders.filter((order) => {

    if (order.status !== 'new') return false;

    const userId = currentUser.uid || currentUser.id;

    if (!userId) return false;

    if (currentUser.role === 'technician') {
      return order.technicianId === userId;
    }

    if (currentUser.role === 'doctor') {
      return order.doctorId === userId;
    }

    return false;

  }).length;

};



export default function TabLayout() {

  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<any>(null);

  const [loading, setLoading] = useState(true);

  const [newOrdersCount, setNewOrdersCount] = useState(0);

  const [unreadChatsCount, setUnreadChatsCount] = useState(0);

  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const [incomingArchiveCount, setIncomingArchiveCount] = useState(0);

  const [, setPreviousNewOrdersCount] = useState(0);

  const previousNewOrdersCountRef = useRef(0);

  const isInitialLoad = useRef(true);
  const chatLastSeenRef = useRef<Record<string, number>>({});
  const chatUnsubscribesRef = useRef<Map<string, () => void>>(new Map());
  const unreadChatIdsRef = useRef<Set<string>>(new Set());

  const [diamondBalance, setDiamondBalance] = useState<number>(20);
  const diamondBalanceRef = useRef(diamondBalance);
  const [aiDailyLimit, setAiDailyLimit] = useState<number>(15);
  const aiDailyLimitRef = useRef(15);
  const [isAdmin, setIsAdmin] = useState(false);

  const [drawerVisible, setDrawerVisible] = useState(false);

  useEffect(() => {
    diamondBalanceRef.current = diamondBalance;
  }, [diamondBalance]);

  // Подписка для бейджа гамбургера (звук в IncomingArchiveWatcher в корневом _layout)
  useEffect(() => {
    if (!user) return;
    const email: string = (user as any).email || '';
    const uid = email ? emailToKey(email) : ((user as any).id || (user as any).uid || '');
    if (!uid) return;
    const currentFirestore = getFirebaseFirestore();
    const q = query(
      collection(currentFirestore, 'archives'),
      where('sharedWith', 'array-contains', uid),
    );
    const unsub = onSnapshot(q, (snap) => {
      const unread = snap.docs.filter((d) => {
        const data = d.data();
        if (data.userId === uid) return false; // свои документы не считаем
        const readBy: Record<string, boolean> = data.readBy || {};
        return !readBy[uid];
      });
      setIncomingArchiveCount(unread.length);
    }, () => {});
    return () => unsub();
  }, [user]);

  // Инициализация user из AsyncStorage (без баланса — он теперь из RTDB)
  useEffect(() => {
    AsyncStorage.getItem('user').then((data) => {
      if (data) {
        const parsed = JSON.parse(data);
        setUser(parsed);
        const admin = parsed?.isAdmin === true || parsed?.email === 'dimmonix@gmail.com';
        setIsAdmin(admin);
        // Временно берём кэш пока RTDB не ответил
        if (!admin && parsed.diamondBalance !== undefined) {
          setDiamondBalance(parsed.diamondBalance);
          diamondBalanceRef.current = parsed.diamondBalance;
        }
        if (admin) {
          setDiamondBalance(999999);
          diamondBalanceRef.current = 999999;
        }
      }
      setLoading(false);
    });

    // Загружаем lastSeenTimestamp для чатов
    AsyncStorage.getItem('chatLastSeen').then((data) => {
      if (data) {
        chatLastSeenRef.current = JSON.parse(data);
      }
    });
  }, []);

  // Сохраняем баланс в AsyncStorage при каждом изменении
  useEffect(() => {
    if (!user) return;
    const updated = { ...user, diamondBalance };
    AsyncStorage.setItem('user', JSON.stringify(updated));
  }, [diamondBalance, user]);

  // Чтение aiLimits из Firebase RTDB в реальном времени
  useEffect(() => {
    if (!user) return;
    const email: string = user?.email || '';
    const uid = email ? emailToKey(email) : (user?.id || user?.uid || '');
    if (!uid) return;

    const currentDb = getFirebaseDB();
    const userRef = ref(currentDb, `users/${uid}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const fresh = snapshot.val();
        const freshLimits = fresh?.aiLimits ?? 15;
        setAiDailyLimit(freshLimits);
        aiDailyLimitRef.current = freshLimits;
      }
    });

    return () => off(userRef);
  }, [user]);

  useEffect(() => {
    (globalThis as any).getDiamondBalance = () => diamondBalanceRef.current;
    (globalThis as any).getAiDailyLimit = () => aiDailyLimitRef.current;
    (globalThis as any).spendDiamonds = async (amount: number) => {
      // Admin never spends diamonds
      if (isAdmin) return true;

      const isEarn = amount < 0;
      const changeAmount = Math.abs(amount);

      // Для списания: проверяем достаточность баланса
      if (!isEarn && diamondBalanceRef.current < amount) return false;

      const newBalance = diamondBalanceRef.current - amount;

      // 1. Обновляем стейт и реф
      setDiamondBalance(newBalance);
      diamondBalanceRef.current = newBalance;

      // 2. Ходим на backend
      const raw = await AsyncStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        const userEmail = u?.email || '';
        if (userEmail) {
          const endpoint = isEarn ? 'http://62.238.13.160:8000/balance/earn' : 'http://62.238.13.160:8000/balance/spend';
          const logLabel = isEarn ? 'BALANCE_EARN_ERROR' : 'BALANCE_SPEND_ERROR';
          const fetchLabel = isEarn ? 'BALANCE_EARN_FETCH_ERROR' : 'BALANCE_SPEND_FETCH_ERROR';
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: userEmail, amount: changeAmount }),
            });
            if (!response.ok) {
              const data = await response.json().catch(() => ({}));
              console.log(`💎 ${logLabel}:`, data.detail || response.status);
              // Откатываем локальный стейт, если сервер отказал
              setDiamondBalance(diamondBalanceRef.current + amount);
              diamondBalanceRef.current += amount;
              return false;
            }
          } catch (e) {
            console.log(`💎 ${fetchLabel}:`, e);
            // Откатываем локальный стейт при сетевой ошибке
            setDiamondBalance(diamondBalanceRef.current + amount);
            diamondBalanceRef.current += amount;
            return false;
          }
        }
      }

      return true;
    };
    (globalThis as any).forceDiamondUpdate = () => {
      setDiamondBalance(prev => prev);
    };
    (globalThis as any).openDrawer = () => setDrawerVisible(true);
    (globalThis as any).getNewOrdersCount = () => newOrdersCount;
  }, [isAdmin, newOrdersCount]);






  // Real-time слушатель новых нарядов (Firebase Realtime Database)

  useEffect(() => {

    if (!user) return;



    const userId = user.uid || user.id;
    if (!userId) return;

    const field = user.role === 'doctor' ? 'doctorId' : 'technicianId';
    const currentDb = getFirebaseDB();
    const ordersRef = dbQuery(ref(currentDb, 'orders'), orderByChild(field), equalTo(userId));

    const unsubscribe = onValue(

      ordersRef,

      (snapshot) => {

        const data = snapshot.val();

        let currentNewOrdersCount = 0;



        if (data) {

          const ordersList = Object.entries(data).map(([id, order]: any) => ({

            id,

            ...order,

          }));

          currentNewOrdersCount = countNewOrdersForUser(ordersList, user);

        }



        setNewOrdersCount(currentNewOrdersCount);



        if (!isInitialLoad.current && currentNewOrdersCount > previousNewOrdersCountRef.current) {

          playSuccessSound();

        }

        isInitialLoad.current = false;

        previousNewOrdersCountRef.current = currentNewOrdersCount;

        setPreviousNewOrdersCount(currentNewOrdersCount);

      },

      (error) => {

        console.log("=== Колокольчик: фильтрация доступа ===");

      }

    );



    return () => unsubscribe();

  }, [user]);



  // Real-time слушатель входящих запросов на связь

  useEffect(() => {

    if (!user) return;



    const currentDb = getFirebaseDB();
    const requestsRef = ref(currentDb, 'connection_requests');

    const unsubscribe = onValue(

      requestsRef,

      (snapshot) => {

        const data = snapshot.val();
        console.log('=== CONNECTION REQUESTS ===', JSON.stringify(data));
        let pendingCount = 0;



        if (data) {

          Object.entries(data).forEach(([key, req]: any) => {

            if (req && (req.to === user.uid || req.to === user.id) && req.status === 'pending') {

              pendingCount++;

            }

          });

        }

        console.log('=== PENDING COUNT ===', pendingCount);

        setPendingRequestsCount(pendingCount);

      },

      (error) => {

        console.log("=== Запросы: ошибка слушателя ===", error.message);

      }

    );



    return () => unsubscribe();

  }, [user]);

  // Глобальный слушатель новых сообщений в партнёрских чатах
  useEffect(() => {
    if (!user) return;

    const userId = user.uid || user.id;
    if (!userId) return;

    const currentDb = getFirebaseDB();
    const chatsRef = ref(currentDb, 'chats');

    const unsubscribePartnerships = onValue(chatsRef, async (snapshot) => {
      const data = snapshot.val();
      const chatIds: string[] = [];
      if (data && typeof data === 'object') {
        Object.entries(data).forEach(([chatId, chatData]: [string, any]) => {
          if (chatData?.members && chatData.members[userId]) {
            chatIds.push(chatId);
          }
        });
      }

      // Одноразовый get() снапшот для инициализации chatLastSeen
      for (const chatId of chatIds) {
        if (chatLastSeenRef.current[chatId] === undefined) {
          try {
            const msgSnapshot = await get(ref(currentDb, `chat_messages/${chatId}`));
            const msgData = msgSnapshot.val();
            if (msgData && typeof msgData === 'object') {
              const messages = Object.entries(msgData).map(([id, value]: [string, any]) => ({
                id,
                senderId: value.senderId || '',
                timestamp: value.timestamp || 0,
              }));
              const maxTimestamp = messages.reduce((max, msg) => Math.max(max, msg.timestamp), 0);
              chatLastSeenRef.current[chatId] = maxTimestamp;
              await AsyncStorage.setItem('chatLastSeen', JSON.stringify(chatLastSeenRef.current));
            }
          } catch (e) {
            console.error('Error fetching initial chat messages:', e);
          }
        }
      }

      // Очищаем старые подписки перед созданием новых
      chatUnsubscribesRef.current.forEach(unsub => unsub());
      chatUnsubscribesRef.current.clear();

      // Подписываемся на новые сообщения
      chatIds.forEach(chatId => {
        // Пропускаем если уже подписаны
        if (chatUnsubscribesRef.current.has(chatId)) {
          return;
        }

        const messagesRef = ref(currentDb, `chat_messages/${chatId}`);
        const unsub = onValue(messagesRef, (msgSnapshot) => {
          const msgData = msgSnapshot.val();
          if (!msgData) return;

          const messages = Object.entries(msgData).map(([id, value]: [string, any]) => ({
            id,
            senderId: value.senderId || '',
            timestamp: value.timestamp || 0,
          }));

          // Находим последнее сообщение от партнёра
          const lastPartnerMessage = messages
            .filter(m => m.senderId !== userId)
            .sort((a, b) => b.timestamp - a.timestamp)[0];

          if (lastPartnerMessage) {
            const lastSeen = chatLastSeenRef.current[chatId] || 0;
            if (lastPartnerMessage.timestamp > lastSeen) {
              if ((globalThis as any).isInPartnerChat === chatId) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } else {
                playSuccessSound();
                unreadChatIdsRef.current.add(chatId);
                (globalThis as any).unreadChatsCount = unreadChatIdsRef.current.size;
                (globalThis as any).updateUnreadCount?.();
              }
            }
          }
        });
        chatUnsubscribesRef.current.set(chatId, unsub);
      });
    });

    return () => {
      unsubscribePartnerships();
      chatUnsubscribesRef.current.forEach(unsub => unsub());
      chatUnsubscribesRef.current.clear();
    };
  }, [user]);

  // Экспортируем функцию для обновления lastSeenTimestamp (используется в partner-chat)
  useEffect(() => {
    (globalThis as any).updateChatLastSeen = async (chatId: string) => {
      const now = Date.now();
      chatLastSeenRef.current[chatId] = now;
      await AsyncStorage.setItem('chatLastSeen', JSON.stringify(chatLastSeenRef.current));
    };

    (globalThis as any).getChatLastSeen = (chatId: string) => {
      return chatLastSeenRef.current[chatId] || 0;
    };

    (globalThis as any).updateUnreadCount = () => {
      setUnreadChatsCount(prev => prev + 1);
    };

    (globalThis as any).resetChatUnread = (chatId: string) => {
      unreadChatIdsRef.current.delete(chatId);
      (globalThis as any).unreadChatsCount = unreadChatIdsRef.current.size;
      (globalThis as any).updateUnreadCount?.();
    };
  }, []);


  if (loading) return null;

  if (!user) return <Redirect href="/auth" />;



  return (

    <HeaderHeightProvider>

      {({ setHeaderHeight }: { setHeaderHeight: (height: number) => void }) => (

        <>

          <StatusBar barStyle="light-content" backgroundColor="#031427" />

          <ImageBackground

          source={require('@/assets/images/background.png')}

          style={{ flex: 1 }}

          resizeMode="cover"

        >

          <View style={{ flex: 1, backgroundColor: 'transparent' }}>

            <GlobalHeader
              diamonds={diamondBalance}
              aiDailyLimit={aiDailyLimit}
              newOrdersCount={newOrdersCount}
              onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
              onBurgerPress={() => setDrawerVisible(true)}
              unreadAnalysesCount={incomingArchiveCount}
            />
            <AiLimitModal />

            <DrawerMenu
              visible={drawerVisible}
              onClose={() => setDrawerVisible(false)}
              unreadAnalysesCount={incomingArchiveCount}
              onRoleSwitch={() => {
                AsyncStorage.getItem('user').then(data => {
                  if (data) setUser(JSON.parse(data));
                });
              }}
            />

        <Tabs

          screenOptions={{

            tabBarActiveTintColor: '#f2ca50',

            tabBarInactiveTintColor: '#ffffff60',

            sceneStyle: { backgroundColor: 'transparent' },

            tabBarStyle: {

              position: 'absolute',

              bottom: 37,

              left: 20,

              right: 20,

              borderRadius: 25,

              backgroundColor: 'rgba(15, 20, 35, 0.85)',

              borderWidth: 1,

              borderColor: 'rgba(242, 202, 80, 0.3)',

              height: 60,

              paddingBottom: 0,

              paddingTop: 0,

              shadowColor: '#f2ca50',

              shadowOffset: { width: 0, height: 4 },

              shadowOpacity: 0.2,

              shadowRadius: 12,

              elevation: 12,

            },

            tabBarLabelStyle: {

              marginTop: 2,

              fontSize: 8,

            },

            tabBarIconStyle: {

              marginBottom: 0,

              marginTop: 0,

            },

            tabBarItemStyle: {

              paddingVertical: 0,

              justifyContent: 'center',

              alignItems: 'center',

              flex: 1,

              height: 60,

            },

            headerShown: false,

            tabBarButton: HapticTab,

          }}>

          <Tabs.Screen

            name="index"

            options={{

              title: 'Главная',

              tabBarIcon: ({ color }) => <Ionicons size={22} name="home" color={color} />,

            }}

          />

          <Tabs.Screen

            name="search"

            options={{

              title: 'Наряды',

              tabBarIcon: ({ color }) => <Ionicons size={22} name="clipboard-outline" color={color} />,

            }}

          />

          <Tabs.Screen

            name="settings"

            options={{

              title: 'Настройки',

              tabBarIcon: ({ color }) => <Ionicons size={22} name="settings" color={color} />,

            }}

          />

          <Tabs.Screen

            name="profile"

            options={{

              title: 'Профиль',

              tabBarIcon: ({ color }) => <Ionicons size={22} name="person-outline" color={color} />,

              tabBarBadge: pendingRequestsCount > 0 ? pendingRequestsCount.toString() : undefined,

            }}

          />

          <Tabs.Screen

            name="balance"

            options={{

              title: 'Маркет',

              href: '/(tabs)/balance',

              tabBarIcon: ({ color }) => <Ionicons size={22} name="diamond-outline" color={color} />,

            }}

          />

          <Tabs.Screen

            name="color-analyzer"

            options={{

              headerShown: false,

              tabBarButton: () => null,

              tabBarItemStyle: { display: 'none' },

            }}

          />

          <Tabs.Screen

            name="case-club"

            options={{

              headerShown: false,

              tabBarButton: () => null,

              tabBarItemStyle: { display: 'none' },

            }}

          />

          <Tabs.Screen

            name="chat"

            options={{

              headerShown: false,

              tabBarButton: () => null,

              tabBarItemStyle: { display: 'none' },

            }}

          />

        </Tabs>

      </View>

        </ImageBackground>

        </>

      )}

    </HeaderHeightProvider>

  );

}



const styles = StyleSheet.create({
  notificationBadge: {
    backgroundColor: '#f2ca50',
    borderRadius: 20,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#031427',
    paddingHorizontal: 4,
    zIndex: 10,
  },
  notificationBadgeText: {
    color: '#1a1a1a',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});

