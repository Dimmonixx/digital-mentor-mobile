import { LangType, useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Linking,
    ScrollView, StatusBar, StyleSheet,
    Switch, Text, TouchableOpacity, View,
} from 'react-native';

const SUPPORT_TG = 'https://t.me/your_labs_support_username';
const SUPPORT_EMAIL = 'mailto:support@dilabs.com?subject=DiLabs%20Support';

export default function SettingsScreen() {
  const { theme } = useTheme();
  const { t, lang, setLang } = useLanguage();
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@user_push_enabled').then(v => setPushEnabled(v === 'true'));
  }, []);

  const handleSupportPress = async () => {
    const canOpenTG = await Linking.canOpenURL(SUPPORT_TG);
    if (canOpenTG) {
      await Linking.openURL(SUPPORT_TG);
    } else {
      await Linking.openURL(SUPPORT_EMAIL);
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
    icon, label, right,
  }: {
    icon: string; label: string; right: React.ReactNode;
  }) => (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <Ionicons name={icon as any} size={20} color={theme.accent} style={{ marginRight: 12 }} />
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
          <SettingRow
            icon="lock-closed-outline"
            label={t('changePassword')}
            right={<Ionicons name="chevron-forward" size={20} color={theme.textDim} />}
          />
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
});
