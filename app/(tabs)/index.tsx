import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { Audiowide_400Regular, useFonts } from '@expo-google-fonts/audiowide';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function HomeScreen() {
  const [fontsLoaded] = useFonts({
    Audiowide_400Regular,
  });
  const { theme, themeType } = useTheme();
  const { t } = useLanguage();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(10)).current;
  const tickerAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    const startAnimation = () => {
      scrollAnim.setValue(0);
      Animated.timing(scrollAnim, {
        toValue: -800,
        duration: 30000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => startAnimation());
    };
    startAnimation();
  }, []);

  useEffect(() => {
    // Вращение кольца 1
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Вращение кольца 2 в обратную сторону
    Animated.loop(
      Animated.timing(ring2Anim, {
        toValue: -1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    
    // Пульсация свечения
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 25,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 10,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Бегущая строка
    const startTicker = () => {
      tickerAnim.setValue(400);
      Animated.sequence([
        // Едет до середины
        Animated.timing(tickerAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        // Пауза 5 секунд
        Animated.delay(5000),
        // Едет дальше до конца
        Animated.timing(tickerAnim, {
          toValue: -400,
          duration: 3000,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        // Пауза перед повтором
        Animated.delay(1000),
      ]).start(() => startTicker());
    };

    startTicker();
  }, []);

  const rotate1 = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const rotate2 = ring2Anim.interpolate({
    inputRange: [-1, 0],
    outputRange: ['-360deg', '0deg'],
  });

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.08,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <StatusBar barStyle={themeType === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={{
          marginHorizontal: 0,
          marginVertical: 12,
          borderRadius: 0,
          borderWidth: 2,
          borderColor: '#f2ca50',
          overflow: 'hidden',
          height: 220,
          position: 'relative',
          shadowColor: '#f2ca50',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 12,
          elevation: 10,
        }}>
          {/* Движущийся баннер */}
          <View style={{ height: 220, overflow: 'hidden' }}>
            <Animated.View style={{
              flexDirection: 'row',
              width: 1600,
              transform: [{ translateX: scrollAnim }],
            }}>
              <Image
                source={require('@/assets/images/header-banner.png')}
                style={{ width: 800, height: 220 }}
                resizeMode="cover"
              />
              <Image
                source={require('@/assets/images/header-banner.png')}
                style={{ width: 800, height: 220 }}
                resizeMode="cover"
              />
            </Animated.View>
          </View>

          {/* Кольца и зуб поверх */}
          <View style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Animated.View style={{
              position: 'absolute',
              width: 140,
              height: 140,
              borderRadius: 70,
              borderWidth: 1.5,
              borderColor: '#f2ca5080',
              transform: [{ rotate: rotate1 }],
              borderStyle: 'dashed',
            }} />
            <Animated.View style={{
              position: 'absolute',
              width: 170,
              height: 170,
              borderRadius: 85,
              borderWidth: 1,
              borderColor: '#4fc3f760',
              transform: [{ rotate: rotate2 }],
            }} />
            <View style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
              <Animated.Text style={{
                color: '#f2ca50',
                fontSize: 12,
                fontFamily: 'Audiowide_400Regular',
                letterSpacing: 4,
                textShadowColor: '#000000',
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 0,
                transform: [{ translateX: tickerAnim }],
              }}>
                Welcome to DiLabs
              </Animated.Text>
            </View>
          </View>
        </View>

        <View style={styles.cardsContainer}>
          {/* 1. Новый наряд */}
          <View style={{
            shadowColor: '#4fc3f7',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.6,
            shadowRadius: 12,
            marginBottom: 12,
          }}>
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push('/new-order')}
              activeOpacity={0.8}
            >
              <View style={styles.iconBox}>
                <Ionicons name="document-text-outline" size={20} color="#f2ca50" />
              </View>
              <Text style={styles.labelText}>{t('newOrder')}</Text>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#FFD700" />
            </TouchableOpacity>
          </View>

          {/* 2. Чат техников */}
          <View style={{
            shadowColor: '#4fc3f7',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.6,
            shadowRadius: 12,
            marginBottom: 12,
          }}>
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push('/chat')}
              activeOpacity={0.8}
            >
              <View style={styles.iconBox}>
                <Ionicons name="chatbubbles-outline" size={20} color="#f2ca50" />
              </View>
              <Text style={styles.labelText}>{t('chatTechnicians')}</Text>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#FFD700" />
            </TouchableOpacity>
          </View>

          {/* 3. Анализ цвета */}
          <View style={{
            shadowColor: '#4fc3f7',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.6,
            shadowRadius: 12,
            marginBottom: 12,
          }}>
            <TouchableOpacity
              style={[styles.card, styles.cardVita]}
              onPress={() => router.push('/color-analyzer')}
              activeOpacity={0.8}
            >
              <View style={styles.iconBox}>
                <MaterialCommunityIcons name="tooth-outline" size={20} color="#f2ca50" />
              </View>
              <Text style={styles.labelText} numberOfLines={1}>{t('colorAnalysis')}</Text>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#FFD700" />
            </TouchableOpacity>
          </View>

          {/* 4. Тех-карта */}
          <View style={{
            shadowColor: '#4fc3f7',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.6,
            shadowRadius: 12,
            marginBottom: 24,
          }}>
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => {/* Добавьте переход для тех-карты */}}
            >
              <View style={styles.iconBox}>
                <Ionicons name="layers-outline" size={20} color="#f2ca50" />
              </View>
              <Text style={styles.labelText}>{t('techCard')}</Text>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#FFD700" />
            </TouchableOpacity>
          </View>

          {/* 5. Морфология */}
          <View style={{
            shadowColor: '#4fc3f7',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.6,
            shadowRadius: 12,
            marginBottom: 24,
          }}>
            <TouchableOpacity 
              style={styles.card} 
              onPress={() => router.push('/morphology')}
              activeOpacity={0.8}
            >
              <View style={styles.iconBox}>
                <Ionicons name="scan" size={24} color="#f2ca50" />
              </View>
              <Text style={styles.labelText}>МОРФОЛОГИЯ</Text>
              <Ionicons name="chevron-forward" size={20} color="#f2ca50" />
            </TouchableOpacity>
          </View>

          {/* 6. Рецепты масс */}
          <View style={{
            shadowColor: '#4fc3f7',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.6,
            shadowRadius: 12,
            marginBottom: 24,
          }}>
            <TouchableOpacity 
              style={styles.card} 
              onPress={() => router.push('/mass-calculator')}
              activeOpacity={0.8}
            >
              <View style={styles.iconBox}>
                <Ionicons name="flask" size={24} color="#f2ca50" />
              </View>
              <Text style={styles.labelText}>РЕЦЕПТЫ МАСС</Text>
              <Ionicons name="chevron-forward" size={20} color="#f2ca50" />
            </TouchableOpacity>
          </View>

          {/* 7. Анатомия зубов */}
          <View style={{
            shadowColor: '#4fc3f7',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.6,
            shadowRadius: 12,
            marginBottom: 24,
          }}>
            <TouchableOpacity 
              style={styles.card} 
              onPress={() => router.push('/anatomy-viewer')}
              activeOpacity={0.8}
            >
              <View style={styles.iconBox}>
                <MaterialCommunityIcons name="tooth-outline" size={24} color="#f2ca50" />
              </View>
              <Text style={styles.labelText}>АНАТОМИЯ ЗУБОВ</Text>
              <Ionicons name="chevron-forward" size={20} color="#f2ca50" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 160,
  },
  heroWrap: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 340,
    height: 240,
    marginTop: -20,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGlowIos: {
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  heroImage: {
    width: '150%',
    height: '150%',
  },
  cardsContainer: {
    paddingHorizontal: 20,
    gap: 0,
  },
  card: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2a2a2a',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 20,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 0,
    borderTopWidth: 4,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255, 255, 255, 0.15)',
    borderRightWidth: 2,
    borderRightColor: 'rgba(0, 0, 0, 0.5)',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0, 0, 0, 0.6)',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(242, 202, 80, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 10,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255, 255, 255, 0.2)',
    borderRightWidth: 2,
    borderRightColor: 'rgba(0, 0, 0, 0.4)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0, 0, 0, 0.5)',
  },
  labelText: {
    flex: 1,
    marginLeft: 12,
    color: '#f2ca50',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  cardVita: {
    marginBottom: 32,
  },
});