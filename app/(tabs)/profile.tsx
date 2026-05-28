import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ref as dbRef, get, set } from 'firebase/database';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { database, storage } from '../../constants/firebase';
import { useAuth } from '../../hooks/useAuth';

const { width: screenWidth } = Dimensions.get('window');

const PRESET_AVATARS = [
  require('../../assets/avatars/avatar_1.jpg'),
  require('../../assets/avatars/avatar_2.jpg'),
  require('../../assets/avatars/avatar_3.jpg'),
  require('../../assets/avatars/avatar_4.jpg'),
  require('../../assets/avatars/avatar_5.jpg'),
  require('../../assets/avatars/avatar_6.jpg'),
  require('../../assets/avatars/avatar_7.jpg'),
  require('../../assets/avatars/avatar_8.jpg'),
  require('../../assets/avatars/avatar_9.jpg'),
  require('../../assets/avatars/avatar_10.jpg'),
];

const POSITIONS = ['Зубной техник', 'Стоматолог'];
const SPECIALIZATIONS = [
  'Металлокерамика',
  'Циркон',
  'Композит',
  'Бюгель',
  'Съёмные протезы',
];

interface ProfileData {
  firstName: string;
  lastName: string;
  position: string;
  laboratory: string;
  city: string;
  experience: string;
  specialization: string[];
  avatarType: 'custom' | 'preset';
  avatarUrl: string;
  avatarPresetId: number;
}

interface Statistics {
  ordersCount: number;
  analysesCount: number;
  registrationDate: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme, themeType } = useTheme();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'preset'>('upload');
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  
  const [profile, setProfile] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    position: t('posDentist'),
    laboratory: '',
    city: '',
    experience: '',
    specialization: [],
    avatarType: 'preset',
    avatarUrl: '',
    avatarPresetId: 1,
  });

  const [statistics, setStatistics] = useState<Statistics>({
    ordersCount: 0,
    analysesCount: 0,
    registrationDate: '',
  });

  useEffect(() => {
    loadProfile();
    loadStatistics();
  }, []);

  const loadProfile = async () => {
    try {
      const userId = user?.id;
      if (!userId) return;

      const profileRef = dbRef(database, `users/${userId}/profile`);
      const snapshot = await get(profileRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        setProfile(data as ProfileData);
        
        // If profile exists but firstName/lastName are empty, fallback to user.name
        if (!data.firstName && !data.lastName && user?.name) {
          const nameParts = user.name.trim().split(' ');
          setProfile(prev => ({
            ...prev,
            lastName: nameParts[0] || '',
            firstName: nameParts.slice(1).join(' ') || '',
          }));
        }
      } else {
        // Fallback: try to parse from user's name if profile doesn't exist
        if (user?.name) {
          const nameParts = user.name.trim().split(' ');
          setProfile(prev => ({
            ...prev,
            lastName: nameParts[0] || '',
            firstName: nameParts.slice(1).join(' ') || '',
          }));
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadStatistics = async () => {
    try {
      const userId = user?.id;
      if (!userId) return;

      // Load orders count
      const ordersRef = dbRef(database, `orders/${userId}`);
      const ordersSnapshot = await get(ordersRef);
      const ordersData = ordersSnapshot.val();
      const ordersCount = ordersData ? Object.keys(ordersData).length : 0;
      
      // Load analyses count (from color-analyzer results)
      const analysesRef = dbRef(database, `colorAnalyses/${userId}`);
      const analysesSnapshot = await get(analysesRef);
      const analysesData = analysesSnapshot.val();
      const analysesCount = analysesData ? Object.keys(analysesData).length : 0;

      // Get registration date from user data
      const userRef = dbRef(database, `users/${userId}`);
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val();
      const regDate = userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString('ru-RU') : '';

      setStatistics({
        ordersCount,
        analysesCount,
        registrationDate: regDate,
      });
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const handleAvatarPress = () => {
    setAvatarModalVisible(true);
  };

  const handleUploadPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const userId = user?.id;
        if (!userId) return;

        // Upload to Firebase Storage
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        const storageRef = ref(storage, `avatars/${userId}/avatar.jpg`);
        
        await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(storageRef);

        setProfile(prev => ({
          ...prev,
          avatarType: 'custom',
          avatarUrl: downloadUrl,
        }));
        
        setAvatarModalVisible(false);
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить фото');
    }
  };

  const handleSelectPreset = (presetId: number) => {
    setProfile(prev => ({
      ...prev,
      avatarType: 'preset',
      avatarPresetId: presetId,
      avatarUrl: '',
    }));
    setAvatarModalVisible(false);
  };

  const toggleSpecialization = (spec: string) => {
    setProfile(prev => ({
      ...prev,
      specialization: (prev.specialization || []).includes(spec)
        ? (prev.specialization || []).filter(s => s !== spec)
        : [...(prev.specialization || []), spec],
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const userId = user?.id;
      if (!userId) return;

      const profileRef = dbRef(database, `users/${userId}/profile`);
      await set(profileRef, profile);
      Alert.alert('Успешно', 'Профиль сохранен');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Ошибка', 'Не удалось сохранить профиль');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
  setLogoutModalVisible(true);
};

  const getAvatarSource = () => {
    if (profile.avatarType === 'custom' && profile.avatarUrl) {
      return { uri: profile.avatarUrl };
    }
    if (profile.avatarType === 'preset' && profile.avatarPresetId) {
      return PRESET_AVATARS[profile.avatarPresetId - 1] || PRESET_AVATARS[0];
    }
    // Default case - show icon placeholder
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={themeType === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      
      <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
        {/* Header */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center',
          paddingHorizontal: 16, 
          paddingVertical: 12,
          position: 'relative' 
        }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.accent} />
          </TouchableOpacity>
            <Text style={{ 
              position: 'absolute', 
              left: 0, right: 0, 
              textAlign: 'center',
              color: theme.accent, 
              fontSize: 22, 
              fontWeight: 'bold' 
            }}>
              {t('profile')}
            </Text>
        </View>

        {/* Avatar Block */}
        <View style={styles.avatarBlock}>
          <TouchableOpacity onPress={handleAvatarPress}>
            {getAvatarSource() ? (
              <Image source={getAvatarSource()} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="person-circle-outline" size={120} color={theme.accent} />
              </View>
            )}
            <View style={styles.editIcon}>
              <Ionicons name="pencil" size={20} color={theme.bg} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Personal Data */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.accent }]}>{t('personalData')}</Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{t('lastName')}</Text>
            <TextInput
              style={styles.input}
              value={profile.lastName}
              onChangeText={(text) => setProfile(prev => ({ ...prev, lastName: text }))}
              placeholder={t('lastName')}
              placeholderTextColor={theme.textDim}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Имя Отчество</Text>
            <TextInput
              style={styles.input}
              value={profile.firstName}
              onChangeText={(text) => setProfile(prev => ({ ...prev, firstName: text }))}
              placeholder="Имя Отчество"
              placeholderTextColor={theme.textDim}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{t('position')}</Text>
            <View style={styles.pickerContainer}>
              {POSITIONS.map((position) => (
                <TouchableOpacity
                  key={position}
                  style={[
                    styles.pickerOption,
                    profile.position === position && styles.pickerOptionSelected,
                  ]}
                  onPress={() => setProfile(prev => ({ ...prev, position }))}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      profile.position === position && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {position}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Laboratory Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>О лаборатории</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Название лаборатории</Text>
            <TouchableOpacity
              onLongPress={() => {
                Alert.alert('Копирование', 'Текст доступен для выбора и копирования');
              }}
            >
              <TextInput
                style={styles.input}
                value={profile.laboratory}
                onChangeText={(text) => setProfile(prev => ({ ...prev, laboratory: text }))}
                placeholder="Введите название"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Город</Text>
            <TouchableOpacity
              onLongPress={() => {
                Alert.alert('Копирование', 'Текст доступен для выбора и копирования');
              }}
            >
              <TextInput
                style={styles.input}
                value={profile.city}
                onChangeText={(text) => setProfile(prev => ({ ...prev, city: text }))}
                placeholder="Введите город"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Стаж работы (лет)</Text>
            <TouchableOpacity
              onLongPress={() => {
                Alert.alert('Копирование', 'Текст доступен для выбора и копирования');
              }}
            >
              <TextInput
                style={styles.input}
                value={profile.experience}
                onChangeText={(text) => setProfile(prev => ({ ...prev, experience: text }))}
                placeholder="Введите стаж"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Специализация</Text>
            <View style={styles.specializationContainer}>
              {SPECIALIZATIONS.map((spec) => (
                <TouchableOpacity
                  key={spec}
                  style={[
                    styles.chip,
                    (profile.specialization || []).includes(spec) && styles.chipSelected,
                  ]}
                  onPress={() => toggleSpecialization(spec)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      (profile.specialization || []).includes(spec) && styles.chipTextSelected,
                    ]}
                  >
                    {spec}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Статистика</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{statistics.ordersCount}</Text>
              <Text style={styles.statLabel}>Заказов</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{statistics.analysesCount}</Text>
              <Text style={styles.statLabel}>Анализов цвета</Text>
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
          <Text style={styles.saveButtonText}>
            {loading ? 'Сохранение...' : 'Сохранить профиль'}
          </Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity 
          style={{ marginTop: 12, marginBottom: 32, paddingVertical: 16 }} 
          onPress={handleLogout}
        >
          <Text style={{ 
            color: '#ff4444', 
            fontSize: 16, 
            textAlign: 'center', 
            fontWeight: '600' 
          }}>
            🚪 Выйти из аккаунта
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Avatar Modal */}
      <Modal
        visible={avatarModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAvatarModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'upload' && styles.tabActive]}
                onPress={() => setActiveTab('upload')}
              >
                <Text style={[styles.tabText, activeTab === 'upload' && styles.tabTextActive]}>
                  Загрузить фото
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'preset' && styles.tabActive]}
                onPress={() => setActiveTab('preset')}
              >
                <Text style={[styles.tabText, activeTab === 'preset' && styles.tabTextActive]}>
                  Выбрать аватар
                </Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'upload' ? (
              <View style={styles.uploadContent}>
                <TouchableOpacity style={styles.uploadButton} onPress={handleUploadPhoto}>
                  <Ionicons name="camera" size={32} color="#FFD700" />
                  <Text style={styles.uploadButtonText}>Выбрать из галереи</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.presetContent}>
                <FlatList
                  data={PRESET_AVATARS}
                  numColumns={3}
                  keyExtractor={(_, index) => index.toString()}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={[
                        styles.presetAvatar,
                        profile.avatarPresetId === index + 1 && styles.presetAvatarSelected,
                      ]}
                      onPress={() => handleSelectPreset(index + 1)}
                    >
                      <Image source={item} style={styles.presetAvatarImage} />
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.presetList}
                />
              </View>
            )}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setAvatarModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Logout Modal */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 30,
        }}>
          <View style={{
            backgroundColor: '#031427',
            borderRadius: 20,
            padding: 24,
            width: '100%',
            borderWidth: 1,
            borderColor: 'rgba(255,215,0,0.3)',
          }}>
            <Text style={{
              color: '#FFD700',
              fontSize: 20,
              fontWeight: 'bold',
              textAlign: 'center',
              marginBottom: 12,
            }}>
              Выход из аккаунта
            </Text>
            <Text style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 15,
              textAlign: 'center',
              marginBottom: 24,
            }}>
              Вы уверены, что хотите выйти?
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,215,0,0.3)',
                  alignItems: 'center',
                }}
                onPress={() => setLogoutModalVisible(false)}
              >
                <Text style={{ color: '#FFD700', fontSize: 16 }}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: '#ff4444',
                  alignItems: 'center',
                }}
                onPress={async () => {
                  setLogoutModalVisible(false);
                  await AsyncStorage.removeItem('user');
                  router.replace('/auth');
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                  Выйти
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#031427',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginTop: 60,
    marginBottom: 30,
  },
  avatarBlock: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFD700',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFD700',
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  pickerOptionSelected: {
    backgroundColor: 'rgba(255,215,0,0.2)',
    borderColor: '#FFD700',
  },
  pickerOptionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  pickerOptionTextSelected: {
    color: '#FFD700',
  },
  specializationContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  chipSelected: {
    backgroundColor: 'rgba(255,215,0,0.2)',
    borderColor: '#FFD700',
  },
  chipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  chipTextSelected: {
    color: '#FFD700',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginVertical: 20,
  },
  saveButtonText: {
    color: '#031427',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 40,
  },
  logoutButtonText: {
    color: '#FF4444',
    fontSize: 16,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#031427',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 25,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  tabActive: {
    backgroundColor: '#FFD700',
  },
  tabText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#031427',
  },
  uploadContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  uploadButton: {
    alignItems: 'center',
    gap: 10,
  },
  uploadButtonText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '500',
  },
  presetContent: {
    flex: 1,
  },
  presetList: {
    alignItems: 'center',
  },
  presetAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    margin: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetAvatarSelected: {
    borderColor: '#FFD700',
  },
  presetAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  modalCloseButton: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  modalCloseButtonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
  },
});
