import { getFirebaseDB } from '@/constants/firebase';
import { addCase } from '@/data/cases';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { ref, set } from 'firebase/database';
import React, { useState } from 'react';
import {
    Dimensions,
    Image,
    ImageBackground,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_WIDTH = SCREEN_WIDTH - 40;

const VITA_SHADES = ['A1', 'A2', 'A3', 'A3.5', 'B1', 'B2', 'C2', 'D3'];


export default function CreateCaseScreen() {
  const insets = useSafeAreaInsets();
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [isRiddle, setIsRiddle] = useState(false);
  const [riddleAnswer, setRiddleAnswer] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [overlay, setOverlay] = useState<{ title: string; message: string; icon?: string } | null>(null);

  const pickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 7,
      quality: 0.3,
      base64: true,
    });
    if (!result.canceled) {
      const newUris = result.assets.map(a =>
        a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri
      );
      setPhotos(prev => [...prev, ...newUris].slice(0, 7));
    }
  };

  const handlePublish = async () => {
    if (!description.trim()) {
      setOverlay({ title: 'Ошибка', message: 'Пожалуйста, добавьте описание кейса', icon: 'alert-circle-outline' });
      return;
    }

    if (photos.length === 0) {
      setOverlay({ title: 'Ошибка публикации', message: 'Пожалуйста, загрузите хотя бы одну фотографию клинического случая!', icon: 'alert-circle-outline' });
      return;
    }

    const safeDescription = description.trim();
    const safeMedia = photos.map((uri, i) => ({ uri, stage: `Фото ${i + 1}` }));
    const safeCoverIndex = Math.min(coverIndex, photos.length - 1);

    const newCase = {
      id: Date.now().toString(),
      author: isAnonymous ? 'Анонимный коллега' : 'Пользователь',
      role: 'Врач' as const,
      avatar: '',
      tags: [],
      description: safeDescription.slice(0, 100),
      fullDescription: safeDescription,
      media: safeMedia,
      coverIndex: safeCoverIndex,
      commentsList: [],
      aiReview: 'Кейс опубликован. Ожидайте AI-анализ.',
      activity: 0,
      anonymous: isAnonymous,
    };

    if (isRiddle && riddleAnswer) {
      Object.assign(newCase, {
        riddle: {
          question: 'Угадайте оттенок VITA',
          options: [
            { label: 'A1', percent: 20 },
            { label: 'A2', percent: 30 },
            { label: 'A3', percent: 30 },
            { label: 'B1', percent: 20 },
          ],
          correct: riddleAnswer ?? '',
        },
      });
    }

    let authorName = '';
    let authorRole: 'doctor' | 'technician' = 'doctor';
    let authorId = '';
    let authorEmail = '';
    let avatarPresetId: number | null = null;
    let avatarUrl: string = '';
    try {
      const [rawUser, rawProfile] = await Promise.all([
        AsyncStorage.getItem('user'),
        AsyncStorage.getItem('userProfile'),
      ]);
      if (rawUser) {
        const u = JSON.parse(rawUser);
        if (u.name) authorName = u.name;
        if (u.role) authorRole = u.role;
        if (u.id) authorId = u.id;
        if (u.email) authorEmail = u.email;
      }
      if (rawProfile) {
        const p = JSON.parse(rawProfile);
        if (p.avatarPresetId) avatarPresetId = p.avatarPresetId;
        if (p.avatarType === 'custom' && p.avatarUrl) avatarUrl = p.avatarUrl;
      }
    } catch {}

    const roleValue = authorRole === 'technician' ? 'Техник' : 'Врач';
    newCase.author = isAnonymous ? 'Анонимный коллега' : (authorName || 'Пользователь');
    newCase.avatar = isAnonymous ? '' : (avatarUrl || '');
    (newCase as any).avatarPresetId = isAnonymous ? null : avatarPresetId;
    (newCase as any).isOwn = !isAnonymous;
    (newCase as any).role = roleValue;
    (newCase as any).authorId = authorId;
    (newCase as any).authorEmail = authorEmail;

    console.log('[CreateCase] newCase prepared', newCase);

    // Фото уже в base64 — загрузка в Storage не нужна

    console.log('[CreateCase] Сохранение в Firebase + AsyncStorage...');
    try {
      // Записываем только этот пост в его узел — не трогаем остальные
      await set(ref(getFirebaseDB(), `case_club_posts/${newCase.id}`), newCase);
      // Обновляем локальный кэш: читаем существующее, заменяем/добавляем этот пост
      const existing = await AsyncStorage.getItem('@global_case_club_posts');
      const posts: any[] = existing ? JSON.parse(existing) : [];
      const updated = [newCase, ...posts.filter((p: any) => p.id !== newCase.id)];
      await AsyncStorage.setItem('@global_case_club_posts', JSON.stringify(updated));
      console.log('[CreateCase] Сохранено. id:', newCase.id);
    } catch (err) {
      console.error('[CreateCase] Ошибка записи:', err);
    }

    addCase(newCase);
    console.log('[CreateCase] Мгновенный возврат в ленту');
    router.replace('/(tabs)/case-club' as any);
  };

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={{ flex: 1, backgroundColor: 'transparent' }}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#f2ca50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Новый кейс</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Media upload */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="images-outline" size={20} color="#f2ca50" />
              <Text style={styles.sectionTitle}>Фото ({photos.length}/7)</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
              <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 4 }}>
                {photos.map((photo, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setCoverIndex(index)}
                    style={[
                      styles.thumb,
                      coverIndex === index && styles.thumbCover,
                    ]}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: photo }} style={styles.thumbImage} />
                    {coverIndex === index && (
                      <View style={styles.coverLabel}>
                        <Text style={styles.coverLabelText}>ОБЛОЖКА</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => {
                        const next = photos.filter((_, i) => i !== index);
                        setPhotos(next);
                        if (coverIndex >= next.length) setCoverIndex(Math.max(0, next.length - 1));
                      }}
                      style={styles.thumbRemove}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close" size={12} color="#fff" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
                {photos.length < 7 && (
                  <TouchableOpacity onPress={pickPhotos} style={styles.addPhotoBtn} activeOpacity={0.8}>
                    <Ionicons name="add" size={28} color="#f2ca50" />
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="document-text-outline" size={20} color="#f2ca50" />
              <Text style={styles.sectionTitle}>Описание</Text>
            </View>
            <TextInput
              style={styles.textArea}
              placeholder="Опишите клиническую ситуацию, протокол и результат..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              multiline
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Riddle switch */}
          <View style={styles.section}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Сделать кейсом-загадкой</Text>
                <Text style={styles.switchHint}>Коллеги попробуют угадать оттенок VITA</Text>
              </View>
              <Switch
                value={isRiddle}
                onValueChange={setIsRiddle}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(79,195,247,0.5)' }}
                thumbColor={isRiddle ? '#4fc3f7' : '#f2ca50'}
              />
            </View>

            {isRiddle && (
              <View style={styles.riddleAnswerBlock}>
                <Text style={styles.riddleAnswerLabel}>Правильный оттенок VITA:</Text>
                <View style={styles.shadeGrid}>
                  {VITA_SHADES.map((shade) => {
                    const active = riddleAnswer === shade;
                    return (
                      <TouchableOpacity
                        key={shade}
                        activeOpacity={0.8}
                        style={[styles.shadeChip, active && styles.shadeChipActive]}
                        onPress={() => setRiddleAnswer(shade)}
                      >
                        <Text style={[styles.shadeChipText, active && styles.shadeChipTextActive]}>
                          {shade}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* Anonymous (blind) publication switch */}
          <View style={styles.section}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Анонимная публикация (Слепая)</Text>
                <Text style={styles.switchHint}>
                  Вместо имени — «Анонимный коллега», аватар скрыт силуэтом
                </Text>
              </View>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(79,195,247,0.5)' }}
                thumbColor={isAnonymous ? '#4fc3f7' : '#f2ca50'}
              />
            </View>
            {isAnonymous && (
              <View style={styles.anonPreview}>
                <View style={styles.anonAvatar}>
                  <Ionicons name="person" size={20} color="rgba(242,202,80,0.7)" />
                </View>
                <Text style={styles.anonName}>Анонимный коллега</Text>
              </View>
            )}
          </View>

          {/* Publish button */}
          <TouchableOpacity activeOpacity={0.85} style={styles.publishButton} onPress={handlePublish}>
            <View style={styles.publishContent}>
              <Ionicons name="cloud-upload-outline" size={22} color="#1a1206" />
              <Text style={styles.publishText}>Опубликовать кейс</Text>
            </View>
          </TouchableOpacity>

          <View style={{ height: 16 }} />
        </ScrollView>
      </View>

      {/* Dark overlay for alerts */}
      {overlay && (
        <Modal visible={!!overlay} transparent animationType="fade" onRequestClose={() => setOverlay(null)}>
          <TouchableOpacity style={styles.overlayBackdrop} activeOpacity={1} onPress={() => setOverlay(null)}>
            <View style={styles.overlayCard}>
              {overlay.icon && <Ionicons name={overlay.icon as any} size={40} color="#f2ca50" />}
              <Text style={styles.overlayTitle}>{overlay.title}</Text>
              <Text style={styles.overlayMessage}>{overlay.message}</Text>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(242, 202, 80, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTitle: { flex: 1, fontSize: 26, fontWeight: '700', color: '#ffffff', letterSpacing: 0.5 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 80 },

  section: {
    backgroundColor: 'rgba(20, 26, 40, 0.78)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.22)',
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff', letterSpacing: 0.3 },

  textArea: {
    minHeight: 120,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 15, 26, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
    color: '#ffffff',
  },

  thumb: {
    width: 84,
    height: 84,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbCover: { borderColor: '#f2ca50' },
  thumbImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(242,202,80,0.82)',
    alignItems: 'center',
    paddingVertical: 3,
  },
  coverLabelText: { fontSize: 8, fontWeight: '800', color: '#1a1206', letterSpacing: 0.5 },
  thumbRemove: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e74c3c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoBtn: {
    width: 84,
    height: 84,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(242,202,80,0.5)',
    backgroundColor: 'rgba(242,202,80,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  switchRow: { flexDirection: 'row', alignItems: 'center' },
  switchTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  switchHint: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },

  riddleAnswerBlock: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  riddleAnswerLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginBottom: 12 },
  shadeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shadeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(10, 15, 26, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.4)',
  },
  shadeChipActive: { backgroundColor: 'rgba(79, 195, 247, 0.18)', borderColor: '#4fc3f7' },
  shadeChipText: { fontSize: 14, fontWeight: '800', color: '#f2ca50' },
  shadeChipTextActive: { color: '#4fc3f7' },

  anonPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  anonAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a2030',
    borderWidth: 1.5,
    borderColor: 'rgba(242, 202, 80, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  anonName: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },

  publishButton: {
    width: CONTENT_WIDTH,
    height: 56,
    marginTop: 8,
    borderRadius: 28,
    backgroundColor: '#f2ca50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f2ca50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 10,
  },
  publishContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  publishText: { fontSize: 17, fontWeight: '900', color: '#1a1206', letterSpacing: 0.5, textTransform: 'uppercase' },

  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCard: {
    backgroundColor: 'rgba(20, 26, 40, 0.95)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginHorizontal: 40,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.3)',
  },
  overlayTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 12,
    marginBottom: 8,
  },
  overlayMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
});
