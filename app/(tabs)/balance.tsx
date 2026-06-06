import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ImageBackground,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PACKAGES = [
  {
    id: 'basic',
    name: 'Базовый',
    diamonds: 0,
    bonusDiamonds: 0,
    price: 250,
    color: '#ffffff60',
    isHit: false,
    isBasic: true,
    description: 'Наряды + чат, без AI',
    isSubscription: true,
  },
  {
    id: 'optimal',
    name: 'Оптимальный',
    diamonds: 150,
    bonusDiamonds: 0,
    price: 399,
    color: '#4fc3f7',
    isHit: true,
    isBasic: false,
    description: 'Все AI-модули. + Полный функционал ИИ',
    isSubscription: true,
  },
  {
    id: 'ultra',
    name: 'Ultra Lab',
    diamonds: 500,
    bonusDiamonds: 0,
    price: 799,
    color: '#e91e63',
    isHit: false,
    isBasic: false,
    description: 'Общий баланс команды, приоритет AI. + Полный функционал ИИ',
    isSubscription: true,
  },
  {
    id: 'trial',
    name: 'Пробный',
    diamonds: 10,
    bonusDiamonds: 0,
    price: 29,
    color: '#ffffff60',
    isHit: false,
    isBasic: false,
    isSubscription: false,
  },
  {
    id: 'start',
    name: 'Старт',
    diamonds: 50,
    bonusDiamonds: 5,
    price: 99,
    color: '#f2ca50',
    isHit: false,
    isBasic: false,
    isSubscription: false,
  },
  {
    id: 'optima',
    name: 'Оптима',
    diamonds: 150,
    bonusDiamonds: 15,
    price: 249,
    color: '#4fc3f7',
    isHit: false,
    isBasic: false,
    isSubscription: false,
  },
  {
    id: 'reserve',
    name: 'Запас',
    diamonds: 300,
    bonusDiamonds: 30,
    price: 449,
    color: '#e91e63',
    isHit: false,
    isBasic: false,
    isSubscription: false,
  },
  {
    id: 'pro-reserve',
    name: 'Про-запас',
    diamonds: 600,
    bonusDiamonds: 80,
    price: 799,
    color: '#f2ca50',
    isHit: false,
    isBasic: false,
    isSubscription: false,
  },
  {
    id: 'maximum',
    name: 'Максимум',
    diamonds: 1000,
    bonusDiamonds: 150,
    price: 1199,
    color: '#4fc3f7',
    isHit: true,
    isBasic: false,
    isSubscription: false,
  },
];

export default function BalanceScreen() {
  const insets = useSafeAreaInsets();
  const [balance, setBalance] = useState<number>((globalThis as any).getDiamondBalance?.() || 150);
  const [promoCode, setPromoCode] = useState<string>('');
  const [hasShared, setHasShared] = useState<boolean>(false);

  useEffect(() => {
    const subscription = (globalThis as any).forceDiamondUpdate = () => {
      setBalance((globalThis as any).getDiamondBalance?.() || 150);
    };
    
    AsyncStorage.getItem('user').then((data) => {
      if (data) {
        const user = JSON.parse(data);
        setPromoCode(user.promoCode || 'DIMM' + Math.random().toString(36).substring(2, 8).toUpperCase());
        setHasShared(user.hasShared || false);
      }
    });

    return () => {
      (globalThis as any).forceDiamondUpdate = subscription;
    };
  }, []);

  const handlePurchase = (pkg: typeof PACKAGES[0]) => {
    if (pkg.isBasic) return;
    const totalDiamonds = pkg.diamonds + pkg.bonusDiamonds;
    const newBalance = balance + totalDiamonds;
    setBalance(newBalance);
    (globalThis as any).spendDiamonds?.(-totalDiamonds);
    (globalThis as any).forceDiamondUpdate?.();
    const bonusText = pkg.bonusDiamonds > 0 ? ` (+${pkg.bonusDiamonds} бонус)` : '';
    Alert.alert(
      'Успешная покупка',
      `Вы приобрели пакет "${pkg.name}" на ${pkg.diamonds} 💎${bonusText}. Ваш новый баланс: ${newBalance} 💎`
    );
  };

  const handleCopyPromoCode = () => {
    Alert.alert('Скопировано', `Промокод ${promoCode} скопирован в буфер обмена`);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Используй мой промокод ${promoCode} в приложении DiLabs и получи 15 алмазов на ИИ-анализ зубов!`,
      });
      
      if (!hasShared) {
        setHasShared(true);
        const newBalance = balance + 1;
        setBalance(newBalance);
        (globalThis as any).spendDiamonds?.(-1);
        (globalThis as any).forceDiamondUpdate?.();
        
        // Save hasShared to AsyncStorage
        AsyncStorage.getItem('user').then((data) => {
          if (data) {
            const user = JSON.parse(data);
            user.hasShared = true;
            AsyncStorage.setItem('user', JSON.stringify(user));
          }
        });
        
        Alert.alert('Бонус получен!', 'Вы получили 1 💎 за первый шеринг');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={{ flex: 1, backgroundColor: 'transparent' }}
      resizeMode="cover"
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#f2ca50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Баланс и подписка</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Current Balance Block */}
          <View style={styles.balanceBlock}>
            <Text style={styles.balanceLabel}>Текущий баланс</Text>
            <View style={styles.balanceValueContainer}>
              <Text style={styles.balanceValue}>{balance}</Text>
              <Text style={styles.balanceDiamond}>💎</Text>
            </View>
            <Text style={styles.balanceHelper}>Используйте для ИИ-анализа и ассистента</Text>
          </View>

          {/* Package Purchase Cards */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Планы подписки</Text>
            
            {PACKAGES.filter(pkg => pkg.isSubscription).map((pkg) => (
              <TouchableOpacity
                key={pkg.id}
                style={[
                  styles.packageCard,
                  pkg.isHit && styles.packageCardHit,
                  pkg.isBasic && styles.packageCardBasic,
                  !pkg.isBasic && styles.packageCardSubscription,
                  pkg.isBasic && styles.packageCardBasicSubscription,
                  { borderLeftColor: pkg.id === 'basic' ? '#94a3b8' : pkg.id === 'optimal' ? '#3d8fe0' : '#f0b429' },
                ]}
                onPress={() => handlePurchase(pkg)}
                activeOpacity={pkg.isBasic ? 1 : 0.88}
              >
                {pkg.isHit && (
                  <View style={styles.hitBadge}>
                    <Text style={styles.hitBadgeText}>Хит продаж</Text>
                  </View>
                )}
                {pkg.isBasic && (
                  <View style={styles.basicBadge}>
                    <Text style={styles.basicBadgeText}>Активен по умолчанию</Text>
                  </View>
                )}
                <View style={styles.packageHeader}>
                  <Text style={[styles.packageName, pkg.isBasic && styles.packageNameBasic, { color: pkg.isBasic ? pkg.color : pkg.color }]}>{pkg.name}</Text>
                  <Text style={styles.packageDiamonds}>
                    {pkg.diamonds} 💎{pkg.bonusDiamonds > 0 && ` +${pkg.bonusDiamonds} бонус`}
                  </Text>
                </View>
                {pkg.description && (
                  <Text style={styles.packageDescription}>{pkg.description}</Text>
                )}
                <View style={styles.packagePrice}>
                  <Text style={[styles.priceValue, pkg.isBasic && styles.priceValueBasic]}>{pkg.price}</Text>
                  <Text style={styles.priceCurrency}>{pkg.price === 0 ? 'бесплатно' : '₴ / в месяц'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Diamond Packages Section */}
          <View style={styles.sectionContainerDiamond}>
            <Text style={styles.sectionTitleSmall}>Пополнить алмазы</Text>
            
            {PACKAGES.filter(pkg => !pkg.isSubscription).map((pkg) => (
              <TouchableOpacity
                key={pkg.id}
                style={[
                  styles.packageCardDiamond,
                  pkg.isHit && styles.packageCardHit,
                ]}
                onPress={() => handlePurchase(pkg)}
                activeOpacity={0.88}
              >
                <View style={styles.diamondCardRow1}>
                  <Text style={[styles.diamondRowName, { color: pkg.color }]}>{pkg.name}</Text>
                  <Text style={styles.diamondRowPrice}>{pkg.price} ₴</Text>
                </View>
                <View style={styles.diamondCardRow2}>
                  <Text style={styles.diamondRowDiamonds}>
                    {pkg.diamonds} 💎{pkg.bonusDiamonds > 0 && ` +${pkg.bonusDiamonds} 💎 бонус`}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Referral System Block */}
          <View style={styles.referralBlock}>
            <Text style={styles.sectionTitle}>Реферальная система</Text>
            <Text style={styles.referralDescription}>
              Пригласите коллегу! За каждого зарегистрированного доктора по вашему коду вы оба получите по 15 💎 на счет
            </Text>
            <View style={styles.promoCodeContainer}>
              <Text style={styles.promoCodeLabel}>Ваш промокод:</Text>
              <View style={styles.promoCodeBox}>
                <Text style={styles.promoCodeText}>{promoCode}</Text>
                <TouchableOpacity onPress={handleCopyPromoCode} style={styles.copyButton}>
                  <Ionicons name="copy-outline" size={20} color="#f2ca50" />
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={22} color="#f2ca50" />
              <Text style={styles.shareButtonText}>Поделиться в соцсетях</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(242, 202, 80, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  balanceBlock: {
    backgroundColor: 'rgba(15, 20, 35, 0.95)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 32,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(79, 195, 247, 0.3)',
    alignItems: 'center',
    shadowColor: 'rgba(79, 195, 247, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceHelper: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 8,
    textAlign: 'center',
  },
  balanceValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#f2ca50',
    marginRight: 8,
  },
  balanceDiamond: {
    fontSize: 32,
  },
  packagesSection: {
    marginBottom: 32,
  },
  sectionContainer: {
    backgroundColor: 'rgba(15, 20, 35, 0.8)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 18,
    padding: 12,
    marginBottom: 32,
  },
  sectionContainerDiamond: {
    backgroundColor: 'rgba(15, 20, 35, 0.8)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 18,
    padding: 12,
    marginBottom: 32,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(242, 202, 80, 0.2)',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  sectionTitleSmall: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  packageCard: {
    backgroundColor: 'rgba(15, 20, 35, 0.85)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.2)',
    position: 'relative',
    marginTop: 20,
  },
  packageCardHit: {
    borderColor: '#4fc3f7',
    borderWidth: 2,
    backgroundColor: 'rgba(79, 195, 247, 0.1)',
  },
  packageCardBasic: {
    backgroundColor: 'rgba(15, 20, 35, 0.85)',
    borderColor: '#4ade80',
    borderWidth: 1.5,
    padding: 20,
    opacity: 1,
  },
  packageCardSubscription: {
    borderLeftWidth: 4,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  packageCardBasicSubscription: {
    borderLeftWidth: 4,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  packageCardDiamond: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    minHeight: 64,
    overflow: 'hidden',
  },
  diamondCardRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  diamondCardRow2: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  diamondRowName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  diamondRowPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  diamondRowDiamonds: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  hitBadge: {
    position: 'absolute',
    top: -12,
    right: 16,
    backgroundColor: '#4fc3f7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  hitBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0a0f1d',
    textTransform: 'uppercase',
  },
  basicBadge: {
    position: 'absolute',
    top: -12,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  basicBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  packageName: {
    fontSize: 18,
    fontWeight: '700',
  },
  packageNameBasic: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  packageDiamonds: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  packageDiamondsCompact: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  packageDescription: {
    fontSize: 13,
    color: '#ffffff60',
    marginBottom: 12,
    lineHeight: 18,
  },
  packagePrice: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginRight: 4,
  },
  priceValueBasic: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginRight: 4,
  },
  priceValueCompact: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginRight: 4,
  },
  priceCurrency: {
    fontSize: 16,
    color: '#ffffff80',
  },
  referralBlock: {
    backgroundColor: 'rgba(15, 20, 35, 0.85)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.2)',
  },
  referralDescription: {
    fontSize: 14,
    color: '#ffffff80',
    lineHeight: 20,
    marginBottom: 20,
  },
  promoCodeContainer: {
    marginTop: 8,
  },
  promoCodeLabel: {
    fontSize: 14,
    color: '#ffffff80',
    marginBottom: 8,
  },
  promoCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.3)',
  },
  promoCodeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f2ca50',
    letterSpacing: 2,
  },
  copyButton: {
    padding: 8,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242, 202, 80, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.3)',
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f2ca50',
    marginLeft: 12,
  },
});
