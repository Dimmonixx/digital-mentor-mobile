import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { Audiowide_400Regular, useFonts } from '@expo-google-fonts/audiowide';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
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

const playGlobalBell = async () => {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    const { sound } = await Audio.Sound.createAsync(
      require('@/assets/sounds/bell.mp3')
    );
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate(async (status) => {
      if (status.isLoaded && status.didJustFinish) {
        try {
          sound.setOnPlaybackStatusUpdate(null);
          await sound.unloadAsync();
        } catch (error) {
          console.log('Ошибка выгрузки звука:', error);
        }
      }
    });
  } catch (e) {
    console.log('Ошибка внешнего аудио:', e);
  }
};

export default function HomeScreen() {
  const [fontsLoaded] = useFonts({
    Audiowide_400Regular,
  });
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [isAppReady, setIsAppReady] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const welcomeFade = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(10)).current;
  const tickerAnim = useRef(new Animated.Value(400)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const tickerScrollAnim = useRef(new Animated.Value(0)).current;

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
    AsyncStorage.getItem('user').then(data => {
      if (data) {
        setUser(JSON.parse(data));
      }
    });
  }, []);

  useEffect(() => {
    // Splash screen animation
    Animated.timing(welcomeFade, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(welcomeFade, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsAppReady(true);
        });
      }, 2000);
    });
  }, []);

  useEffect(() => {
    // Анимация вращения вокруг оси Y
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Анимация левитации вверх-вниз
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const screenWidth = Dimensions.get('window').width;

  const renderActiveButton = (icon: any, iconType: 'ionicons' | 'material', label: string, onPress: () => void, iconSize: number = 20) => (
    <View style={{
      shadowColor: '#4fc3f7',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.6,
      shadowRadius: 12,
      marginBottom: 12,
    }}>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.iconBox}>
          {iconType === 'ionicons' ? (
            <Ionicons name={icon} size={iconSize} color="#f2ca50" />
          ) : (
            <MaterialCommunityIcons name={icon} size={iconSize} color="#f2ca50" />
          )}
        </View>
        <Text style={styles.labelText}>{label}</Text>
        <MaterialCommunityIcons name="chevron-right" size={22} color="#FFD700" />
      </TouchableOpacity>
    </View>
  );

  const renderDisabledButton = (icon: any, iconType: 'ionicons' | 'material', label: string, iconSize: number = 20) => (
    <View style={{
      shadowColor: '#4fc3f7',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.6,
      shadowRadius: 12,
      marginBottom: 12,
    }}>
      <View style={[styles.card, styles.disabledCard]}>
        <View style={styles.iconBox}>
          {iconType === 'ionicons' ? (
            <Ionicons name={icon} size={iconSize} color="#f2ca50" />
          ) : (
            <MaterialCommunityIcons name={icon} size={iconSize} color="#f2ca50" />
          )}
        </View>
        <Text style={styles.labelText}>{label}</Text>
        <View style={styles.soonBadge}>
          <Text style={styles.soonBadgeText}>СКОРО</Text>
        </View>
      </View>
    </View>
  );

  useEffect(() => {
    scrollAnim.setValue(0);
    Animated.loop(
      Animated.timing(scrollAnim, {
        toValue: -250,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [user]);

  const spinY = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

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
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
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
          {/* Зацикленный широкоформатный баннер */}
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

            {/* Анимированный Lottie объект в центре */}
            <View style={{ width: 180, height: 180, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', overflow: 'visible' }}>
              <LottieView
                source={require('@/assets/images/cyber_head.json')}
                autoPlay
                loop
                style={{
                  width: 150,
                  height: 150,
                }}
                resizeMode="contain"
                onAnimationFailure={(error) => console.log("Lottie Error: ", error)}
              />
            </View>
          </View>
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.cardsContainer}>
            {user?.role === 'technician' ? (
              // Technician: 3 active buttons
              <>
                {renderActiveButton('chatbubbles-outline', 'ionicons', 'РАБОЧИЙ ЧАТ', () => router.push('/chat'))}
                {renderActiveButton('tooth-outline', 'material', t('colorAnalysis'), () => router.push('/color-analyzer'), 20)}
                {renderActiveButton('analytics-outline', 'ionicons', 'АНАЛИЗ РАБОТЫ', () => router.push('/work-analysis'))}
              </>
            ) : (
              // Doctor: 4 active buttons
              <>
                <TouchableOpacity
                  onPress={() => router.push('/new-order')}
                  style={{
                    backgroundColor: '#1E1E1E',
                    borderRadius: 16,
                    height: 90,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginVertical: 8,
                    borderWidth: 1,
                    borderColor: '#f2ca50',
                    borderStyle: 'solid',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.84,
                    elevation: 5,
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconBox, styles.prominentIconBox]}>
                    <Ionicons name="add-circle-outline" size={26} color="#f2ca50" />
                  </View>
                  <Text style={[styles.labelText, styles.prominentLabelText]}>НОВЫЙ НАРЯД</Text>
                  <MaterialCommunityIcons name="chevron-right" size={24} color="#f2ca50" />
                </TouchableOpacity>
                {renderActiveButton('chatbubbles-outline', 'ionicons', 'РАБОЧИЙ ЧАТ', () => router.push('/chat'))}
                {renderActiveButton('tooth-outline', 'material', t('colorAnalysis'), () => router.push('/color-analyzer'), 20)}
                {renderActiveButton('analytics-outline', 'ionicons', 'АНАЛИЗ РАБОТЫ', () => router.push('/work-analysis'))}
              </>
            )}

            {/* Visual gap */}
            <View style={{ height: 24 }} />

            {/* Disabled buttons with "Скоро" badge */}
            {renderDisabledButton('layers-outline', 'ionicons', t('techCard'))}
            {renderDisabledButton('scan', 'ionicons', 'МОРФОЛОГИЯ', 24)}
            {renderDisabledButton('flask', 'ionicons', 'РЕЦЕПТЫ МАСС', 24)}
            {renderDisabledButton('tooth-outline', 'material', 'АНАТОМИЯ ЗУБОВ', 24)}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Полноэкранный оверлей приветствия */}
      {!isAppReady && (
        <Animated.View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 15, 29, 0.9)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          opacity: welcomeFade
        }}>
          <View
            style={{
              borderRadius: 16,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: '#f2ca50',
              backgroundColor: 'rgba(13, 17, 23, 0.85)',
              shadowColor: '#f2ca50',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 5,
              maxWidth: '88%',
            }}
          >
            <LinearGradient
              colors={[
                '#050810',
                '#0a0f1d',
                '#152238',
                '#1e3a5f',
                '#152238',
                '#0a0f1d',
                '#050810',
              ]}
              locations={[0, 0.15, 0.35, 0.5, 0.65, 0.85, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 16,
                paddingVertical: 36,
                paddingHorizontal: 32,
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 280,
              }}
            >
              <Animated.Text
                style={{
                  color: '#f2ca50',
                  fontSize: 22,
                  fontWeight: 'bold',
                  textAlign: 'center',
                  marginBottom: 20,
                }}
              >
                Добро пожаловать в
              </Animated.Text>
              <Image
                source={require('@/assets/images/header-logo.png')}
                style={{
                  width: 182,
                  height: 91,
                  resizeMode: 'contain',
                  marginBottom: 20,
                }}
              />
              <Animated.Text
                style={{
                  color: '#ffffff',
                  fontSize: 24,
                  fontWeight: 'bold',
                  textAlign: 'center',
                }}
              >
                {user?.name ? user.name.split(' ').slice(0, 2).join(' ') : 'уважаемый гость'}!
              </Animated.Text>
            </LinearGradient>
          </View>
        </Animated.View>
      )}
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
  disabledCard: {
    opacity: 0.6,
  },
  soonBadge: {
    backgroundColor: '#f2ca50',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  soonBadgeText: {
    color: '#031427',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  prominentCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    height: 90,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  prominentBorder: {
    backgroundColor: '#f2ca50',
    borderRadius: 17,
    padding: 1,
    marginVertical: 8,
  },
  prominentIconBox: {
    width: 44,
    height: 44,
  },
  prominentLabelText: {
    color: '#f2ca50',
  },
});