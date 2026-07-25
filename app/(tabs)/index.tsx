import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { Audiowide_400Regular, useFonts } from '@expo-google-fonts/audiowide';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  ImageBackground,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Svg, { Defs, Polygon, RadialGradient, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

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

const PulsingCommentDot = () => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.4, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 36,
        right: 63,
        width: 15,
        height: 15,
        borderRadius: 7.5,
        backgroundColor: '#ff0000',
        borderWidth: 2,
        borderColor: '#ffffff',
        transform: [{ scale }],
        zIndex: 1000,
      }}
    />
  );
};

export default function HomeScreen() {
  const [fontsLoaded] = useFonts({
    Audiowide_400Regular,
  });
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [hasNewComments, setHasNewComments] = useState(() => (globalThis as any).hasNewComments || false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<{ firstName?: string; lastName?: string; patronymic?: string } | null>(null);
  const [serverProfile, setServerProfile] = useState<{ name?: string; role?: string; diamonds?: number; mastery?: { score: number; level: string } } | null>(null);
  const [isAppReady, setIsAppReady] = useState(false);
  const [chatBadge, setChatBadge] = useState(() => (globalThis as any).unreadChatsCount || 0);
  const pulseBadgeAnim = useRef(new Animated.Value(1)).current;
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

  const TECHNICIAN_ITEMS = [
    { id: 'chat', label: 'КЕЙС КЛУБ', icon: 'chatbubble-outline', active: true, route: '/(tabs)/case-club', col: 0, row: 0 },
    { id: 'color', label: 'АНАЛИЗ\nЦВЕТА', icon: 'color-palette-outline', active: true, route: '/(tabs)/color-analyzer', col: 1, row: 0 },
    { id: 'work', label: 'АНАЛИЗ\nРАБОТЫ', icon: 'analytics-outline', active: true, route: '/work-analysis', center: true },
    { id: 'morphology', label: 'МОРФОЛОГИЯ', icon: 'body-outline', active: false, col: 0, row: 1 },
    { id: 'recipes', label: 'РЕЦЕПТЫ', icon: 'flask-outline', active: false, col: 1, row: 1 },
    { id: 'premium', label: 'Анатомия зубов', icon: 'diamond-outline', active: false, col: 0, row: 2, route: '/(tabs)/balance' },
    { id: 'techmap', label: 'Оптическая\nдиагностика', icon: 'layers-outline', active: true, route: '/detalization', col: 1, row: 2 },
    { id: 'etalon', label: 'Эталонный замер', icon: 'options-outline', active: false },
    { id: 'detail', label: 'Детализация', icon: 'list-outline', active: false },
    { id: 'golden', label: 'Проектирование\nулыбки', icon: 'git-network-outline', active: true, route: '/golden-proportion' },
    { id: 'ceramics', label: 'Визуализатор масс', icon: 'book-outline', active: false },
  ];

  const HexCell = ({ item, variant = 'side', onPress, showDot }: any) => {
    const isCenter = variant === 'center';
    const width = isCenter ? 152 : 142;
    const height = isCenter ? 136 : 128;
    const points = isCenter
      ? '38,4 114,4 150,68 114,132 38,132 2,68'
      : '35,4 107,4 140,64 107,124 35,124 2,64';
    const innerPoints = isCenter
      ? '44,10 108,10 142,68 108,126 44,126 10,68'
      : '41,10 101,10 132,64 101,118 41,118 10,64';

    return (
      <View style={{ position: 'relative', width, height }}>
        {showDot && <PulsingCommentDot />}
        <TouchableOpacity
          activeOpacity={item.active ? 0.78 : 1}
          onPress={onPress}
          style={[
            styles.hexCell,
            { width, height },
            item.active ? styles.hexCellActiveShadow : styles.hexCellInactiveShadow,
            isCenter && styles.hexCellCenter,
          ]}
        >
          <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={StyleSheet.absoluteFill}>
          <Defs>
            {isCenter ? (
              <SvgLinearGradient id="hexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#8B6914" />
                <Stop offset="50%" stopColor="#f2ca50" />
                <Stop offset="100%" stopColor="#8B6914" />
              </SvgLinearGradient>
            ) : (
              <RadialGradient id="hexGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <Stop offset="0%" stopColor="#2e1f10" />
                <Stop offset="100%" stopColor="#0d0d10" />
              </RadialGradient>
            )}
          </Defs>
          <Polygon points={points} fill={isCenter ? '#f2ca50' : 'transparent'} />
          <Polygon points={innerPoints} fill={isCenter ? 'url(#hexGradient)' : 'transparent'} />
          {!isCenter && (
            <Polygon points={points} fill="none" stroke="#f2ca50" strokeWidth={2} strokeOpacity={0.6} />
          )}
          <Polygon points={innerPoints} fill="none" stroke="#ffffff" strokeWidth={1} strokeOpacity={isCenter ? 0.85 : 0.4} />
        </Svg>
        <View style={styles.hexCellContent}>
          <View style={styles.hexIconGlow}>
            <Ionicons name={item.icon as any} size={isCenter ? 30 : 26} color={isCenter ? '#1a1206' : '#f2ca50'} />
          </View>
          <Text
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            style={[styles.hexCellLabel, isCenter && styles.hexCellLabelCenter, isCenter && { color: '#1a1206' }]}
          >
            {item.label.replace('\n', ' ')}
          </Text>
        </View>
      </TouchableOpacity>
      </View>
    );
  };

  const TechMapPanel = ({ item, onPress, style }: any) => (
    <TouchableOpacity activeOpacity={item.active ? 0.78 : 1} onPress={onPress} style={[styles.techMapPanel, { width: item.id === 'golden' ? 306 : 360 }, !item.active && { opacity: 0.4 }, style]}>
      <Svg width={item.id === 'golden' ? 306 : 360} height={92} viewBox={item.id === 'golden' ? '0 0 306 92' : '0 0 360 92'} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="techMapBody" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#433715" />
            <Stop offset="45%" stopColor="#1b1204" />
            <Stop offset="100%" stopColor="#070300" />
          </SvgLinearGradient>
          <SvgLinearGradient id="techMapEdge" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#ffe680" />
            <Stop offset="55%" stopColor="#f2ca50" />
            <Stop offset="100%" stopColor="#6b4a10" />
          </SvgLinearGradient>
        </Defs>
        <Polygon points={item.id === 'golden' ? '32,7 274,7 301,84 5,84' : '38,7 322,7 354,84 6,84'} fill="none" stroke="#f2ca50" strokeWidth={5} opacity={0.22} />
        <Polygon points={item.id === 'golden' ? '32,7 274,7 301,84 5,84' : '38,7 322,7 354,84 6,84'} fill="url(#techMapBody)" stroke="url(#techMapEdge)" strokeWidth={2.5} />
        <Polygon points={item.id === 'golden' ? '43,17 263,17 284,74 22,74' : '50,17 310,17 334,74 26,74'} fill="#130b02" opacity={0.95} />
        <Polygon points={item.id === 'golden' ? '43,17 263,17 284,74 22,74' : '50,17 310,17 334,74 26,74'} fill="none" stroke="#FFE57A" strokeWidth={1} opacity={0.45} />
      </Svg>
      <View style={styles.techMapContent}>
        <Ionicons name={item.icon as any} size={34} color="#f2ca50" />
        <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6} style={styles.techMapLabel}>{item.label}</Text>
        {!item.active && (
          <View style={styles.techMapSoonBadge}>
            <Text style={styles.techMapSoonText}>СКОРО</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const InvertedTrapezoidButton = () => (
    <TouchableOpacity activeOpacity={0.78} style={styles.invertedTrapButton} onPress={() => router.push('/chat')}>
      <Svg width={156} height={64} viewBox="0 0 156 64" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="invertedTrapBody" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#332812" />
            <Stop offset="50%" stopColor="#160d03" />
            <Stop offset="100%" stopColor="#050200" />
          </SvgLinearGradient>
          <SvgLinearGradient id="invertedTrapEdge" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#ffe680" />
            <Stop offset="55%" stopColor="#f2ca50" />
            <Stop offset="100%" stopColor="#6b4a10" />
          </SvgLinearGradient>
        </Defs>
        <Polygon points="10,5 146,5 116,59 40,59" fill="none" stroke="#f2ca50" strokeWidth={4} opacity={0.2} />
        <Polygon points="10,5 146,5 116,59 40,59" fill="url(#invertedTrapBody)" stroke="url(#invertedTrapEdge)" strokeWidth={2} />
        <Polygon points="22,13 134,13 108,51 48,51" fill="#120a02" stroke="#8B5E00" strokeWidth={1} opacity={0.92} />
      </Svg>
      <View style={styles.invertedTrapContent}>
        <View style={{ position: 'relative' }}>
          <Ionicons name="scan-outline" size={20} color="#f2ca50" />
          {chatBadge > 0 && (
            <Animated.View style={{
              position: 'absolute',
              top: 6,
              right: 5,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#ff4444',
              opacity: pulseBadgeAnim,
            }} />
          )}
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={styles.invertedTrapText}>ЧАТ</Text>
      </View>
    </TouchableOpacity>
  );

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
    AsyncStorage.getItem('userProfile').then(data => {
      if (data) {
        try {
          setProfile(JSON.parse(data));
        } catch (e) {
          console.log('Ошибка парсинга профиля:', e);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const userId = user.id || user.email;
    if (!userId) return;
    fetch(`http://62.238.13.160:8000/user/${encodeURIComponent(userId)}/profile`)
      .then(res => res.json())
      .then(data => {
        if (data?.status === 'success') {
          setServerProfile(data);
        }
      })
      .catch(e => console.log('Ошибка загрузки профиля:', e));
  }, [user]);

  useEffect(() => {
    // Check if welcome screen was already shown
    AsyncStorage.getItem('welcomeShown').then((shown) => {
      if (shown === 'true') {
        // Already shown, skip animation
        setIsAppReady(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 0,
          useNativeDriver: true,
        }).start();
      } else {
        // First time, show animation
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
              AsyncStorage.setItem('welcomeShown', 'true');
            });
          }, 2000);
        });
      }
    });
  }, []);

  useEffect(() => {
    setChatBadge((globalThis as any).unreadChatsCount || 0);
    (globalThis as any).updateUnreadCount = () => {
      const count = (globalThis as any).unreadChatsCount || 0;
      console.log('=== BADGE UPDATE ===', count);
      setChatBadge(count);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      setHasNewComments((globalThis as any).hasNewComments || false);
      (globalThis as any).updateHasNewComments = () => {
        setHasNewComments((globalThis as any).hasNewComments || false);
      };
    }, [])
  );

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseBadgeAnim, {
          toValue: 0.3,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseBadgeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    ).start();
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
      
      <View style={{ flex: 1 }}>
        
        {/* Earth — fixed, behind everything, above bottom nav */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: -40,
            right: -40,
            width: '130%',
            height: 220,
            zIndex: 2,
          }}
          pointerEvents="none"
        >
          <Image
            source={require('@/assets/images/earth.png')}
            style={{
              width: '100%',
              height: '100%',
              resizeMode: 'cover',
              opacity: 0.95,
            }}
          />
        </View>

        {/* Fixed content on top of earth */}
        <View style={{ flex: 1, backgroundColor: 'transparent', zIndex: 1 }}>
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
            {(() => {
              const items = TECHNICIAN_ITEMS;
              return (
                <View style={styles.hexGridContainer}>
                  <InvertedTrapezoidButton />
                  <View style={styles.rowTop}>
                    <HexCell item={items[0]} onPress={() => items[0].active && items[0].route && router.push(items[0].route as any)} showDot={hasNewComments} />
                    <View style={styles.topRightHex}>
                      <HexCell item={items[1]} onPress={() => items[1].active && items[1].route && router.push(items[1].route as any)} />
                    </View>
                  </View>
                  <View style={styles.rowCenter}>
                    <HexCell item={items[2]} variant="center" onPress={() => items[2].active && items[2].route && router.push(items[2].route as any)} />
                  </View>
                  <TechMapPanel item={items[6]} onPress={() => items[6].active && items[6].route && router.push(items[6].route as any)} style={{ marginBottom: 4 }} />
                  <TechMapPanel item={items[9]} onPress={() => items[9].active && items[9].route && router.push(items[9].route as any)} />
                  {/* Временно скрыты неактивные кнопки: Морфология, Рецепты, Анатомия зубов, Эталонный замер, Золотое сечение, Визуализатор масс */}
                  {/* <View style={styles.soonFeaturesList}>
                    {items.filter((item: any) => !item.active && item.id !== 'techmap').map((item: any) => (
                      <View key={item.id} style={styles.soonFeatureCard}>
                        <View style={styles.soonFeatureIcon}>
                          <Ionicons name={item.icon as any} size={22} color="#f2ca50" />
                        </View>
                        <Text style={styles.soonFeatureLabel}>{item.label.replace('\n', ' ')}</Text>
                        <View style={styles.soonFeatureBadge}>
                          <Text style={styles.soonFeatureBadgeText}>СКОРО</Text>
                        </View>
                      </View>
                    ))}
                  </View> */}
                </View>
              );
            })()}
          </View>
        </Animated.View>
        
      </View>

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
                {(() => {
                  if (serverProfile?.name) return serverProfile.name;
                  const fullName = [profile?.lastName, profile?.firstName, profile?.patronymic]
                    .filter(Boolean)
                    .join(' ')
                    .trim();
                  if (fullName) return fullName;
                  if (user?.name) return user.name;
                  return 'уважаемый гость';
                })()}!
              </Animated.Text>
            </LinearGradient>
          </View>
        </Animated.View>
      )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 60,
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
  hexGridContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
    position: 'relative',
  },
  invertedTrapButton: {
    position: 'absolute',
    top: -2,
    alignSelf: 'center',
    width: 156,
    height: 64,
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  invertedTrapContent: {
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    maxWidth: 110,
    paddingTop: 2,
  },
  invertedTrapText: {
    color: '#f2ca50',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
  },
  rowTop: {
    width: 374,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topRightHex: {
    marginLeft: 0,
  },
  rowCenter: {
    marginTop: -64,
    zIndex: 3,
  },
  rowBottom: {
    marginTop: 0,
    zIndex: 1,
    alignItems: 'center',
  },
  hexCell: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  hexCellActiveShadow: {
    shadowColor: '#f2ca50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  hexCellInactiveShadow: {
    shadowColor: '#f2ca50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  hexCellCenter: {
    marginTop: 0,
    shadowColor: '#f2ca50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  hexIconGlow: {
    shadowColor: '#f2ca50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  hexCellContent: {
    width: '90%',
    height: '85%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 0,
    gap: 2,
    position: 'absolute',
    top: '0%',
  },
  hexCellLabel: {
    color: '#f2ca50',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    lineHeight: 12,
    letterSpacing: 1,
    flexShrink: 0,
    includeFontPadding: false,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
  },
  hexCellLabelCenter: {
    fontSize: 11,
    lineHeight: 13,
    textShadowColor: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
  },
  techMapPanel: {
    width: 360,
    height: 92,
    marginTop: 0,
    marginBottom: 30,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  techMapContent: {
    width: '84%',
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingTop: 0,
  },
  techMapLabel: {
    color: '#f2ca50',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
  },
  techMapSoonBadge: {
    minWidth: 72,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f2ca50',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  techMapSoonText: {
    color: '#1a0d00',
    fontSize: 12,
    fontWeight: '900',
  },
  soonFeaturesList: {
    width: '100%',
    marginTop: 18,
    gap: 10,
    paddingHorizontal: 6,
  },
  soonFeatureCard: {
    minHeight: 58,
    opacity: 0.5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.45)',
    backgroundColor: 'rgba(20, 20, 26, 0.86)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  soonFeatureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.35)',
    backgroundColor: 'rgba(242, 202, 80, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  soonFeatureLabel: {
    flex: 1,
    color: '#f2ca50',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  soonFeatureBadge: {
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f2ca50',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  soonFeatureBadgeText: {
    color: '#1a0d00',
    fontSize: 9,
    fontWeight: '900',
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