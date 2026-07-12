import { changeUserPassword } from '@/constants/auth';
import { LangType, useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    ScrollView, StatusBar, StyleSheet,
    Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

const SUPPORT_TG = 'https://t.me/di_labs';
const SUPPORT_TG_DEEP = 'tg://resolve?domain=di_labs';
const SUPPORT_EMAIL = 'support@dilabs.ru';

export default function SettingsScreen() {
  const { theme } = useTheme();
  const { t, lang, setLang } = useLanguage();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setSuccessMessage(false);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Ошибка', 'Новый пароль должен содержать не менее 6 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Ошибка', 'Новые пароли не совпадают');
      return;
    }
    if (newPassword === currentPassword) {
      Alert.alert('Ошибка', 'Новый пароль совпадает с текущим');
      return;
    }
    setPasswordLoading(true);
    try {
      await changeUserPassword(currentPassword, newPassword);
      setSuccessMessage(true);
      setTimeout(() => closePasswordModal(), 2000);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось сменить пароль');
    } finally {
      setPasswordLoading(false);
    }
  };

  useEffect(() => {
    AsyncStorage.getItem('@user_push_enabled').then(v => setPushEnabled(v === 'true'));
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('user').then((raw) => {
      if (raw) {
        setCurrentUser(JSON.parse(raw));
      }
    });
  }, []);

  const handleSupportPress = async () => {
    try {
      const canOpenDeep = await Linking.canOpenURL(SUPPORT_TG_DEEP);
      if (canOpenDeep) {
        await Linking.openURL(SUPPORT_TG_DEEP);
        return;
      }
      const canOpenWeb = await Linking.canOpenURL(SUPPORT_TG);
      if (canOpenWeb) {
        await Linking.openURL(SUPPORT_TG);
        return;
      }
      Alert.alert(
        'Telegram не найден',
        `Не удалось открыть Telegram. Вы можете написать нам на email:\n${SUPPORT_EMAIL}`,
        [{ text: 'OK' }]
      );
    } catch {
      Alert.alert(
        'Ошибка',
        `Не удалось открыть Telegram. Напишите нам на email:\n${SUPPORT_EMAIL}`,
        [{ text: 'OK' }]
      );
    }
  };

  const handlePushToggle = async (value: boolean) => {
    setPushEnabled(value);
    await AsyncStorage.setItem('@user_push_enabled', String(value));
  };

  const LANGUAGES: { code: LangType; label: string; flag: string }[] = [
    { code: 'uk', label: 'Українська', flag: '🇺🇦' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  ];

  const SettingRow = ({
    icon, label, right, iconColor, showBadge,
  }: {
    icon: string; label: string; right: React.ReactNode; iconColor?: string; showBadge?: boolean;
  }) => (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={{ marginRight: 12 }}>
        <Ionicons name={icon as any} size={20} color={iconColor ?? theme.accent} />
        {showBadge && (
          <View style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#ff6b6b',
            borderWidth: 1,
            borderColor: theme.bg ?? '#0b0e14',
          }} />
        )}
      </View>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <View style={styles.rowRight}>{right}</View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.accent} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.accent }]}>{t('settingsTitle')}</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* LANGUAGE */}
        <Text style={[styles.sectionTitle, { color: theme.accent }]}>{t('language')}</Text>
        <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
          {LANGUAGES.map((l) => (
            <TouchableOpacity
              key={l.code}
              style={[styles.row, { borderBottomColor: theme.border }]}
              onPress={() => setLang(l.code)}
            >
              <Text style={{ fontSize: 20, marginRight: 12 }}>{l.flag}</Text>
              <Text style={[styles.rowLabel, { color: theme.text }]}>{l.label}</Text>
              <View style={styles.rowRight}>
                {lang === l.code && (
                  <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* NOTIFICATIONS */}
        <Text style={[styles.sectionTitle, { color: theme.accent }]}>{t('notifications')}</Text>
        <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
          <SettingRow
            icon="notifications-outline"
            label={t('pushNotifications')}
            right={
              <Switch
                value={pushEnabled}
                onValueChange={handlePushToggle}
                trackColor={{ false: '#767577', true: theme.accentDim }}
                thumbColor={theme.accent}
              />
            }
          />
        </View>

        {/* SECURITY */}
        <Text style={[styles.sectionTitle, { color: theme.accent }]}>{t('security')}</Text>
        <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
          {currentUser?.emailVerified === false && (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/verify-email', params: { email: currentUser.email } } as any)}
            >
              <SettingRow
                icon="alert-circle"
                iconColor="#f2ca50"
                showBadge={true}
                label="Подтвердите email"
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{
                      backgroundColor: '#f2ca50',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 10
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#0b0e14' }}>Важно</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textDim} />
                  </View>
                }
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowPasswordModal(true)}>
            <SettingRow
              icon="lock-closed-outline"
              label={t('changePassword')}
              right={<Ionicons name="chevron-forward" size={20} color={theme.textDim} />}
            />
          </TouchableOpacity>
        </View>

        {/* ABOUT */}
        <Text style={[styles.sectionTitle, { color: theme.accent }]}>{t('aboutApp')}</Text>
        <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
          <SettingRow
            icon="information-circle-outline"
            label={t('version')}
            right={<Text style={{ color: theme.textDim }}>1.0.0</Text>}
          />
          <TouchableOpacity 
  onPress={() => Linking.openURL(
    'https://dimmonixx.github.io/digital-mentor-mobile/privacy.html'
  )}
>
  <SettingRow
    icon="document-text-outline"
    label={t('privacyPolicy')}
    right={<Ionicons name="chevron-forward" size={20} color={theme.textDim} />}
  />
</TouchableOpacity>
          <TouchableOpacity onPress={handleSupportPress}>
            <SettingRow
              icon="mail-outline"
              label={t('support')}
              right={<Ionicons name="chevron-forward" size={20} color={theme.textDim} />}
            />
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Модал смены пароля */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={closePasswordModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Заголовок */}
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="lock-closed" size={24} color="#f2ca50" />
              </View>
              <Text style={styles.modalTitle}>Сменить пароль</Text>
              <TouchableOpacity onPress={closePasswordModal} style={styles.modalClose}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Текущий пароль */}
            <Text style={styles.fieldLabel}>Текущий пароль</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrent}
                placeholder="Введите текущий пароль"
                placeholderTextColor="#4b5563"
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowCurrent(v => !v)} style={styles.eyeBtn}>
                <Ionicons name={showCurrent ? 'eye-off-outline' : 'eye-outline'} size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Новый пароль */}
            <Text style={styles.fieldLabel}>Новый пароль</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNew}
                placeholder="Минимум 6 символов"
                placeholderTextColor="#4b5563"
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowNew(v => !v)} style={styles.eyeBtn}>
                <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Повторить пароль */}
            <Text style={styles.fieldLabel}>Повторите новый пароль</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                placeholder="Повторите новый пароль"
                placeholderTextColor="#4b5563"
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Сообщение об успехе */}
            {successMessage && (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>Пароль успешно обновлён! ⚡</Text>
              </View>
            )}

            {/* Кнопки */}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnCancel} onPress={closePasswordModal}>
                <Text style={styles.btnCancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnConfirm, (passwordLoading || successMessage) && { opacity: 0.7 }]}
                onPress={handleChangePassword}
                disabled={passwordLoading || successMessage}
              >
                {passwordLoading
                  ? <ActivityIndicator size="small" color="#0a0f1d" />
                  : <Text style={styles.btnConfirmText}>Обновить</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 20,
    textTransform: 'uppercase',
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 18, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#0d111a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f2ca50',
    padding: 24,
    width: '100%',
    shadowColor: '#f2ca50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconWrap: {
    backgroundColor: 'rgba(242,202,80,0.1)',
    borderRadius: 10,
    padding: 8,
    marginRight: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#f2ca50',
    letterSpacing: 0.3,
  },
  modalClose: {
    padding: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 12,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131720',
    borderWidth: 1,
    borderColor: '#1e2535',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  input: {
    flex: 1,
    color: '#e8eaf0',
    fontSize: 15,
    paddingVertical: 12,
  },
  eyeBtn: {
    padding: 6,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e2535',
    alignItems: 'center',
  },
  btnCancelText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
  btnConfirm: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#f2ca50',
    alignItems: 'center',
  },
  btnConfirmText: {
    color: '#0a0f1d',
    fontSize: 15,
    fontWeight: '700',
  },
  successBanner: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
    alignItems: 'center',
  },
  successText: {
    color: '#4ade80',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
