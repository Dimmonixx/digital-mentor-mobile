import { database } from '@/constants/firebase';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { onValue, ref, remove, set } from 'firebase/database';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STORAGE_KEY = '@global_case_club_posts';

const PRESET_AVATARS: any[] = [
  require('@/assets/avatars/avatar_1.jpg'),
  require('@/assets/avatars/avatar_2.jpg'),
  require('@/assets/avatars/avatar_3.jpg'),
  require('@/assets/avatars/avatar_4.jpg'),
  require('@/assets/avatars/avatar_5.jpg'),
  require('@/assets/avatars/avatar_6.jpg'),
  require('@/assets/avatars/avatar_7.jpg'),
  require('@/assets/avatars/avatar_8.jpg'),
  require('@/assets/avatars/avatar_9.jpg'),
  require('@/assets/avatars/avatar_10.jpg'),
];

/* ─── helpers ─── */
function toArray<T>(val: any): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val as T[];
  if (typeof val === 'object') return Object.values(val) as T[];
  return [];
}

function validUri(uri?: string): string | undefined {
  if (!uri) return undefined;
  if (uri.startsWith('https://') || uri.startsWith('data:')) return uri;
  return undefined;
}

function formatName(fullName: string): string {
  const parts = (fullName || '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const [last, first, middle] = parts;
  const fi = first?.[0] ? first[0].toUpperCase() + '.' : '';
  const mi = middle?.[0] ? middle[0].toUpperCase() + '.' : '';
  return `${last} ${fi}${mi}`.trim();
}

/* ─── Avatar ─── */
const Avatar = ({ post }: { post: any }) => {
  const uri = post.avatarUrl && post.avatarUrl.startsWith('http') ? post.avatarUrl : undefined;
  if (uri) return <Image source={{ uri }} style={styles.avatar} />;
  if (post.avatarPresetId) {
    return (
      <Image
        source={PRESET_AVATARS[(post.avatarPresetId - 1) % PRESET_AVATARS.length]}
        style={styles.avatar}
      />
    );
  }
  const isTech = post.role === 'Техник' || post.role === 'technician' || post.role === 'Зубной техник';
  return (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Ionicons name={isTech ? 'construct-outline' : 'medical-outline'} size={20} color="#f2ca50" />
    </View>
  );
};

/* ─── PostCard ─── */
const PostCard = ({
  post,
  currentEmail,
  currentUserId,
  menuPostId,
  setMenuPostId,
  onDelete,
  onDeletePhoto,
  onLike,
  onDislike,
}: {
  post: any;
  currentEmail: string;
  currentUserId: string;
  menuPostId: string | null;
  setMenuPostId: (id: string | null) => void;
  onDelete: (id: string) => void;
  onDeletePhoto: (id: string) => void;
  onLike: (id: string) => void;
  onDislike: (id: string) => void;
}) => {
  const isOwn = !!currentEmail && post.authorEmail === currentEmail;
  const isTech = post.role === 'Техник' || post.role === 'technician' || post.role === 'Зубной техник';
  const roleLabel = isTech ? 'Зубной техник' : 'Врач';

  const mediaArr = toArray<any>(post.media);
  const coverIdx = post.coverIndex ?? 0;
  const coverItem = mediaArr[coverIdx] ?? mediaArr[0];
  const photoUri = validUri(
    coverItem?.uri ?? (typeof coverItem === 'string' ? coverItem : undefined)
  );

  const likedBy: Record<string, boolean> = post.likedBy && typeof post.likedBy === 'object' ? post.likedBy : {};
  const dislikedBy: Record<string, boolean> = post.dislikedBy && typeof post.dislikedBy === 'object' ? post.dislikedBy : {};
  const likeCount = Object.keys(likedBy).length;
  const dislikeCount = Object.keys(dislikedBy).length;
  const isLiked = !!currentUserId && !!likedBy[currentUserId];
  const isDisliked = !!currentUserId && !!dislikedBy[currentUserId];

  const menuOpen = menuPostId === post.id;

  return (
    <TouchableOpacity
      activeOpacity={0.93}
      style={styles.card}
      onPress={() => {
        setMenuPostId(null);
        router.push({ pathname: '/case-details', params: { id: post.id } } as any);
      }}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <Avatar post={post} />
        <View style={styles.authorBlock}>
          <View style={[styles.badge, isTech && styles.badgeTech]}>
            <Text style={[styles.badgeText, isTech && styles.badgeTextTech]}>{roleLabel}</Text>
          </View>
          <Text style={styles.authorName} numberOfLines={1}>{formatName(post.author || 'Автор')}</Text>
        </View>
        {isOwn && (
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setMenuPostId(menuOpen ? null : post.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#f2ca50" />
          </TouchableOpacity>
        )}
      </View>

      {/* 3-dot dropdown */}
      {menuOpen && (
        <View style={styles.dropdown}>
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => { router.push(`/edit-case?id=${post.id}` as any); setMenuPostId(null); }}
          >
            <Ionicons name="create-outline" size={16} color="#f2ca50" />
            <Text style={styles.dropdownText}>Редактировать пост</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => { onDeletePhoto(post.id); setMenuPostId(null); }}
          >
            <Ionicons name="image-outline" size={16} color="#f2ca50" />
            <Text style={styles.dropdownText}>Удалить фото</Text>
          </TouchableOpacity>
          <View style={styles.dropdownDivider} />
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => { onDelete(post.id); setMenuPostId(null); }}
          >
            <Ionicons name="trash-outline" size={16} color="#e74c3c" />
            <Text style={[styles.dropdownText, { color: '#e74c3c' }]}>Удалить пост</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Photo */}
      {!!photoUri && (
        <Image source={{ uri: photoUri }} style={styles.photo} onError={() => {}} />
      )}

      {/* Description */}
      {!!post.description && (
        <Text style={styles.description} numberOfLines={5}>{post.description}</Text>
      )}

      {/* Actions row */}
      <View style={styles.actionsRow}>
        <View style={styles.actionsLeft}>
          <TouchableOpacity
            onPress={() => onLike(post.id)}
            style={styles.actionBtn}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'}
              size={20}
              color={isLiked ? '#f2ca50' : 'rgba(255,255,255,0.45)'}
            />
            <Text style={[styles.actionCount, isLiked && { color: '#f2ca50' }]}>{likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDislike(post.id)}
            style={styles.actionBtn}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isDisliked ? 'thumbs-down' : 'thumbs-down-outline'}
              size={20}
              color={isDisliked ? '#e74c3c' : 'rgba(255,255,255,0.45)'}
            />
            <Text style={[styles.actionCount, isDisliked && { color: '#e74c3c' }]}>{dislikeCount}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}
          onPress={() => router.push({ pathname: '/case-details', params: { id: post.id } } as any)}
        >
          <Ionicons name="chatbubble-outline" size={20} color="rgba(255,255,255,0.45)" />
          <Text style={styles.actionCount}>{post.commentsCount || 0}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

/* ─── Screen ─── */
export default function CaseClubScreen() {
  const [posts, setPosts] = useState<any[]>([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('user').then((raw) => {
        if (raw) {
          const u = JSON.parse(raw);
          if (u.email) setCurrentEmail(u.email);
          if (u.id) setCurrentUserId(u.id);
        }
      }).catch(() => {});
    }, [])
  );

  useEffect(() => {
    const postsRef = ref(database, 'case_club_posts');
    const unsub = onValue(postsRef, (snapshot) => {
      const raw = snapshot.exists() ? snapshot.val() : null;
      const arr: any[] = toArray(raw).filter((p: any) => p?.id && p?.description);
      const sorted = arr.sort((a, b) => Number(b.id) - Number(a.id));
      setPosts(sorted);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sorted)).catch(() => {});
    });
    unsubRef.current = unsub;
    return () => unsub();
  }, []);

  const deletePost = useCallback(async (id: string) => {
    Alert.alert('Удалить пост?', 'Это действие нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive', onPress: async () => {
          try {
            await remove(ref(database, `case_club_posts/${id}`));
          } catch (e) {
            console.warn('[CaseClub] Ошибка удаления:', e);
            setPosts(prev => prev.filter(p => p.id !== id));
          }
        }
      },
    ]);
  }, []);

  const deletePhoto = useCallback(async (postId: string) => {
    try {
      await set(ref(database, `case_club_posts/${postId}/media`), []);
    } catch (e) {
      console.warn('[CaseClub] Ошибка удаления фото:', e);
    }
  }, []);

  const handleLike = useCallback(async (postId: string) => {
    if (!currentUserId) return;
    const likeRef = ref(database, `case_club_posts/${postId}/likedBy/${currentUserId}`);
    const post = posts.find(p => p.id === postId);
    const alreadyLiked = post?.likedBy?.[currentUserId];
    try {
      if (alreadyLiked) {
        await remove(likeRef);
      } else {
        await set(likeRef, true);
        await remove(ref(database, `case_club_posts/${postId}/dislikedBy/${currentUserId}`));
      }
    } catch (e) {
      console.warn('[CaseClub] Ошибка лайка:', e);
    }
  }, [currentUserId, posts]);

  const handleDislike = useCallback(async (postId: string) => {
    if (!currentUserId) return;
    const dislikeRef = ref(database, `case_club_posts/${postId}/dislikedBy/${currentUserId}`);
    const post = posts.find(p => p.id === postId);
    const alreadyDisliked = post?.dislikedBy?.[currentUserId];
    try {
      if (alreadyDisliked) {
        await remove(dislikeRef);
      } else {
        await set(dislikeRef, true);
        await remove(ref(database, `case_club_posts/${postId}/likedBy/${currentUserId}`));
      }
    } catch (e) {
      console.warn('[CaseClub] Ошибка дизлайка:', e);
    }
  }, [currentUserId, posts]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#f2ca50" />
        </TouchableOpacity>
        <Text style={styles.title}>Кейс-Клуб</Text>
        <TouchableOpacity onPress={() => router.push('/create-case' as any)} style={styles.headerBtn}>
          <Ionicons name="add" size={28} color="#f2ca50" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => setMenuPostId(null)}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={44} color="rgba(242,202,80,0.4)" />
            <Text style={styles.emptyText}>Нет публикаций</Text>
            <Text style={styles.emptyHint}>Нажмите «+» чтобы поделиться кейсом</Text>
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentEmail={currentEmail}
            currentUserId={currentUserId}
            menuPostId={menuPostId}
            setMenuPostId={setMenuPostId}
            onDelete={deletePost}
            onDeletePhoto={deletePhoto}
            onLike={handleLike}
            onDislike={handleDislike}
          />
        )}
      />
    </SafeAreaView>
  );
}

/* ─── Styles ─── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: '#ffffff', textAlign: 'center', letterSpacing: 0.5 },

  list: { paddingHorizontal: 16, paddingBottom: 130 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { color: 'rgba(255,255,255,0.55)', fontSize: 16, fontWeight: '600' },
  emptyHint: { color: 'rgba(255,255,255,0.3)', fontSize: 13 },

  /* Card */
  card: {
    backgroundColor: 'rgba(18,24,38,0.88)',
    borderRadius: 20,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'visible',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: 'rgba(242,202,80,0.5)',
    backgroundColor: '#131b2e',
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },

  authorBlock: { flex: 1, marginLeft: 10 },
  authorName: { fontSize: 14, fontWeight: '600', color: '#ffffff', marginTop: 3 },

  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.45)',
    backgroundColor: 'rgba(242,202,80,0.08)',
  },
  badgeTech: { borderColor: 'rgba(79,195,247,0.45)', backgroundColor: 'rgba(79,195,247,0.08)' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#f2ca50', letterSpacing: 0.4 },
  badgeTextTech: { color: '#4fc3f7' },

  menuBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  /* Dropdown */
  dropdown: {
    position: 'absolute',
    right: 12,
    top: 50,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.35)',
    zIndex: 200,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 20,
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  dropdownText: { fontSize: 14, fontWeight: '600', color: '#f2ca50' },
  dropdownDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 12 },

  photo: {
    width: '100%',
    height: SCREEN_WIDTH - 60,
    borderRadius: 14,
    backgroundColor: '#0d1120',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.80)',
    paddingHorizontal: 2,
    marginBottom: 10,
  },

  /* Actions */
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  actionsLeft: { flexDirection: 'row', gap: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
});