import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface GlobalHeaderProps {
  diamonds: number;
  newOrdersCount?: number;
  showBackButton?: boolean;
  onLayout?: (e: any) => void;
}

export default function GlobalHeader({
  diamonds,
  newOrdersCount = 0,
  showBackButton = false,
  onLayout,
}: GlobalHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.headerContainer, { paddingTop: insets.top }]}
      onLayout={onLayout}
    >
      <View style={styles.leftContainer}>
        <TouchableOpacity
          style={styles.burgerButton}
          onPress={showBackButton ? () => router.back() : undefined}
        >
          <Ionicons
            name={showBackButton ? 'arrow-back' : 'menu-outline'}
            size={28}
            color="#f2ca50"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.absoluteCenter}>
        <Image
          source={require('@/assets/images/header-logo.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
      </View>

      <View style={styles.rightContainer}>
        <View style={styles.headerRightContent}>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Text
              style={{
                color: '#4fc3f7',
                fontSize: 6,
                fontWeight: '700',
                marginBottom: 1,
              }}
            >
              {diamonds}
            </Text>
            <Text style={{ fontSize: 16, marginTop: -2 }}>💎</Text>
          </View>
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => {
              router.push('/(tabs)/search');
              setTimeout(() => {
                (window as any).showNewOrders?.();
              }, 100);
            }}
          >
            <Text style={{ fontSize: 15, marginTop: 11 }}>🔔</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f2ca50',
  },
  leftContainer: {
    width: 100,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 8,
    width: 100,
  },
  headerRightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  absoluteCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burgerButton: {
    padding: 4,
  },
  headerLogo: {
    width: 180,
    height: 56,
  },
  bellButton: {
    padding: 2,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#f2ca50',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#0b0e14',
    fontSize: 10,
    fontWeight: '700',
  },
});
