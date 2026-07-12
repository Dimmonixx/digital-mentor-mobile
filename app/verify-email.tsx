import { DemoOverlay, DemoOverlayData } from '@/components/case-post-actions';
import { resendVerificationCode, verifyEmail } from '@/constants/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
    ImageBackground,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity
} from 'react-native';

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [overlayData, setOverlayData] = useState<DemoOverlayData>(null);

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      setError('Введите 6-значный код из письма');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await verifyEmail(email, code);
      const raw = await AsyncStorage.getItem('user');
      if (raw) {
        const userData = JSON.parse(raw);
        userData.emailVerified = true;
        await AsyncStorage.setItem('user', JSON.stringify(userData));
      }
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || 'Неверный код подтверждения');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerificationCode(email);
      setOverlayData({
        title: 'Готово',
        message: 'Код отправлен повторно на вашу почту',
        icon: 'mail-outline',
        danger: false,
        confirmText: 'Понятно',
        onConfirm: () => setOverlayData(null),
      });
    } catch (e: any) {
      setOverlayData({
        title: 'Ошибка',
        message: e.message || 'Не удалось отправить код',
        icon: 'alert-circle-outline',
        danger: true,
        confirmText: 'Понятно',
        onConfirm: () => setOverlayData(null),
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <>
    <Stack.Screen options={{ headerShown: false }} />
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <Text style={styles.title}>✉️ Подтвердите email</Text>
        <Text style={styles.subtitle}>
          Мы отправили 6-значный код на{'\n'}{email}
        </Text>
        <Text style={[styles.subtitle, { color: '#f2ca50', marginTop: -10 }]}>
          ⚡ Сейчас у вас 2 энергии на пробу.{'\n'}Подтвердите почту — и получите полные 15⚡ в день!
        </Text>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="000000"
          placeholderTextColor="rgba(255,255,255,0.3)"
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
        />

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleVerify}
          disabled={loading}
        >
          <Text style={styles.confirmButtonText}>
            {loading ? 'Проверяем...' : 'Подтвердить'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResend} disabled={resending} style={{ marginTop: 20 }}>
          <Text style={styles.resendText}>
            {resending ? 'Отправляем...' : 'Отправить код заново'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ marginTop: 16 }}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
            Пропустить, войти с 2⚡
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </ImageBackground>
    <DemoOverlay data={overlayData} onClose={() => setOverlayData(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f2ca50',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  input: {
    width: 200,
    height: 60,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.4)',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#fff',
    fontSize: 28,
    letterSpacing: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: '#f2ca50',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 50,
  },
  confirmButtonText: {
    color: '#0b0e14',
    fontSize: 16,
    fontWeight: '700',
  },
  resendText: {
    color: 'rgba(242,202,80,0.8)',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
