import { Ionicons } from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Redirect, Tabs } from 'expo-router';

import { onValue, ref } from 'firebase/database';

import React, { useEffect, useRef, useState } from 'react';

import { Dimensions, ImageBackground, StatusBar, StyleSheet, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';



import { HapticTab } from '@/components/haptic-tab';

import GlobalHeader from '@/components/global-header';

import { database } from '@/constants/firebase';

import { HeaderHeightProvider } from '../../context/HeaderHeightContext';

import { playSuccessSound } from '../../utils/audio';



const { width: SCREEN_WIDTH } = Dimensions.get('window');



const countNewOrdersForUser = (orders: { status?: string; doctorId?: string; doctorName?: string; technicianId?: string; technicianName?: string; techName?: string }[], currentUser: { email?: string; id?: string; name?: string; role?: string }) => {

  return orders.filter((order) => {

    if (order.status !== 'new') return false;



    const userId = currentUser.email || currentUser.id;

    const userName = currentUser.name;



    if (currentUser.role === 'technician') {

      return (

        order.technicianId === userId ||

        order.technicianName === userName ||

        order.techName === userName

      );

    }



    if (currentUser.role === 'doctor') {

      return (

        order.doctorId === userId ||

        order.doctorName === userName

      );

    }



    return true;

  }).length;

};



export default function TabLayout() {

  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<any>(null);

  const [loading, setLoading] = useState(true);

  const [newOrdersCount, setNewOrdersCount] = useState(0);

  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const [, setPreviousNewOrdersCount] = useState(0);

  const previousNewOrdersCountRef = useRef(0);

  const isInitialLoad = useRef(true);

  const [diamondBalance, setDiamondBalance] = useState<number>(150);
  const diamondBalanceRef = useRef(diamondBalance);

  useEffect(() => {
    diamondBalanceRef.current = diamondBalance;
  }, [diamondBalance]);

  useEffect(() => {
    (globalThis as any).getDiamondBalance = () => diamondBalanceRef.current;
    (globalThis as any).spendDiamonds = (amount: number) => {
      let didSpend = false;
      setDiamondBalance(prev => {
        if (prev < amount) return prev;
        didSpend = true;
        return prev - amount;
      });
      return didSpend;
    };
    (globalThis as any).forceDiamondUpdate = () => {
      setDiamondBalance(prev => prev);
    };
  }, []);



  useEffect(() => {

    AsyncStorage.getItem('user').then((data) => {

      console.log('Stored user:', data);

      if (data) setUser(JSON.parse(data));

      setLoading(false);

    });

  }, []);



  // Real-time слушатель новых нарядов (Firebase Realtime Database)

  useEffect(() => {

    if (!user) return;



    const ordersRef = ref(database, 'orders');

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



    const requestsRef = ref(database, 'connection_requests');

    const unsubscribe = onValue(

      requestsRef,

      (snapshot) => {

        const data = snapshot.val();

        let pendingCount = 0;



        if (data) {

          Object.entries(data).forEach(([key, req]: any) => {

            if (req && req.to === user.id && req.status === 'pending') {

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

              fontSize: 10,

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

              title: 'Премиум',

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

