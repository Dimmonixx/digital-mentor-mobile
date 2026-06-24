import { Ionicons } from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Redirect, Tabs } from 'expo-router';

import { getFirebaseDB, getFirebaseFirestore } from '@/constants/firebase';
import { query as dbQuery, equalTo, onValue, orderByChild, ref, set } from 'firebase/database';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import React, { useEffect, useRef, useState } from 'react';

import { Dimensions, ImageBackground, StatusBar, StyleSheet, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';



import { HapticTab } from '@/components/haptic-tab';

import GlobalHeader from '@/components/global-header';

import DrawerMenu from '@/components/DrawerMenu';

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

  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const [incomingArchiveCount, setIncomingArchiveCount] = useState(0);

  const [, setPreviousNewOrdersCount] = useState(0);

  const previousNewOrdersCountRef = useRef(0);

  const isInitialLoad = useRef(true);

  const [diamondBalance, setDiamondBalance] = useState<number>(20);
  const diamondBalanceRef = useRef(diamondBalance);
  const [isAdmin, setIsAdmin] = useState(false);

  const [drawerVisible, setDrawerVisible] = useState(false);

  useEffect(() => {
    diamondBalanceRef.current = diamondBalance;
  }, [diamondBalance]);

  // Подписка для бейджа гамбургера (звук в IncomingArchiveWatcher в корневом _layout)
  useEffect(() => {
    if (!user) return;
    const rawUid: string = (user as any).id || (user as any).uid || (user as any).email || '';
    const uid = rawUid.replace(/\./g, '_');
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
  }, []);

  // Подписка баланса алмазов из RTDB — единственный источник истины
  useEffect(() => {
    if (!user) {
      console.log('[Auth Debug] _layout: no user, skipping balance listener');
      return;
    }
    const uid: string = (user as any)?.uid || (user as any)?.id || (user as any)?.email?.replace(/\./g, '_') || '';
    console.log('[Auth Debug] _layout: formatted balance path key:', uid);
    if (!uid) return;
    const currentDb = getFirebaseDB();
    const diamondRef = ref(currentDb, `users/${uid}/diamondBalance`);
    console.log('[Auth Debug] _layout: subscribing to', `users/${uid}/diamondBalance`);
    const unsub = onValue(diamondRef, (snap) => {
      const val = snap.val();
      console.log('[Auth Debug] _layout: raw diamondBalance snapshot:', val);
      // Admins get infinite diamonds — check by email or isAdmin flag
      const adminCheck = (user as any)?.isAdmin === true || (user as any)?.email === 'dimmonix@gmail.com';
      if (adminCheck) {
        setDiamondBalance(999999);
        diamondBalanceRef.current = 999999;
        setIsAdmin(true);
        console.log('💎 ADMIN: unlimited diamonds');
        return;
      }
      if (val !== null && val !== undefined) {
        setDiamondBalance(val);
        diamondBalanceRef.current = val;
        (globalThis as any).forceDiamondUpdate?.();
        console.log('💎 RTDB_BALANCE: Баланс из RTDB =', val, '| путь: users/' + uid + '/diamondBalance');
      } else {
        // Поля нет — инициализируем значением из кэша или 20
        const initial = diamondBalanceRef.current || 20;
        set(diamondRef, initial);
        console.log('💎 RTDB_BALANCE: Поле не найдено, записываем начальный баланс =', initial, '| путь: users/' + uid + '/diamondBalance');
      }
      console.log('💎 СИНХРОНИЗАЦИЯ: Алмазы переведены на Firebase RTDB для', uid);
    }, (error) => {
      console.error('[Firebase Error Check] _layout balance:', error);
    });
    return () => unsub();
  }, [user]);

  // Сохраняем баланс в AsyncStorage при каждом изменении
  useEffect(() => {
    if (!user) return;
    const updated = { ...user, diamondBalance };
    AsyncStorage.setItem('user', JSON.stringify(updated));
  }, [diamondBalance, user]);

  useEffect(() => {
    (globalThis as any).getDiamondBalance = () => diamondBalanceRef.current;
    (globalThis as any).spendDiamonds = (amount: number) => {
      // Admin never spends diamonds
      if (isAdmin) return true;
      if (diamondBalanceRef.current < amount) return false;

      const newBalance = diamondBalanceRef.current - amount;

      // 1. Обновляем стейт и реф
      setDiamondBalance(newBalance);
      diamondBalanceRef.current = newBalance;

      // 2. Пишем в RTDB фоново
      AsyncStorage.getItem('user').then((raw) => {
        if (!raw) return;
        const u = JSON.parse(raw);
        const uid: string = u?.uid || u?.id || u?.email?.replace(/\./g, '_') || '';
        if (!uid) return;
        const currentDb = getFirebaseDB();
        set(ref(currentDb, `users/${uid}/diamondBalance`), newBalance)
          .catch((e) => console.log('💎 RTDB_SPEND_ERROR:', e));
      });

      return true;
    };
    (globalThis as any).forceDiamondUpdate = () => {
      setDiamondBalance(prev => prev);
    };
  }, [isAdmin]);






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

        let pendingCount = 0;



        if (data) {

          Object.entries(data).forEach(([key, req]: any) => {

            if (req && (req.to === user.uid || req.to === user.id) && req.status === 'pending') {

              pendingCount++;

            }

          });

        }



        setPendingRequestsCount(pendingCount);

      },

      (error) => {

        console.log("=== Запросы: ошибка слушателя ===", error.message);

      }

    );



    return () => unsubscribe();

  }, [user]);



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
              newOrdersCount={newOrdersCount}
              onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
              onBurgerPress={() => setDrawerVisible(true)}
              unreadAnalysesCount={incomingArchiveCount}
            />

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

