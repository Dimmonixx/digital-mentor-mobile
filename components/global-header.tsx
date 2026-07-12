import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface GlobalHeaderProps {
  diamonds: number;
  aiDailyLimit?: number;
  newOrdersCount?: number;
  unreadAnalysesCount?: number;
  showBackButton?: boolean;
  onLayout?: (e: any) => void;
  onBurgerPress?: () => void;
}

const INFINITY_THRESHOLD = 999000;

const formatDiamonds = (n: number): string => {
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return Math.floor(n / 1000) + 'k';
};

export default function GlobalHeader({
  diamonds,
  aiDailyLimit,
  newOrdersCount = 0,
  unreadAnalysesCount = 0,
  showBackButton = false,
  onLayout,
  onBurgerPress,
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
          onPress={showBackButton ? () => router.back() : onBurgerPress}
        >
          <Ionicons
            name={showBackButton ? 'arrow-back' : 'menu-outline'}
            size={28}
            color="#f2ca50"
          />
          {!showBackButton && unreadAnalysesCount > 0 && (
            <View style={styles.burgerDot} />
          )}
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
          {/* Заряды ИИ — всегда молния, админ — ♥️, баланс если есть, иначе дневной лимит */}
          <View style={diamonds >= INFINITY_THRESHOLD ? styles.aiCapsuleAdmin : styles.aiCapsule}>
            <Ionicons name="flash" size={12} color="#f2ca50" />
            {diamonds >= INFINITY_THRESHOLD ? (
              <Text style={styles.aiCapsuleInfinity}>~</Text>
            ) : (
              <Text style={styles.aiCapsuleText}>
                {aiDailyLimit !== undefined ? aiDailyLimit : '—'}
              </Text>
            )}
          </View>

          {/* Bell: только наряды */}
          <TouchableOpacity
            style={styles.bellCapsule}
            activeOpacity={0.75}
            onPress={() => {
              router.push('/(tabs)/search');
              setTimeout(() => { (window as any).showNewOrders?.(); }, 100);
            }}
          >
            <Ionicons name="notifications" size={16} color="#bda15d" />
            {newOrdersCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {newOrdersCount > 99 ? '99+' : newOrdersCount}
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
    minWidth: 80,
    maxWidth: 120,
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
  burgerDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#c0392b',
    borderWidth: 1.5,
    borderColor: '#031427',
  },
  headerLogo: {
    width: 180,
    height: 56,
  },
  diamondCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(13, 15, 20, 0.65)',
    borderWidth: 1,
    borderColor: '#bda15d',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  diamondText: {
    color: '#bda15d',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  aiCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(242, 202, 80, 0.1)',
    borderWidth: 1,
    borderColor: '#f2ca50',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  aiCapsuleText: {
    color: '#f2ca50',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  aiCapsuleAdmin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#f2ca50',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  aiCapsuleInfinity: {
    color: '#f2ca50',
    fontSize: 15,
    lineHeight: 16,
    fontWeight: '900',
    includeFontPadding: false,
    textAlignVertical: 'center',
    letterSpacing: -0.5,
  },
  bellCapsule: {
    backgroundColor: 'rgba(13, 15, 20, 0.65)',
    borderWidth: 1,
    borderColor: '#bda15d',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#c0392b',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: 'rgba(13,15,20,0.8)',
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
});
