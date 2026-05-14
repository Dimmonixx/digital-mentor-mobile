import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Image, ImageBackground, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="menu-outline" size={28} color="#f2ca50" />
          </TouchableOpacity>
          <Image
            source={require('@/assets/images/header-logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIconBtn}>
              <Ionicons name="notifications-outline" size={24} color="#f2ca50" />
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
              justifyContent: 'space-around',
              alignItems: 'center',
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
              title: 'Search',
              tabBarIcon: ({ color }) => <Ionicons size={22} name="search" color={color} />,
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
              tabBarIcon: ({ color }) => <Ionicons size={22} name="person" color={color} />,
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
});
