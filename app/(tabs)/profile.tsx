import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ref as dbRef, equalTo, get, onValue, orderByChild, query, remove, set } from 'firebase/database';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import {
    Alert,
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
import { getFirebaseDB, getFirebaseStorage } from '../../constants/firebase';
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

interface ProfileData {
  firstName: string;
  lastName: string;
  patronymic: string;
  position: string;
  laboratory: string;
  city: string;
  experience: string;
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

interface ConnectionRequest {
  id: string;
  from: string;
  to: string;
  status: 'pending' | 'accepted' | 'rejected';
  senderName: string;
  senderRole: 'Врач' | 'Техник';
}

type FeedbackType = 'success' | 'error';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'preset'>('upload');
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [isProfDataExpanded, setIsProfDataExpanded] = useState(false);
  
  const [profile, setProfile] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    patronymic: '',
    position: t('posDentist'),
    laboratory: '',
    city: '',
    experience: '',
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
  const [recommendedPartners, setRecommendedPartners] = useState<LinkedPartner[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<ConnectionRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
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

  const loadProfilePartners = () => {
    const userId = user?.uid || user?.id;
    const userRole = user?.role;
    if (!userId || !userRole) {
      setLinkedPartners([]);
      return () => {};
    }

    const partnershipsRef = dbRef(getFirebaseDB(), 'partnerships');
    const unsubscribe = onValue(partnershipsRef, (snapshot) => {
      if (!snapshot.exists()) {
        setLinkedPartners([]);
        loadRecommendedPartners(userId, userRole, []);
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

        if (userRole === 'doctor' && p.doctorUid === userId && p.technicianUid) {
          if (!seenIds.has(p.technicianUid)) {
            seenIds.add(p.technicianUid);
            partners.push({
              id: p.technicianUid,
              name: p.technicianName || 'Коллега',
              role: 'Техник',
            });
          }
        } else if (userRole === 'technician' && p.technicianUid === userId && p.doctorUid) {
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
      loadRecommendedPartners(userId, userRole, partners);
    }, (error) => {
      console.log("=== Партнёры: ошибка слушателя ===", error.message);
    });

    return unsubscribe;
  };

  const loadRecommendedPartners = async (userId: string, userRole: string, directPartners: LinkedPartner[]) => {
    try {
      if (directPartners.length === 0) {
        setRecommendedPartners([]);
        return;
      }

      const partnershipsRef = dbRef(getFirebaseDB(), 'partnerships');
      const snapshot = await get(partnershipsRef);

      if (!snapshot.exists()) {
        setRecommendedPartners([]);
        return;
      }

      const partnershipsData = snapshot.val() as Record<string, {
        doctorUid?: string;
        doctorName?: string;
        technicianUid?: string;
        technicianName?: string;
      }>;

      const recommended: LinkedPartner[] = [];
      const seenIds = new Set<string>(directPartners.map(p => p.id));
      seenIds.add(userId);

      Object.values(partnershipsData).forEach((p) => {
        if (!p) return;

        // Check if this partnership involves one of our direct partners (mutual connection)
        const partnerId = userRole === 'doctor' ? p.technicianUid : p.doctorUid;
        const targetId = userRole === 'doctor' ? p.doctorUid : p.technicianUid;
        const targetName = userRole === 'doctor' ? p.doctorName : p.technicianName;
        const targetRole = userRole === 'doctor' ? 'Врач' : 'Техник';

        // Only include if partnership exists for both directions (mutual)
        const reverseKey = `${targetId}_${partnerId}`;
        const isMutual = partnershipsData[reverseKey] !== undefined;

        if (partnerId && directPartners.some(dp => dp.id === partnerId) && targetId && isMutual) {
          if (!seenIds.has(targetId)) {
            seenIds.add(targetId);
            recommended.push({
              id: targetId,
              name: targetName || 'Коллега',
              role: targetRole,
            });
          }
        }
      });

      setRecommendedPartners(recommended);
      console.log("=== Рукопожатия: список обновлен ===");
    } catch (error) {
      console.log("=== Рукопожатия: ошибка загрузки ===", (error as any)?.message);
    }
  };

  useEffect(() => {
    const userId = user?.uid || user?.id || '';
    if (!userId) return;

    loadProfile();
    loadStatistics();
    loadInviteCode();

    const unsubscribePartners = loadProfilePartners();
    const unsubscribeRequests = loadIncomingRequests();

    const profileRef = dbRef(getFirebaseDB(), `users/${userId}/profile`);
    const unsubscribeProfile = onValue(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const rolePosition =
          user?.role === 'doctor'
            ? 'Стоматолог'
            : user?.role === 'technician'
              ? 'Зубной техник'
              : data.position;
        const mergedProfile = { ...(data as ProfileData), position: rolePosition };
        setProfile(mergedProfile);
        AsyncStorage.setItem('userProfile', JSON.stringify(mergedProfile)).catch(() => {});
      }
    });

    const userRef = dbRef(getFirebaseDB(), `users/${userId}`);
    const unsubscribeUser = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.inviteCode) setInviteCode(data.inviteCode);
        if (data.createdAt) {
          setStatistics(prev => ({
            ...prev,
            registrationDate: new Date(data.createdAt).toLocaleDateString('ru-RU'),
          }));
        }
      }
    });

    return () => {
      unsubscribePartners();
      unsubscribeRequests();
      unsubscribeProfile();
      unsubscribeUser();
    };
  }, [user]);

  const loadProfile = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      const userId = currentUser?.uid || user?.uid || currentUser?.id || user?.id;
      if (!userId) {
        console.log('Profile: No userId yet, skipping load');
        return;
      }

      console.log('Profile: Loading profile for userId:', userId);
      const profileRef = dbRef(getFirebaseDB(), `users/${userId}/profile`);
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
        const mergedProfile = { ...(data as ProfileData), position: rolePosition };
        setProfile(mergedProfile);
        await AsyncStorage.setItem('userProfile', JSON.stringify(mergedProfile));

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
      console.log("=== Профиль: ошибка загрузки ===", (error as any)?.message);
    }
  };

  const loadStatistics = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      const userId = currentUser?.uid || user?.uid || currentUser?.id || user?.id;
      if (!userId) return;

      // Load orders count
      const role = currentUser?.role || user?.role;
      const field = role === 'technician' ? 'technicianId' : 'doctorId';
      const ordersQuery = query(dbRef(getFirebaseDB(), 'orders'), orderByChild(field), equalTo(userId));
      const ordersSnapshot = await get(ordersQuery);
      const ordersData = ordersSnapshot.val();
      const ordersCount = ordersData ? Object.keys(ordersData).length : 0;
      
      // Load analyses count (from color-analyzer results)
      const analysesRef = dbRef(getFirebaseDB(), `colorAnalyses/${userId}`);
      const analysesSnapshot = await get(analysesRef);
      const analysesData = analysesSnapshot.val();
      const analysesCount = analysesData ? Object.keys(analysesData).length : 0;

      // Get registration date from user data
      const userRef = dbRef(getFirebaseDB(), `users/${userId}`);
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val();
      const regDate = userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString('ru-RU') : '';

      setStatistics({
        ordersCount,
        analysesCount,
        registrationDate: regDate,
      });
    } catch (error) {
      console.log("=== Статистика: ошибка загрузки ===", (error as any)?.message);
    }
  };

  const loadInviteCode = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      const userId = currentUser?.uid || user?.uid || currentUser?.id || user?.id;
      if (!userId) return;

      const userRef = dbRef(getFirebaseDB(), `users/${userId}`);
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
      console.log("=== Инвайт-код: ошибка загрузки ===", (error as any)?.message);
    }
  };

  const handleLinkPartner = async () => {
    try {
      setLinkingLoading(true);
      const userId = user?.uid || user?.id;
      const userName = user?.name;
      const userRole = user?.role;
      if (!userId || !userName || !userRole) return;

      // Query for user with the entered invite code
      const usersRef = dbRef(getFirebaseDB(), 'users');
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

      const targetUserRole = targetUser.role;

      if (userRole === targetUserRole) {
        showFeedback('Ошибка', 'Нельзя связать пользователей с одинаковой ролью', 'error');
        return;
      }

      // Check if request already exists
      const requestsRef = dbRef(getFirebaseDB(), 'connection_requests');
      const requestsSnapshot = await get(requestsRef);
      if (requestsSnapshot.exists()) {
        const requestsData = requestsSnapshot.val() as Record<string, any>;
        for (const [key, req] of Object.entries(requestsData)) {
          if (req && ((req.from === userId && req.to === targetUser.uid) || (req.from === targetUser.uid && req.to === userId))) {
            if (req.status === 'pending') {
              showFeedback('Уже отправлено', 'Запрос уже отправлен или ожидает подтверждения', 'error', 'Ок');
              return;
            }
          }
        }
      }

      // Create connection request
      const requestId = `${userId}_${targetUser.uid}_${Date.now()}`;
      const requestRef = dbRef(getFirebaseDB(), `connection_requests/${requestId}`);
      await set(requestRef, {
        from: userId,
        to: targetUser.uid,
        status: 'pending',
        senderName: userName,
        senderRole: userRole === 'doctor' ? 'Врач' : 'Техник',
        createdAt: Date.now(),
      });

      setPartnerCode('');
      setToast({ visible: true, message: 'Успешно. Запрос на связь отправлен' });
      setTimeout(() => setToast({ visible: false, message: '' }), 2500);
      console.log("=== Запрос на связь отправлен ===");
    } catch (error) {
      console.log("=== Отправка запроса: ошибка ===", (error as any)?.message);
      showFeedback('Ошибка', 'Не удалось отправить запрос', 'error');
    } finally {
      setLinkingLoading(false);
    }
  };

  const handleRemovePartner = async (partnerId: string) => {
    Alert.alert(
      'Удаление коллеги',
      'Вы уверены, что хотите удалить этого пользователя из списка коллег?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              const storedUser = await AsyncStorage.getItem('user');
              const currentUser = storedUser ? JSON.parse(storedUser) : null;
              const userId = currentUser?.uid || user?.uid || currentUser?.id || user?.id;
              if (!userId) return;

              // Remove both partnership keys (mutual deletion)
              const key1 = `${userId}_${partnerId}`;
              const key2 = `${partnerId}_${userId}`;

              const ref1 = dbRef(getFirebaseDB(), `partnerships/${key1}`);
              const ref2 = dbRef(getFirebaseDB(), `partnerships/${key2}`);

              await remove(ref1);
              await remove(ref2);

              console.log("=== Коллега успешно удален ===");
            } catch (error) {
              console.log("=== Удаление коллеги: ошибка ===", (error as any)?.message);
            }
          },
        },
      ]
    );
  };

  const loadIncomingRequests = () => {
    const userId = user?.uid || user?.id;
    if (!userId) {
      setIncomingRequests([]);
      setSentRequests(new Set());
      return () => {};
    }

    const requestsRef = dbRef(getFirebaseDB(), 'connection_requests');
    const unsubscribe = onValue(requestsRef, (snapshot) => {
      if (!snapshot.exists()) {
        setIncomingRequests([]);
        setSentRequests(new Set());
        return;
      }

      const requestsData = snapshot.val() as Record<string, any>;
      const pendingRequests: ConnectionRequest[] = [];
      const sentRequestTargets = new Set<string>();

      Object.entries(requestsData).forEach(([key, req]) => {
        if (req && req.status === 'pending') {
          if (req.to === userId || req.to === user?.id) {
            pendingRequests.push({
              id: key,
              from: req.from,
              to: req.to,
              status: req.status,
              senderName: req.senderName,
              senderRole: req.senderRole,
            });
          } else if (req.from === userId || req.from === user?.id) {
            sentRequestTargets.add(req.to);
          }
        }
      });

      setIncomingRequests(pendingRequests);
      setSentRequests(sentRequestTargets);
    }, (error) => {
      console.log("=== Запросы: ошибка слушателя ===", error.message);
    });

    return unsubscribe;
  };

  const handleAcceptRequest = async (requestId: string, fromUserId: string, senderName: string, senderRole: string) => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      const userId = currentUser?.uid || user?.uid || currentUser?.id || user?.id;
      const userRole = currentUser?.role || user?.role;
      const userName = currentUser?.name || user?.name;
      if (!userId || !userRole || !userName) return;

      // Update request status to accepted
      const requestRef = dbRef(getFirebaseDB(), `connection_requests/${requestId}`);
      await set(requestRef, { status: 'accepted' });

      // Create mutual partnership (write to both sides)
      const doctorUid = userRole === 'doctor' ? userId : fromUserId;
      const doctorName = userRole === 'doctor' ? userName : senderName;
      const technicianUid = userRole === 'technician' ? userId : fromUserId;
      const technicianName = userRole === 'technician' ? userName : senderName;

      const partnershipRef1 = dbRef(getFirebaseDB(), `partnerships/${userId}_${fromUserId}`);
      const partnershipRef2 = dbRef(getFirebaseDB(), `partnerships/${fromUserId}_${userId}`);

      await set(partnershipRef1, {
        doctorUid,
        doctorName,
        technicianUid,
        technicianName,
        createdAt: Date.now(),
      });
      await set(partnershipRef2, {
        doctorUid,
        doctorName,
        technicianUid,
        technicianName,
        createdAt: Date.now(),
      });

      await loadProfilePartners();
      await loadIncomingRequests();
      showFeedback('Успешно', 'Коллега добавлен в ваш список');
      console.log("=== Запрос принят ===");
    } catch (error) {
      console.log("=== Принятие запроса: ошибка ===", (error as any)?.message);
      showFeedback('Ошибка', 'Не удалось принять запрос', 'error');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const requestRef = dbRef(getFirebaseDB(), `connection_requests/${requestId}`);
      await set(requestRef, { status: 'rejected' });

      await loadIncomingRequests();
      console.log("=== Запрос отклонен ===");
    } catch (error) {
      console.log("=== Отклонение запроса: ошибка ===", (error as any)?.message);
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
        const storageRef = ref(getFirebaseStorage(), `avatars/${userId}/avatar.jpg`);
        
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

  const handleSave = async () => {
    try {
      setLoading(true);
      const userId = user?.id;
      if (!userId) return;

      const profileRef = dbRef(getFirebaseDB(), `users/${userId}/profile`);
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
    const fromProfile = [profile.lastName, profile.firstName, profile.patronymic].filter(Boolean).join(' ').trim();
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

  // Экспорт личности для Кейс-клуба (динамический аватар в кейсах)
  useEffect(() => {
    const role = user?.role === 'technician' ? 'Зубной техник' : 'Врач';
    (globalThis as any).getCaseClubIdentity = () => ({
      name: getDisplayName(),
      avatarSource: getAvatarSource(),
      role,
    });
    // Синхронизируем кеш профиля в AsyncStorage
    const cached = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      position: role,
      avatarType: profile.avatarType,
      avatarUrl: profile.avatarUrl,
      avatarPresetId: profile.avatarPresetId,
    };
    AsyncStorage.setItem('userProfile', JSON.stringify(cached)).catch(() => {});
  }, [profile, user]);

  const onShareCode = async () => {
    try {
      await Share.share({
        message: `Привет! Присоединяйся к DiLabs. Введи мой Энерго-код ${inviteCode} и получи +50 зарядов ИИ на анализ зубов!`,
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
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
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

          <Text style={styles.networkSubLabel}>Ваш Энерго-код</Text>
          <View style={styles.inviteCodeRow}>
            <Text style={styles.inviteCode}>{inviteCode || user?.inviteCode || '···'}</Text>
            <TouchableOpacity
              style={styles.shareCodeButton}
              onPress={onShareCode}
              disabled={!(inviteCode || user?.inviteCode)}
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

          {incomingRequests.length > 0 && (
            <>
              <Text style={styles.partnersSectionTitle}>Входящие запросы на связь</Text>
              {incomingRequests.map((request) => (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestAvatar}>
                    <Ionicons
                      name={request.senderRole === 'Врач' ? 'medical' : 'construct'}
                      size={24}
                      color={GOLD}
                    />
                  </View>
                  <View style={styles.requestTextContainer}>
                    <Text style={styles.requestSenderName}>{request.senderName}</Text>
                    <Text style={styles.requestSenderRole}>{request.senderRole}</Text>
                  </View>
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      onPress={() => handleAcceptRequest(request.id, request.from, request.senderName, request.senderRole)}
                      style={styles.acceptButton}
                    >
                      <Ionicons name="checkmark-circle" size={28} color="#4ade80" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRejectRequest(request.id)}
                      style={styles.rejectButton}
                    >
                      <Ionicons name="close-circle" size={28} color="#ff6b6b" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}

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
                <View style={styles.partnerInfoContainer}>
                  <Text style={styles.partnerName} numberOfLines={2}>
                    {partner.name}
                  </Text>
                  {sentRequests.has(partner.id) && (
                    <Text style={styles.pendingStatus}>в ожидании</Text>
                  )}
                </View>
                <View style={styles.partnerRoleBadge}>
                  <Text style={styles.partnerRoleText}>{partner.role}</Text>
                </View>
                {!sentRequests.has(partner.id) && (
                  <TouchableOpacity
                    onPress={() => handleRemovePartner(partner.id)}
                    style={styles.removePartnerButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}

          {recommendedPartners.length > 0 && (
            <>
              <Text style={styles.partnersSectionTitle}>Коллеги ваших партнеров</Text>
              {recommendedPartners.map((partner) => (
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
                  <TouchableOpacity
                    onPress={() => {
                      setPartnerCode(partner.id);
                      handleLinkPartner();
                    }}
                    style={styles.addPartnerButton}
                  >
                    <Ionicons name="add-circle-outline" size={24} color={GOLD} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </View>

        {toast.visible && (
          <View style={styles.toastContainer}>
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        )}

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
  partnerInfoContainer: {
    flex: 1,
  },
  pendingStatus: {
    color: '#f2ca50',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
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
  removePartnerButton: {
    padding: 8,
    marginLeft: 8,
  },
  addPartnerButton: {
    padding: 8,
    marginLeft: 8,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242, 202, 80, 0.08)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.2)',
  },
  requestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(242, 202, 80, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  requestTextContainer: {
    flex: 1,
  },
  requestSenderName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  requestSenderRole: {
    color: '#f2ca50',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  acceptButton: {
    padding: 8,
    marginRight: 8,
  },
  rejectButton: {
    padding: 8,
  },
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(76, 175, 80, 0.95)',
    padding: 16,
    alignItems: 'center',
    paddingTop: 60,
  },
  toastText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
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
