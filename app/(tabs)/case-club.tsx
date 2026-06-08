import { DemoOverlay, DemoOverlayData, PostActionsSheet } from '@/components/case-post-actions';
import { CaseComment, CaseMedia, ClinicalCase, isOwnCase, roleLabel } from '@/data/cases';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    ImageSourcePropType,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MEDIA_WIDTH = SCREEN_WIDTH - 40 - 24; // screen padding (20*2) + card padding (12*2)

type Identity = { name: string; avatarSource: ImageSourcePropType | null } | undefined;

/* ---------------- Avatar (uri / preset / silhouette) ---------------- */
const AuthorAvatar = ({
  source,
  size = 38,
}: {
  source: ImageSourcePropType | null;
  size?: number;
}) => {
  if (!source) {
    return (
      <View style={[styles.avatar, styles.avatarSilhouette, { width: size, height: size, borderRadius: size / 2 }]}>
        <Ionicons name="person" size={size * 0.55} color="rgba(242,202,80,0.7)" />
      </View>
    );
  }
  return <Image source={source} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} />;
};

/* ---------------- Media carousel ---------------- */
const MediaCarousel = ({
  media,
  onPressPhoto,
}: {
  media: CaseMedia[];
  onPressPhoto: (index: number) => void;
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  return (
    <View style={styles.mediaWrap}>
      <FlatList
        data={media}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        renderItem={({ item, index }) => (
          <TouchableOpacity activeOpacity={0.95} onPress={() => onPressPhoto(index)} style={{ width: MEDIA_WIDTH }}>
            <Image source={{ uri: item.uri }} style={styles.mediaImage} />
            <View style={styles.stageBadge}>
              <Text style={styles.stageBadgeText}>{item.stage}</Text>
            </View>
            <View style={styles.counterBadge}>
              <Ionicons name="images-outline" size={12} color="#fff" />
              <Text style={styles.counterText}>
                {index + 1} из {media.length}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
      <View style={styles.dotsRow}>
        {media.map((_, i) => (
          <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
};

/* ---------------- Comments inside card ---------------- */
const CommentsBlock = ({ comments }: { comments: CaseComment[] }) => (
  <View style={styles.commentsBlock}>
    <View style={styles.commentsHeader}>
      <Ionicons name="chatbubble-ellipses-outline" size={16} color="#4fc3f7" />
      <Text style={styles.commentsTitle}>Обсуждение · {comments.length}</Text>
    </View>
    {comments.map((c) => (
      <View key={c.id} style={styles.commentRow}>
        <AuthorAvatar source={c.avatar ? { uri: c.avatar } : null} size={26} />
        <View style={styles.commentBubble}>
          <Text style={styles.commentAuthor}>{c.author}</Text>
          <Text style={styles.commentText}>{c.text}</Text>
        </View>
      </View>
    ))}
    <TouchableOpacity style={styles.addCommentRow} activeOpacity={0.7}>
      <Ionicons name="add-circle-outline" size={18} color="#f2ca50" />
      <Text style={styles.addCommentText}>Написать комментарий…</Text>
    </TouchableOpacity>
  </View>
);

/* ---------------- Case card ---------------- */
const CaseCard = ({
  item,
  identity,
  onPressPhoto,
  onDeleted,
}: {
  item: ClinicalCase;
  identity: Identity;
  onPressPhoto: (media: CaseMedia[], index: number) => void;
  onDeleted: (id: string) => void;
}) => {
  const isOwn = isOwnCase(item);
  const isAnon = !!item.anonymous;
  const isTech = item.role === 'Техник';
  const displayName = isAnon
    ? 'Анонимный коллега'
    : isOwn && identity?.name
      ? identity.name
      : item.author;
  const avatarSource: ImageSourcePropType | null = isAnon
    ? null
    : isOwn && identity?.avatarSource
      ? identity.avatarSource
      : { uri: item.avatar };

  const [showTeaser, setShowTeaser] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [overlay, setOverlay] = useState<DemoOverlayData>(null);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.activity);
  const [dislikeCount, setDislikeCount] = useState(0);

  const goDetails = () => router.push({ pathname: '/case-details', params: { id: item.id } } as any);

  const handleLike = () => {
    if (disliked) {
      setDisliked(false);
      setDislikeCount(dislikeCount - 1);
      setLiked(true);
      setLikeCount(likeCount + 1);
    } else if (liked) {
      setLiked(false);
      setLikeCount(likeCount - 1);
    } else {
      setLiked(true);
      setLikeCount(likeCount + 1);
    }
  };

  const handleDislike = () => {
    if (liked) {
      setLiked(false);
      setLikeCount(likeCount - 1);
      setDisliked(true);
      setDislikeCount(dislikeCount + 1);
    } else if (disliked) {
      setDisliked(false);
      setDislikeCount(dislikeCount - 1);
    } else {
      setDisliked(true);
      setDislikeCount(dislikeCount + 1);
    }
  };

  const handleEshafotnik = () => {
    console.log('Эшафотник нажат для кейса:', item.id);
    setOverlay({ title: 'Эшафотник', message: 'Кейс отправлен на AI-разбор (демо).', icon: 'flame-outline' });
  };

  const handleEditText = () => {
    setMenuVisible(false);
    setOverlay({ title: 'Редактирование текста', message: 'Открыт редактор описания (демо).', icon: 'create-outline' });
  };
  const handleDeletePhoto = () => {
    setMenuVisible(false);
    setOverlay({ title: 'Удаление фото', message: 'Выберите фото для удаления (демо).', icon: 'image-outline' });
  };
  const handleDeletePost = () => {
    setMenuVisible(false);
    setOverlay({
      title: 'Удалить пост?',
      message: 'Это действие нельзя отменить.',
      icon: 'trash-outline',
      danger: true,
      confirmText: 'УДАЛИТЬ',
      onConfirm: () => {
        setOverlay(null);
        onDeleted(item.id);
      },
    });
  };

  return (
    <View style={styles.card}>
      {/* Card header */}
      <View style={styles.cardHeader}>
        <AuthorAvatar source={avatarSource} />
        <View style={styles.authorInfo}>
          <View style={[styles.roleBadge, isTech && styles.roleBadgeTech]}>
            <Text style={[styles.roleBadgeText, isTech && styles.roleBadgeTextTech]}>
              {roleLabel(item.role)}
            </Text>
          </View>
          <Text style={styles.authorName} numberOfLines={1}>{displayName}</Text>
        </View>
        {isOwn && (
          <TouchableOpacity style={styles.menuButton} activeOpacity={0.7} onPress={() => setMenuVisible(true)}>
            <Ionicons name="ellipsis-vertical" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tappable content opens details */}
      <TouchableOpacity activeOpacity={0.95} onPress={goDetails}>
        <MediaCarousel media={item.media} onPressPhoto={(i) => onPressPhoto(item.media, i)} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsRow}>
          {item.tags.map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </ScrollView>

        <Text style={styles.description} numberOfLines={3}>
          {item.description}
        </Text>
      </TouchableOpacity>

      {/* Social panel */}
      <View style={styles.socialPanel}>
        <View style={styles.socialActions}>
          <TouchableOpacity style={styles.socialButton} activeOpacity={0.7} onPress={handleLike}>
            <Ionicons name="thumbs-up" size={20} color={liked ? '#f2ca50' : 'rgba(255,255,255,0.5)'} />
            <Text style={[styles.socialCount, liked && styles.socialCountActive]}>{likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialButton} activeOpacity={0.7} onPress={handleDislike}>
            <Ionicons name="thumbs-down" size={20} color={disliked ? '#ff6b6b' : 'rgba(255,255,255,0.5)'} />
            <Text style={[styles.socialCount, disliked && styles.socialCountActive]}>{dislikeCount}</Text>
          </TouchableOpacity>
          <View style={styles.activityBadge}>
            <Ionicons name="flame" size={16} color="#f2ca50" />
            <Text style={styles.activityText}>{item.activity + item.commentsList.length}</Text>
          </View>
          <TouchableOpacity style={styles.eshafotnikButton} activeOpacity={0.7} onPress={handleEshafotnik}>
            <Text style={styles.eshafotnikText}>Эшафотник</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.socialComments}>
          <Ionicons name="chatbubble-outline" size={20} color="rgba(255,255,255,0.5)" />
          <Text style={styles.socialCount}>{item.commentsList.length}</Text>
        </View>
      </View>

      <PostActionsSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onEditText={handleEditText}
        onDeletePhoto={handleDeletePhoto}
        onDeletePost={handleDeletePost}
      />
      <DemoOverlay data={overlay} onClose={() => setOverlay(null)} />
    </View>
  );
};

/* ---------------- Work of the week ---------------- */
const WorkOfWeekCard = ({ item, identity }: { item: ClinicalCase; identity: Identity }) => {
  const isAnon = !!item.anonymous;
  const displayName = isAnon ? 'Анонимный коллега' : isOwnCase(item) && identity?.name ? identity.name : item.author;
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.activity);
  const [dislikeCount, setDislikeCount] = useState(0);

  const handleLike = () => {
    if (disliked) {
      setDisliked(false);
      setDislikeCount(dislikeCount - 1);
      setLiked(true);
      setLikeCount(likeCount + 1);
    } else if (liked) {
      setLiked(false);
      setLikeCount(likeCount - 1);
    } else {
      setLiked(true);
      setLikeCount(likeCount + 1);
    }
  };

  const handleDislike = () => {
    if (liked) {
      setLiked(false);
      setLikeCount(likeCount - 1);
      setDisliked(true);
      setDislikeCount(dislikeCount + 1);
    } else if (disliked) {
      setDisliked(false);
      setDislikeCount(dislikeCount - 1);
    } else {
      setDisliked(true);
      setDislikeCount(dislikeCount + 1);
    }
  };

  const handleEshafotnik = () => {
    console.log('Эшафотник нажат для кейса:', item.id);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={styles.wowCard}
      onPress={() => router.push({ pathname: '/case-details', params: { id: item.id } } as any)}
    >
      <View style={styles.wowHeader}>
        <Text style={styles.wowCrown}>👑</Text>
        <Text style={styles.wowTitle}>Работа недели</Text>
      </View>
      <Image source={{ uri: item.media[0]?.uri }} style={styles.wowImage} />
      <View style={styles.wowFooter}>
        <Text style={styles.wowAuthor} numberOfLines={1}>{displayName}</Text>
        <Text style={styles.wowDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.wowStats}>
          <Ionicons name="flame" size={14} color="#f2ca50" />
          <Text style={styles.wowStatsText}>{item.activity + item.commentsList.length} баллов активности</Text>
        </View>
      </View>

      {/* Social panel */}
      <View style={styles.socialPanel}>
        <View style={styles.socialActions}>
          <TouchableOpacity style={styles.socialButton} activeOpacity={0.7} onPress={handleLike}>
            <Ionicons name="thumbs-up" size={20} color={liked ? '#f2ca50' : 'rgba(255,255,255,0.5)'} />
            <Text style={[styles.socialCount, liked && styles.socialCountActive]}>{likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialButton} activeOpacity={0.7} onPress={handleDislike}>
            <Ionicons name="thumbs-down" size={20} color={disliked ? '#ff6b6b' : 'rgba(255,255,255,0.5)'} />
            <Text style={[styles.socialCount, disliked && styles.socialCountActive]}>{dislikeCount}</Text>
          </TouchableOpacity>
          <View style={styles.activityBadge}>
            <Ionicons name="flame" size={16} color="#f2ca50" />
            <Text style={styles.activityText}>{item.activity + item.commentsList.length}</Text>
          </View>
          <TouchableOpacity style={styles.eshafotnikButton} activeOpacity={0.7} onPress={handleEshafotnik}>
            <Text style={styles.eshafotnikText}>Эшафотник</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.socialComments}>
          <Ionicons name="chatbubble-outline" size={20} color="rgba(255,255,255,0.5)" />
          <Text style={styles.socialCount}>{item.commentsList.length}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

/* ---------------- Fullscreen photo viewer ---------------- */
const FullscreenViewer = ({
  media,
  initialIndex,
  onClose,
}: {
  media: CaseMedia[] | null;
  initialIndex: number;
  onClose: () => void;
}) => {
  const [index, setIndex] = useState(initialIndex);
  useEffect(() => setIndex(initialIndex), [initialIndex, media]);
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setIndex(viewableItems[0].index ?? 0);
  }).current;

  return (
    <Modal visible={!!media} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        <TouchableOpacity style={styles.viewerClose} onPress={onClose} activeOpacity={0.8}>
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>
        {media && (
          <>
            <View style={styles.viewerCounter}>
              <Text style={styles.viewerCounterText}>{index + 1} из {media.length}</Text>
            </View>
            <FlatList
              data={media}
              keyExtractor={(_, i) => String(i)}
              horizontal
              pagingEnabled
              initialScrollIndex={initialIndex}
              getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
              showsHorizontalScrollIndicator={false}
              onViewableItemsChanged={onViewableItemsChanged}
              renderItem={({ item }) => (
                <View style={styles.viewerSlide}>
                  <Image source={{ uri: item.uri }} style={styles.viewerImage} resizeMode="contain" />
                  <View style={styles.viewerStage}>
                    <Text style={styles.stageBadgeText}>{item.stage}</Text>
                  </View>
                </View>
              )}
            />
          </>
        )}
      </View>
    </Modal>
  );
};

/* ---------------- Screen ---------------- */
export default function CaseClubScreen() {
  const [identity, setIdentity] = useState<Identity>(() => (globalThis as any).getCaseClubIdentity?.());
  const [viewer, setViewer] = useState<{ media: CaseMedia[]; index: number } | null>(null);
  const [feed, setFeed] = useState<ClinicalCase[]>([]);
  const [workOfWeek, setWorkOfWeek] = useState<ClinicalCase | null>(null);

  useEffect(() => {
    setIdentity((globalThis as any).getCaseClubIdentity?.());
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadPosts = async () => {
        try {
          const data = await AsyncStorage.getItem('@case_club_posts');
          if (data) {
            const parsed: ClinicalCase[] = JSON.parse(data);
            console.log('УСПЕШНО ИЗВЛЕЧЕНО ИЗ ASYNCSTORAGE ПОСТОВ:', parsed.length);
            const wow = parsed.filter(c => c.activity > 0).reduce<ClinicalCase | null>((best, c) => {
              if (!best) return c;
              return c.activity + c.commentsList.length > best.activity + best.commentsList.length ? c : best;
            }, null);
            setWorkOfWeek(wow);
            setFeed(parsed.filter((c) => wow ? c.id !== wow.id : true));
          } else {
            console.log('АсынцСторедж: постов нет, лента пуста');
            setWorkOfWeek(null);
            setFeed([]);
          }
        } catch (error) {
          console.error('Ошибка чтения AsyncStorage:', error);
          setWorkOfWeek(null);
          setFeed([]);
        }
      };
      loadPosts();
    }, [])
  );

  const handleDeletePostById = async (id: string) => {
    try {
      const data = await AsyncStorage.getItem('@case_club_posts');
      const posts: ClinicalCase[] = data ? JSON.parse(data) : [];
      const updatedPosts = posts.filter((p) => p.id !== id);
      await AsyncStorage.setItem('@case_club_posts', JSON.stringify(updatedPosts));
      console.log('[CaseClub] удалён пост', id, 'осталось постов:', updatedPosts.length);
      const wow = updatedPosts.filter(c => c.activity > 0).reduce<ClinicalCase | null>((best, c) => {
        if (!best) return c;
        return c.activity + c.commentsList.length > best.activity + best.commentsList.length ? c : best;
      }, null);
      setWorkOfWeek(wow);
      setFeed(updatedPosts.filter((c) => wow ? c.id !== wow.id : true));
    } catch (error) {
      console.error('[CaseClub] ошибка удаления поста:', error);
    }
  };

  const openViewer = (media: CaseMedia[], index: number) => setViewer({ media, index });

  return (
    <View style={styles.container}>
      <FlatList
        data={feed}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CaseCard item={item} identity={identity} onPressPhoto={openViewer} onDeleted={handleDeletePostById} />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={42} color="rgba(242,202,80,0.65)" />
            <Text style={styles.emptyStateTitle}>В Кейс-клубе пока нет публикаций</Text>
          </View>
        }
        ListHeaderComponent={
          <View>
            <View style={styles.titleBar}>
              <TouchableOpacity
                style={styles.backButton}
                activeOpacity={0.7}
                onPress={() => router.replace('/(tabs)/index' as any)}
              >
                <Ionicons name="arrow-back" size={24} color="#ffffff" />
              </TouchableOpacity>
              <Text style={styles.screenTitle}>Кейс-клуб</Text>
              <TouchableOpacity
                style={styles.addButton}
                activeOpacity={0.8}
                onPress={() => router.push('/create-case' as any)}
              >
                <Ionicons name="add" size={26} color="#0b0e14" />
              </TouchableOpacity>
            </View>
            {workOfWeek && <WorkOfWeekCard item={workOfWeek} identity={identity} />}
          </View>
        }
      />

      <FullscreenViewer
        media={viewer?.media ?? null}
        initialIndex={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
    paddingBottom: 12,
    position: 'relative',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    position: 'absolute',
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#f2ca50',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f2ca50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 130,
    paddingTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
  },

  /* Work of week */
  wowCard: {
    backgroundColor: 'rgba(30, 24, 8, 0.85)',
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(242, 202, 80, 0.55)',
    overflow: 'hidden',
    shadowColor: '#f2ca50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  wowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  wowCrown: { fontSize: 18 },
  wowTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f2ca50',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  wowImage: { width: '100%', height: 180, backgroundColor: '#10141f' },
  wowFooter: { padding: 14 },
  wowAuthor: { fontSize: 15, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  wowDesc: { fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.8)', marginBottom: 10 },
  wowStats: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wowStatsText: { fontSize: 12, fontWeight: '600', color: '#f2ca50' },

  /* Card */
  card: {
    backgroundColor: 'rgba(20, 26, 40, 0.78)',
    borderRadius: 20,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  authorInfo: {
    flex: 1,
    marginLeft: 10,
  },
  avatar: {
    borderWidth: 1.5,
    borderColor: 'rgba(242, 202, 80, 0.6)',
    backgroundColor: '#1a2030',
  },
  avatarSilhouette: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 5,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.5)',
    backgroundColor: 'rgba(242, 202, 80, 0.1)',
  },
  roleBadgeTech: {
    borderColor: 'rgba(79, 195, 247, 0.5)',
    backgroundColor: 'rgba(79, 195, 247, 0.1)',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f2ca50',
    letterSpacing: 0.5,
  },
  roleBadgeTextTech: {
    color: '#4fc3f7',
  },
  menuButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  mediaImage: {
    width: MEDIA_WIDTH,
    height: 220,
    borderRadius: 14,
    backgroundColor: '#10141f',
  },
  stageBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(11, 14, 20, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  stageBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  counterBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(11, 14, 20, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  counterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  dotActive: {
    backgroundColor: '#f2ca50',
    width: 18,
  },
  tagsRow: {
    gap: 8,
    paddingVertical: 2,
    marginBottom: 12,
  },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(242, 202, 80, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.35)',
    borderRadius: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f2ca50',
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 13.5,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.82)',
    marginBottom: 12,
    paddingHorizontal: 2,
  },

  /* AI critique teaser */
  aiTeaserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.25)',
    marginBottom: 12,
  },
  aiTeaserBtnText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#ff8a8a' },
  aiTeaserBubble: {
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#ff6b6b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  aiTeaserText: { fontSize: 13.5, lineHeight: 20, color: 'rgba(255,255,255,0.9)', fontStyle: 'italic', marginBottom: 8 },
  aiTeaserMore: { fontSize: 12, fontWeight: '700', color: '#f2ca50' },

  /* Social panel */
  socialPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 12,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  socialActions: {
    flexDirection: 'row',
    gap: 16,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  socialCount: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  socialCountActive: {
    color: '#ffffff',
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(242, 202, 80, 0.1)',
  },
  activityText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f2ca50',
  },
  eshafotnikButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  eshafotnikText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ff6b6b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  socialComments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  /* Comments */
  commentsBlock: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 12,
    paddingHorizontal: 2,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  commentsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4fc3f7',
    letterSpacing: 0.3,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 26, 0.6)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.7)',
  },
  addCommentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  addCommentText: {
    fontSize: 13,
    color: 'rgba(242, 202, 80, 0.8)',
    fontWeight: '500',
  },

  /* Bottom Tab Bar */
  bottomTabBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 25,
    backgroundColor: 'rgba(15, 20, 35, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.3)',
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#f2ca50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    color: 'rgba(255, 255, 255, 0.6)',
  },

  /* Fullscreen viewer */
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCounter: {
    position: 'absolute',
    top: 58,
    alignSelf: 'center',
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  viewerCounterText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  viewerSlide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.7 },
  viewerStage: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(11, 14, 20, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
});
