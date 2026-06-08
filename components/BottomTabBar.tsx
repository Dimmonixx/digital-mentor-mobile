import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const TABS = [
  { label: 'Главная', icon: 'home' as const, route: '/(tabs)/index' },
  { label: 'Наряды', icon: 'clipboard-outline' as const, route: '/(tabs)/search' },
  { label: 'Настройки', icon: 'settings' as const, route: '/(tabs)/settings' },
  { label: 'Профиль', icon: 'person-outline' as const, route: '/(tabs)/profile' },
  { label: 'Премиум', icon: 'diamond-outline' as const, route: '/(tabs)/balance' },
];

export default function BottomTabBar({ activeRoute }: { activeRoute?: string }) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = activeRoute === tab.route;
        return (
          <TouchableOpacity
            key={tab.route}
            style={styles.item}
            activeOpacity={0.75}
            onPress={() => router.replace(tab.route as any)}
          >
            <Ionicons
              name={tab.icon}
              size={22}
              color={isActive ? '#f2ca50' : 'rgba(255,255,255,0.6)'}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 37,
    left: 20,
    right: 20,
    height: 60,
    borderRadius: 25,
    backgroundColor: 'rgba(15, 20, 35, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#f2ca50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
  item: {
    flex: 1,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 8,
    marginTop: 2,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  labelActive: {
    color: '#f2ca50',
  },
});
