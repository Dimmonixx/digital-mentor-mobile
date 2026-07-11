import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
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


export default function CreateCaseScreen() {
  const insets = useSafeAreaInsets();
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [category, setCategory] = useState<'case' | 'sos' | 'trash'>('case');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
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

  const uploadBase64Photo = async (base64Uri: string): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('file', base64Uri);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      );
      const data = await response.json();
      if (!response.ok) {
        console.error('[CreateCase] Cloudinary error:', data);
        return null;
      }
      return data.secure_url || null;
    } catch (e) {
      console.error('[CreateCase] uploadBase64Photo error:', e);
      return null;
    }
  };

  const handlePublish = async () => {
    if (isPublishing) return;
    setIsPublishing(true);
    if (!description.trim()) {
      setIsPublishing(false);
      setOverlay({ title: 'Ошибка', message: 'Пожалуйста, добавьте описание кейса', icon: 'alert-circle-outline' });
      return;
    }

    if (photos.length === 0) {
      setIsPublishing(false);
      setOverlay({ title: 'Ошибка публикации', message: 'Пожалуйста, загрузите хотя бы одну фотографию клинического случая!', icon: 'alert-circle-outline' });
      return;
    }

    const coverUri = photos[coverIndex] ?? photos[0];
    const imageUrl = await uploadBase64Photo(coverUri);
    if (!imageUrl) {
      setIsPublishing(false);
      setOverlay({ title: 'Ошибка', message: 'Не удалось загрузить фото на сервер', icon: 'alert-circle-outline' });
      return;
    }

    const otherPhotos = photos.filter((_, i) => i !== coverIndex);
    const additionalUrls = await Promise.all(otherPhotos.map(uri => uploadBase64Photo(uri)));
    const validAdditional = additionalUrls.filter(Boolean) as string[];

    let authorId = '';
    let authorEmail = '';
    try {
      const rawUser = await AsyncStorage.getItem('user');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        if (u.id) authorId = u.id;
        if (u.email) authorEmail = u.email;
      }
    } catch {}

    const userId = authorId || authorEmail;

    try {
      const response = await fetch('http://62.238.13.160:8000/case-club/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_id: userId,
          title: description.trim().slice(0, 100),
          description: description.trim(),
          image_url: imageUrl,
          additional_images: validAdditional,
          category,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = typeof data.detail === 'string'
          ? data.detail
          : JSON.stringify(data.detail);
        setIsPublishing(false);
        setOverlay({ title: 'Ошибка', message: errorMsg, icon: 'alert-circle-outline' });
        return;
      }

      setIsPublishing(false);
      setOverlay({ title: 'Опубликовано', message: 'Кейс отправлен в Кейс-Клуб', icon: 'checkmark-circle-outline' });
      setTimeout(() => {
        setOverlay(null);
        router.replace('/(tabs)/case-club' as any);
      }, 1200);
    } catch (e) {
      console.error('[CreateCase] publish error:', e);
      setIsPublishing(false);
      setOverlay({ title: 'Ошибка', message: 'Не удалось опубликовать кейс. Проверьте соединение.', icon: 'alert-circle-outline' });
    }
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
          
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4, marginBottom: 8 }}>
            💀 Обложка будет использована AI-Сенсеем для разбора работы
          </Text>

          {/* Category */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="grid-outline" size={20} color="#f2ca50" />
              <Text style={styles.sectionTitle}>Категория</Text>
            </View>
            <View style={styles.categoryRow}>
              {[
                { key: 'case', icon: '🔵', title: 'ПРОСТО КЕЙС', desc: 'Показываю свою работу. Фото до/после, описание материалов и техники.', color: '#4a90e2' },
                { key: 'sos', icon: '🆘', title: 'SOS', desc: 'Коллеги, нужна помощь! Опиши проблему и задай конкретный вопрос.', color: '#e24a4a' },
                { key: 'trash', icon: '💀', title: 'ТРЕШ', desc: 'Честно о провалах. Только анонимно, без данных пациента, цель — научить других.', color: '#555' },
              ].map((cat) => {
                const active = category === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    activeOpacity={0.85}
                    style={[
                      styles.categoryCard,
                      active && { borderColor: cat.color },
                    ]}
                    onPress={() => {
                      setCategory(cat.key as any);
                      if (cat.key === 'trash') setIsAnonymous(true);
                    }}
                  >
                    <Text style={styles.categoryIcon}>{cat.icon}</Text>
                    <Text style={[styles.categoryTitle, active && { color: cat.color }]}>{cat.title}</Text>
                    <Text style={styles.categoryDesc}>{cat.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
                onValueChange={category === 'trash' ? undefined : setIsAnonymous}
                disabled={category === 'trash'}
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
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.publishButton, isPublishing && { opacity: 0.7 }]}
            onPress={handlePublish}
            disabled={isPublishing}
          >
            <View style={styles.publishContent}>
              {isPublishing ? (
                <ActivityIndicator size="small" color="#1a1206" />
              ) : (
                <Ionicons name="cloud-upload-outline" size={22} color="#1a1206" />
              )}
              <Text style={styles.publishText}>
                {isPublishing ? 'Публикуем...' : 'Опубликовать кейс'}
              </Text>
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

  categoryRow: { flexDirection: 'row', gap: 10 },
  categoryCard: {
    flex: 1,
    backgroundColor: '#0a1628',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 12,
    alignItems: 'center',
  },
  categoryIcon: { fontSize: 22, marginBottom: 6 },
  categoryTitle: { fontSize: 12, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: 6 },
  categoryDesc: { fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 14 },

  switchRow: { flexDirection: 'row', alignItems: 'center' },
  switchTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  switchHint: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },

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
