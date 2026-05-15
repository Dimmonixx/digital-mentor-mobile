import { database } from '@/constants/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { child, get, ref, set } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

export default function AuthScreen() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'doctor' | 'technician'>('doctor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.15,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-8deg', '8deg'],
  });

  const handleRegister = async () => {
    if (!email || !password || !name) {
      setError('Заполните все поля');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(child(usersRef, email.replace('.','_')));
      if (snapshot.exists()) {
        setError('Пользователь уже существует');
        return;
      }
      const userData = {
        name,
        email,
        password,
        role,
        createdAt: Date.now(),
      };
      await set(ref(database, 
        'users/' + email.replace(/\./g, '_')), userData);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      router.replace('/(tabs)');
    } catch (error: any) {
      console.log('Register error:', error.code, error.message);
      setError(error.message || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Заполните все поля');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const snapshot = await get(
        ref(database, 'users/' + email.replace(/\./g, '_'))
      );
      if (!snapshot.exists()) {
        setError('Пользователь не найден');
        return;
      }
      const userData = snapshot.val();
      if (userData.password !== password) {
        setError('Неверный пароль');
        return;
      }
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      router.replace('/(tabs)');
    } catch (error: any) {
      console.log('Login error:', error.code, error.message);
      setError(error.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <Animated.Image
              source={require('@/assets/images/header-logo.png')}
              style={{
                width: 220,
                height: 110,
                resizeMode: 'contain',
                transform: [{ scale: scaleAnim }, { rotate }],
                shadowColor: '#f2ca50',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: opacityAnim,
                shadowRadius: 25,
              }}
            />
            <View style={{
              width: 60, height: 1,
              backgroundColor: 'rgba(242,202,80,0.4)',
              marginTop: 16,
            }} />
          </View>

          <View style={[styles.card, { paddingHorizontal: 20, gap: 12 }]}>
            {/* Табы */}
            <View style={{
              flexDirection: 'row',
              backgroundColor: 'rgba(0,0,0,0.35)',
              borderRadius: 14,
              padding: 4,
              marginBottom: 28,
              borderWidth: 1,
              borderColor: 'rgba(242,202,80,0.25)',
              width: '100%',
            }}>
              <TouchableOpacity
                onPress={() => setTab('login')}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: tab === 'login' 
                    ? '#f2ca50' : 'transparent',
                  marginRight: 3,
                }}
              >
                <Text style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: tab === 'login' 
                    ? '#031427' : 'rgba(255,255,255,0.45)',
                }}>Вход</Text>
              </TouchableOpacity>
              <View style={{
                width: 1,
                height: '60%',
                backgroundColor: 'rgba(242,202,80,0.2)',
                alignSelf: 'center',
              }} />
              <TouchableOpacity
                onPress={() => setTab('register')}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: tab === 'register' 
                    ? '#f2ca50' : 'transparent',
                  marginLeft: 3,
                }}
              >
                <Text style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: tab === 'register' 
                    ? '#031427' : 'rgba(255,255,255,0.45)',
                }}>Регистрация</Text>
              </TouchableOpacity>
            </View>

            {/* Ошибка */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Поля */}
            {tab === 'register' && (
              <TextInput
                style={styles.input}
                placeholder="Имя"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={name}
                onChangeText={setName}
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder="Пароль"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {/* Выбор роли при регистрации */}
            {tab === 'register' && (
              <View style={styles.roleSelection}>
                <TouchableOpacity
                  style={[
                    styles.roleCard,
                    role === 'doctor' && styles.roleCardSelected
                  ]}
                  onPress={() => setRole('doctor')}
                >
                  <Text style={styles.roleCardTitle}>Врач</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleCard,
                    role === 'technician' && styles.roleCardSelected
                  ]}
                  onPress={() => setRole('technician')}
                >
                  <Text style={styles.roleCardTitle}>Техник</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Кнопка входа/регистрации */}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={tab === 'login' ? handleLogin : handleRegister}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? 'Загрузка...' : (tab === 'login' ? 'Войти' : 'Зарегистрироваться')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <StatusBar style="light" backgroundColor="#0a0a1a" />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
  },
  logoText: {
    color: '#f2ca50',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 10,
  },
  card: {
    backgroundColor: '#0a1628ee',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#f2ca5040',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#f2ca50',
  },
  tabText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '400',
  },
  tabTextActive: {
    color: '#031427',
    fontSize: 15,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#3d1515aa',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ff6b6b60',
  },
  errorText: {
    color: '#ffb4b4',
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  roleSelection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  roleCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.3)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  roleCardSelected: {
    borderColor: 'rgba(242,202,80,0.9)',
    backgroundColor: 'rgba(242,202,80,0.1)',
  },
  roleCardTitle: {
    color: '#f2ca50',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: '#f2ca50',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#1a1a2e',
    fontSize: 16,
    fontWeight: '700',
  },
});
