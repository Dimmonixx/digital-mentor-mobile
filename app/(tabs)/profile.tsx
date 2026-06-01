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
    FlatList,
    Image,
    ImageBackground,
    Modal,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { database, storage } from '../../constants/firebase';
import { useAuth } from '../../hooks/useAuth';

const GOLD = '#f2ca50';
const DARK_BG = '#031427';

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

interface LinkedPartner {
  id: string;
  name: string;
  role: 'Врач' | 'Техник';
}

type FeedbackType = 'success' | 'error';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme, themeType } = useTheme();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'preset'>('upload');
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [isProfDataExpanded, setIsProfDataExpanded] = useState(false);
  
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

  const [inviteCode, setInviteCode] = useState<string>('');
  const [partnerCode, setPartnerCode] = useState<string>('');
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [linkedPartners, setLinkedPartners] = useState<LinkedPartner[]>([]);
  const [feedbackModal, setFeedbackModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: FeedbackType;
    buttonLabel: string;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'success',
    buttonLabel: 'Отлично',
  });

  const showFeedback = (
    title: string,
    message: string,
    type: FeedbackType = 'success',
    buttonLabel = type === 'success' ? 'Отлично' : 'Ок',
  ) => {
    setFeedbackModal({ visible: true, title, message, type, buttonLabel });
  };

  const closeFeedback = () => {
    setFeedbackModal((prev) => ({ ...prev, visible: false }));
  };

  const loadProfilePartners = async () => {
    try {
      const userId = user?.id;
      if (!userId || !user?.role) {
        setLinkedPartners([]);
        return;
      }

      const partnershipsRef = dbRef(database, 'partnerships');
      const snapshot = await get(partnershipsRef);

      if (!snapshot.exists()) {
        setLinkedPartners([]);
        return;
      }

      const partnershipsData = snapshot.val() as Record<string, {
        doctorUid?: string;
        doctorName?: string;
        technicianUid?: string;
        technicianName?: string;
      }>;

      const partners: LinkedPartner[] = [];
      const seenIds = new Set<string>();

      Object.values(partnershipsData).forEach((p) => {
        if (!p) return;

        if (user.role === 'doctor' && p.doctorUid === userId && p.technicianUid) {
          if (!seenIds.has(p.technicianUid)) {
            seenIds.add(p.technicianUid);
            partners.push({
              id: p.technicianUid,
              name: p.technicianName || 'Коллега',
              role: 'Техник',
            });
          }
        } else if (user.role === 'technician' && p.technicianUid === userId && p.doctorUid) {
          if (!seenIds.has(p.doctorUid)) {
            seenIds.add(p.doctorUid);
            partners.push({
              id: p.doctorUid,
              name: p.doctorName || 'Коллега',
              role: 'Врач',
            });
          }
        }
      });

      setLinkedPartners(partners);
    } catch (error) {
      console.error('Error loading profile partners:', error);
    }
  };

  useEffect(() => {
    loadProfile();
    loadStatistics();
    loadInviteCode();
    loadProfilePartners();
  }, [user]);

  const loadProfile = async () => {
    try {
      const userId = user?.id;
      if (!userId) {
        console.log('Profile: No userId yet, skipping load');
        return;
      }

      console.log('Profile: Loading profile for userId:', userId);
      const profileRef = dbRef(database, `users/${userId}/profile`);
      const snapshot = await get(profileRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log('Profile: Profile data loaded:', data);
        const rolePosition =
          user?.role === 'doctor'
            ? 'Стоматолог'
            : user?.role === 'technician'
              ? 'Зубной техник'
              : data.position;
        setProfile({ ...(data as ProfileData), position: rolePosition });

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
        console.log('Profile: No profile data found, using fallback');
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

  const loadInviteCode = async () => {
    try {
      const userId = user?.id;
      if (!userId) return;

      const userRef = dbRef(database, `users/${userId}`);
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val();

      if (userData && userData.inviteCode) {
        setInviteCode(userData.inviteCode);
      } else {
        // Generate invite code if it doesn't exist
        const code = `DI-${Math.floor(1000 + Math.random() * 9000)}`;
        await set(userRef, { ...userData, inviteCode: code });
        setInviteCode(code);
      }
    } catch (error) {
      console.error('Error loading invite code:', error);
    }
  };

  const handleLinkPartner = async () => {
    try {
      setLinkingLoading(true);
      const userId = user?.id;
      if (!userId) return;

      // Query for user with the entered invite code
      const usersRef = dbRef(database, 'users');
      const snapshot = await get(usersRef);
      const allUsers = snapshot.val();

      if (!allUsers) {
        showFeedback('Ошибка', 'Пользователь с таким кодом не найден', 'error');
        return;
      }

      let targetUser: any = null;
      for (const [uid, userData] of Object.entries(allUsers)) {
        if (userData && (userData as any).inviteCode === partnerCode) {
          targetUser = { uid, ...userData };
          break;
        }
      }

      if (!targetUser) {
        showFeedback('Ошибка', 'Пользователь с таким кодом не найден', 'error');
        return;
      }

      const currentUserRole = user?.role;
      const targetUserRole = targetUser.role;

      if (currentUserRole === targetUserRole) {
        showFeedback('Ошибка', 'Нельзя связать пользователей с одинаковой ролью', 'error');
        return;
      }

      const partnershipKey = `${userId}_${targetUser.uid}`;
      const existingRef = dbRef(database, `partnerships/${partnershipKey}`);
      const existingSnapshot = await get(existingRef);
      if (existingSnapshot.exists()) {
        showFeedback('Уже привязан', 'Этот коллега уже есть в вашем списке', 'error', 'Ок');
        return;
      }

      // Determine who is doctor and who is technician
      const doctorUid = currentUserRole === 'doctor' ? userId : targetUser.uid;
      const doctorName = currentUserRole === 'doctor' ? user?.name : targetUser.name;
      const technicianUid = currentUserRole === 'technician' ? userId : targetUser.uid;
      const technicianName = currentUserRole === 'technician' ? user?.name : targetUser.name;

      // Create partnership document
      const partnershipRef = dbRef(database, `partnerships/${userId}_${targetUser.uid}`);
      await set(partnershipRef, {
        doctorUid,
        doctorName,
        technicianUid,
        technicianName,
        createdAt: Date.now(),
      });

      setPartnerCode('');
      await loadProfilePartners();
      showFeedback('Успешно', 'Коллега успешно привязан!');
    } catch (error) {
      console.error('Error linking partner:', error);
      showFeedback('Ошибка', 'Не удалось привязать коллегу', 'error');
    } finally {
      setLinkingLoading(false);
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
      showFeedback('Ошибка', 'Не удалось загрузить фото', 'error');
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
      showFeedback('Успешно', 'Профиль сохранён');
    } catch (error) {
      console.error('Error saving profile:', error);
      showFeedback('Ошибка', 'Не удалось сохранить профиль', 'error');
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
    return null;
  };

  const getDisplayName = () => {
    const fromProfile = [profile.lastName, profile.firstName].filter(Boolean).join(' ').trim();
    if (fromProfile) return fromProfile;
    if (user?.name) return user.name;
    return 'Пользователь';
  };

  const getRoleBadge = () => {
    if (user?.role === 'doctor') return 'Стоматолог';
    if (user?.role === 'technician') return 'Зубной техник';
    return profile.position || 'Участник DiLabs';
  };

  const labFieldLabel =
    user?.role === 'doctor' ? 'Название клиники' : 'Название лаборатории';

  const onShareCode = async () => {
    try {
      await Share.share({
        message: `Привет! Добавь меня в экосистеме DiLabs. Мой код связи: ${inviteCode}`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.containerInner}>
      <StatusBar barStyle={themeType === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 130 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Nav */}
        <View style={[styles.navBar, { paddingTop: insets.top + 4 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBack}>
            <Ionicons name="arrow-back" size={24} color={GOLD} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>{t('profile')}</Text>
          <View style={styles.navBack} />
        </View>

        {/* 1. Profile hero */}
        <View style={styles.heroCard}>
          <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.9}>
            {getAvatarSource() ? (
              <Image source={getAvatarSource()!} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={52} color={GOLD} />
              </View>
            )}
            <View style={styles.editIcon}>
              <Ionicons name="pencil" size={14} color={DARK_BG} />
            </View>
          </TouchableOpacity>
          <Text style={styles.displayName}>{getDisplayName()}</Text>
          <View style={styles.roleBadge}>
            <Ionicons
              name={user?.role === 'doctor' ? 'medical' : 'construct'}
              size={14}
              color={DARK_BG}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.roleBadgeText}>{getRoleBadge()}</Text>
          </View>
        </View>

        {/* 2. Statistics */}
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

        {/* 3. DiLabs network */}
        <View style={styles.networkBlock}>
          <View style={styles.networkHeader}>
            <Ionicons name="planet-outline" size={18} color={GOLD} />
            <Text style={styles.networkTitle} numberOfLines={1}>
              СЕТЬ DILABS
            </Text>
          </View>

          <Text style={styles.networkSubLabel}>Ваш личный код связи</Text>
          <View style={styles.inviteCodeRow}>
            <Text style={styles.inviteCode}>{inviteCode || '···'}</Text>
            <TouchableOpacity
              style={styles.shareCodeButton}
              onPress={onShareCode}
              disabled={!inviteCode}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="paper-plane-outline" size={22} color={GOLD} />
            </TouchableOpacity>
          </View>

          <View style={styles.networkDivider} />

          <Text style={styles.label}>
            {user?.role === 'doctor' ? 'Код зубного техника' : 'Код врача'}
          </Text>
          <TextInput
            style={styles.input}
            value={partnerCode}
            onChangeText={setPartnerCode}
            placeholder="DI-7492"
            placeholderTextColor="rgba(255,255,255,0.35)"
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={[styles.linkButton, linkingLoading && styles.buttonDisabled]}
            onPress={handleLinkPartner}
            disabled={linkingLoading}
          >
            <Text style={styles.linkButtonText}>
              {linkingLoading ? 'Привязка...' : 'Привязать коллегу'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.partnersSectionTitle}>Связанные коллеги</Text>
          {linkedPartners.length === 0 ? (
            <Text style={styles.partnersEmptyText}>
              Список коллег пуст. Добавьте первого партнера по коду выше
            </Text>
          ) : (
            linkedPartners.map((partner) => (
              <View key={partner.id} style={styles.partnerCard}>
                <View style={styles.partnerAvatar}>
                  <Ionicons
                    name={partner.role === 'Врач' ? 'medical' : 'construct'}
                    size={20}
                    color={GOLD}
                  />
                </View>
                <Text style={styles.partnerName} numberOfLines={2}>
                  {partner.name}
                </Text>
                <View style={styles.partnerRoleBadge}>
                  <Text style={styles.partnerRoleText}>{partner.role}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* 4. Professional data + save (accordion) */}
        <View style={styles.blockCard}>
          <TouchableOpacity
            style={styles.profDataHeader}
            onPress={() => setIsProfDataExpanded((prev) => !prev)}
            activeOpacity={0.8}
          >
            <Text style={styles.profDataHeaderTitle}>Профессиональные данные</Text>
            <Ionicons
              name={isProfDataExpanded ? 'chevron-up' : 'chevron-down'}
              size={22}
              color={GOLD}
            />
          </TouchableOpacity>

          {isProfDataExpanded && (
            <View style={styles.profDataContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{labFieldLabel}</Text>
                <TextInput
                  style={styles.input}
                  value={profile.laboratory}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, laboratory: text }))}
                  placeholder="Введите название"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Город</Text>
                <TextInput
                  style={styles.input}
                  value={profile.city}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, city: text }))}
                  placeholder="Введите город"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Стаж работы (лет)</Text>
                <TextInput
                  style={styles.input}
                  value={profile.experience}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, experience: text }))}
                  placeholder="Например: 8"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  keyboardType="number-pad"
                />
              </View>

              <Text style={[styles.label, { marginTop: 4 }]}>Специализация</Text>
              <View style={styles.specializationContainer}>
                {SPECIALIZATIONS.map((spec) => {
                  const selected = (profile.specialization || []).includes(spec);
                  return (
                    <TouchableOpacity
                      key={spec}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => toggleSpecialization(spec)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {spec}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.saveButton, loading && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={loading}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? 'Сохранение...' : 'Сохранить профиль'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 5. Footer logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ff6b6b" />
          <Text style={styles.logoutButtonText}>Выйти из аккаунта</Text>
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

      {/* Feedback Modal */}
      <Modal
        visible={feedbackModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeFeedback}
      >
        <View style={styles.feedbackOverlay}>
          <View style={styles.feedbackCard}>
            <View style={[
              styles.feedbackIconWrap,
              feedbackModal.type === 'error' && styles.feedbackIconWrapError,
            ]}>
              <Ionicons
                name={feedbackModal.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={36}
                color="#f2ca50"
              />
            </View>
            <Text style={styles.feedbackTitle}>{feedbackModal.title}</Text>
            <Text style={styles.feedbackMessage}>{feedbackModal.message}</Text>
            <TouchableOpacity
              style={styles.feedbackButton}
              onPress={closeFeedback}
              activeOpacity={0.85}
            >
              <Text style={styles.feedbackButtonText}>{feedbackModal.buttonLabel}</Text>
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerInner: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  navBack: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 0.5,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(13, 20, 35, 0.85)',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.2)',
  },
  avatar: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 2,
    borderColor: GOLD,
    backgroundColor: 'rgba(242, 202, 80, 0.08)',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: GOLD,
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: DARK_BG,
  },
  displayName: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 28,
    paddingHorizontal: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: GOLD,
  },
  roleBadgeText: {
    color: DARK_BG,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(8, 14, 28, 0.95)',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.15)',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: GOLD,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    fontWeight: '500',
  },
  networkBlock: {
    backgroundColor: 'rgba(10, 16, 30, 0.92)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.45)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  networkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  networkTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: GOLD,
    letterSpacing: 0.8,
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  shareCodeButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(242, 202, 80, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.35)',
  },
  networkSubLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
  },
  networkDivider: {
    height: 1,
    backgroundColor: 'rgba(242, 202, 80, 0.15)',
    marginVertical: 16,
  },
  blockCard: {
    backgroundColor: 'rgba(13, 20, 35, 0.75)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.12)',
  },
  profDataHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profDataHeaderTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 0.3,
    marginRight: 8,
  },
  profDataContent: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: GOLD,
    marginBottom: 18,
    letterSpacing: 1,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.18)',
  },
  specializationContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.2)',
  },
  chipSelected: {
    backgroundColor: 'rgba(242, 202, 80, 0.18)',
    borderColor: GOLD,
  },
  chipText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
  },
  chipTextSelected: {
    color: GOLD,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    color: DARK_BG,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.25)',
  },
  logoutButtonText: {
    color: '#ff6b6b',
    fontSize: 15,
    fontWeight: '600',
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
  inviteCode: {
    fontSize: 34,
    fontWeight: '800',
    color: GOLD,
    letterSpacing: 4,
    textAlign: 'center',
    flexShrink: 1,
  },
  linkButton: {
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 18,
  },
  linkButtonText: {
    color: DARK_BG,
    fontSize: 15,
    fontWeight: '700',
  },
  partnersSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(242, 202, 80, 0.85)',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  partnersEmptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 10, 22, 0.8)',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.2)',
  },
  partnerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(242, 202, 80, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  partnerName: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginRight: 8,
  },
  partnerRoleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f2ca50',
    backgroundColor: 'rgba(242, 202, 80, 0.1)',
  },
  partnerRoleText: {
    color: '#f2ca50',
    fontSize: 12,
    fontWeight: '700',
  },
  feedbackOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  feedbackCard: {
    width: '100%',
    backgroundColor: 'rgba(13, 17, 23, 0.96)',
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#f2ca50',
    alignItems: 'center',
    shadowColor: '#f2ca50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  feedbackIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(242, 202, 80, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  feedbackIconWrapError: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  feedbackTitle: {
    color: '#f2ca50',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  feedbackMessage: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  feedbackButton: {
    width: '100%',
    backgroundColor: '#f2ca50',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  feedbackButtonText: {
    color: '#0a0f1d',
    fontSize: 16,
    fontWeight: '700',
  },
});
