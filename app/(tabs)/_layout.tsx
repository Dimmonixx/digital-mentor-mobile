import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, Tabs, router } from 'expo-router';
import { onValue, ref } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import { Image, ImageBackground, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { database } from '@/constants/firebase';
import { HeaderHeightProvider } from '../../context/HeaderHeightContext';
import { playSuccessSound } from '../../utils/audio';

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
  const [, setPreviousNewOrdersCount] = useState(0);
  const previousNewOrdersCountRef = useRef(0);
  const isInitialLoad = useRef(true);

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
        console.error('Ошибка при получении новых нарядов для колокольчика:', error);
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
            <View 
              style={[styles.header, { paddingTop: insets.top + 8 }]}
              onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
            >
              <TouchableOpacity style={styles.headerIconBtn}>
                <Ionicons name="menu-outline" size={28} color="#f2ca50" />
              </TouchableOpacity>
              <Image
                source={require('@/assets/images/header-logo.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <View style={styles.headerRight}>
                <TouchableOpacity 
                  style={[styles.headerIconBtn, styles.bellButton]}
                  onPress={() => {
                    // Переключаемся на вкладку Наряды и фильтр "Новые"
                    router.push('/(tabs)/search');
                    // Вызываем функцию для показа новых нарядов
                    setTimeout(() => {
                      (window as any).showNewOrders?.();
                    }, 100);
                  }}
                >
                  <Ionicons name="notifications-outline" size={24} color="#f2ca50" />
                  {newOrdersCount > 0 && (
                    <View style={styles.notificationBadge}>
                      <Text style={styles.notificationBadgeText}>
                        {newOrdersCount > 99 ? '99+' : newOrdersCount.toString()}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: '#f2ca50',
            tabBarInactiveTintColor: '#ffffff60',
            sceneStyle: { backgroundColor: 'transparent' },
            tabBarStyle: {
              backgroundColor: '#031427',
              borderTopColor: '#ffffff10',
              paddingBottom: (insets?.bottom || 0) + 8,
              height: 60 + (insets?.bottom || 0),
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
            },
            headerShown: false,
            tabBarButton: HapticTab,
          }}>
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
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
              title: 'Settings',
              tabBarIcon: ({ color }) => <Ionicons size={22} name="settings" color={color} />,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: 'Profile',
              tabBarIcon: ({ color }) => <Ionicons size={22} name="person-outline" color={color} />,
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
        </Tabs>
      </View>
        </ImageBackground>
        </>
      )}
    </HeaderHeightProvider>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f2ca50',
  },
  headerLogo: {
    width: 180,
    height: 56,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconBtn: {
    padding: 4,
  },
  bellButton: {
    position: 'relative',
    overflow: 'visible',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ff4d4d',
    borderRadius: 10,
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
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});
