import BottomTabBar from '@/components/BottomTabBar';
import { PostActionsSheet } from '@/components/case-post-actions';
import GlobalHeader from '@/components/global-header';
import { getFirebaseDB } from '@/constants/firebase';
import {
    CASES,
    CaseComment,
    CaseMedia,
    ClinicalCase,
    deleteCaseById,
    isOwnCase,
    registerAiLike,
    registerCorrectRiddle
} from '@/data/cases';
import { getUserIdentity } from '@/utils/getUserIdentity';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { get, ref, set } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Image,
    ImageBackground,
    ImageSourcePropType,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Polygon, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONTENT_WIDTH = SCREEN_WIDTH - 40;
const MEDIA_WIDTH = CONTENT_WIDTH;

const AI_REVIEW_COST = 1;

const PRESET_AVATARS = [
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

// Компактная сетка гексагонов (4 в ряд)
const HEX_GAP = 8;
const HEX_COLS = 4;
const HEX_W = Math.floor((CONTENT_WIDTH - 32 - HEX_GAP * (HEX_COLS - 1)) / HEX_COLS * 0.8);
const HEX_H = 48;

type Identity = { name: string; avatarSource: ImageSourcePropType | null; role?: string } | undefined;

/* ---------------- Avatar ---------------- */
const AuthorAvatar = ({ source, size = 48 }: { source: ImageSourcePropType | null; size?: number }) => {
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
const MediaCarousel = ({ media: rawMedia, onPressPhoto }: { media: CaseMedia[]; onPressPhoto: (i: number) => void }) => {
  const media: CaseMedia[] = Array.isArray(rawMedia)
    ? rawMedia
    : (rawMedia && typeof rawMedia === 'object' ? Object.values(rawMedia as any) : []);
  if (media.length === 0) return null;
  const [activeIndex, setActiveIndex] = useState(0);
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
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
              <Text style={styles.counterText}>{index + 1} из {media.length}</Text>
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

/* ---------------- Riddle hex button (compact) ---------------- */
const HexButton = ({
  label,
  selected,
  revealed,
  percent,
  correct,
  onPress,
}: {
  label: string;
  selected: boolean;
  revealed: boolean;
  percent: number;
  correct: boolean;
  onPress: () => void;
}) => {
  const stroke = revealed && correct ? '#7CFC8A' : selected ? '#4fc3f7' : '#f2ca50';
  return (
    <TouchableOpacity activeOpacity={0.85} style={{ width: HEX_W, height: HEX_H }} onPress={onPress} disabled={revealed}>
      <Svg width={HEX_W} height={HEX_H} viewBox={`0 0 ${HEX_W} ${HEX_H}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="hexBtnBody" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#1c2536" />
            <Stop offset="100%" stopColor="#0a0f1a" />
          </SvgLinearGradient>
        </Defs>
        <Polygon
          points={`${HEX_W * 0.28},3 ${HEX_W * 0.72},3 ${HEX_W - 3},${HEX_H / 2} ${HEX_W * 0.72},${HEX_H - 3} ${HEX_W * 0.28},${HEX_H - 3} 3,${HEX_H / 2}`}
          fill="url(#hexBtnBody)"
          stroke={stroke}
          strokeWidth={1.5}
        />
      </Svg>
      <View style={styles.hexContent}>
        <Text style={[styles.hexLabel, { color: stroke }]}>{label}</Text>
        {revealed && <Text style={styles.hexPercent}>{percent}%</Text>}
      </View>
    </TouchableOpacity>
  );
};

const RiddleBlock = ({
  riddle,
  onReward,
}: {
  riddle: ClinicalCase['riddle'];
  onReward: () => void;
}) => {
  const [picked, setPicked] = useState<string | null>(null);
  const [rewarded, setRewarded] = useState(false);
  if (!riddle) return null;

  const onPick = async (label: string) => {
    if (picked != null) return;
    setPicked(label);
    if (label === riddle.correct && !rewarded) {
      setRewarded(true);
      await (globalThis as any).spendDiamonds?.(-1); // начисляем +1 💎
      (globalThis as any).forceDiamondUpdate?.();
      registerCorrectRiddle();
      onReward();
    }
  };

  return (
    <View style={styles.section}>
      {/* Заголовок и награда — на отдельных строках, чтобы текст не обрезался */}
      <View style={styles.sectionTitleRow}>
        <Ionicons name="help-circle-outline" size={20} color="#f2ca50" />
        <Text style={styles.sectionTitle}>Кейс-загадка</Text>
      </View>
      <View style={styles.rewardLine}>
        <Ionicons name="flash-outline" size={13} color="#f2ca50" />
        <Text style={styles.rewardLineText}>+1 заряд ИИ за верный ответ</Text>
      </View>

      <Text style={styles.riddleQuestion}>{riddle.question}</Text>
      <View style={styles.hexGrid}>
        {riddle.options.map((opt) => (
          <HexButton
            key={opt.label}
            label={opt.label}
            selected={picked === opt.label}
            revealed={picked != null}
            percent={opt.percent}
            correct={opt.label === riddle.correct}
            onPress={() => onPick(opt.label)}
          />
        ))}
      </View>
      {picked != null && (
        <Text style={[styles.riddleResult, picked !== riddle.correct && styles.riddleResultWrong]}>
          {picked === riddle.correct
            ? `Верно! Вам начислен +1 заряд ИИ. Большинство коллег выбрали ${riddle.correct}.`
            : `Правильный ответ — ${riddle.correct}. Вы выбрали ${picked}.`}
        </Text>
      )}
    </View>
  );
};

/* ---------------- AI review (harsh critic) ---------------- */
const AiReviewBlock = ({ review, onSpent }: { review: string; onSpent: () => void }) => {
  const [revealed, setRevealed] = useState(false);
  const [liked, setLiked] = useState(false);

  const runReview = async () => {
    const ok = await (globalThis as any).spendDiamonds?.(AI_REVIEW_COST);
    if (!ok) {
      Alert.alert('Низкий заряд ИИ', `Для AI-разбора нужно ${AI_REVIEW_COST} заряда. Пополните заряды в «Станции зарядки».`);
      return;
    }
    (globalThis as any).forceDiamondUpdate?.();
    onSpent();
    setRevealed(true);
  };

  const toggleLike = () => {
    if (!liked) {
      setLiked(true);
      registerAiLike();
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name="skull-outline" size={28} color="#ff6b6b" />
        <Text style={styles.sectionTitle}>AI-разбор работы</Text>
      </View>
      {!revealed ? (
        <>
          <TouchableOpacity activeOpacity={0.85} style={styles.eshafotnikButton} onPress={runReview}>
            <Text style={styles.eshafotnikText}>Эшафотник за 2</Text>
            <Ionicons name="flash" size={14} color="#f2ca50" />
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.aiReviewBubble}>
            <Text style={styles.aiReviewText}>{review}</Text>
          </View>
          <TouchableOpacity style={styles.aiLikeRow} activeOpacity={0.7} onPress={toggleLike}>
            <Ionicons name={liked ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color="#f2ca50" />
            <Text style={styles.aiLikeText}>{liked ? 'Полезный разбор' : 'Отметить разбор полезным'}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

/* ---------------- Comments ---------------- */
const CommentsSection = ({ comments }: { comments: CaseComment[] }) => (
  <View style={styles.section}>
    <View style={styles.sectionTitleRow}>
      <Ionicons name="chatbubble-ellipses-outline" size={20} color="#4fc3f7" />
      <Text style={styles.sectionTitle}>Обсуждение · {comments.length}</Text>
    </View>
    {comments.map((c) => (
      <View key={c.id} style={styles.commentRow}>
        <AuthorAvatar source={c.avatar ? { uri: c.avatar } : null} size={30} />
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

/* ---------------- Fullscreen viewer ---------------- */
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
export default function CaseDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ClinicalCase | null>(null);
  const [identity, setIdentity] = useState<Identity>(undefined);
  const [viewer, setViewer] = useState<{ media: CaseMedia[]; index: number } | null>(null);
  const [diamonds, setDiamonds] = useState<number>(() => (globalThis as any).getDiamondBalance?.() ?? 0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [localCase, setLocalCase] = useState<ClinicalCase | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<CaseComment[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentEmail, setCurrentEmail] = useState<string>('');
  const [currentAuthorName, setCurrentAuthorName] = useState<string>('');
  const [currentFullName, setCurrentFullName] = useState<string>('');

  const refreshDiamonds = () => setDiamonds((globalThis as any).getDiamondBalance?.() ?? 0);

  useEffect(() => {
    getUserIdentity().then((id) => {
      if (id) {
        setIdentity({ name: id.shortName, avatarSource: id.avatarSource, role: id.role });
        setCurrentAuthorName(id.shortName);
      } else {
        setIdentity((globalThis as any).getCaseClubIdentity?.());
      }
    });
    AsyncStorage.getItem('user').then((raw) => {
      if (raw) {
        const u = JSON.parse(raw);
        if (u.id) setCurrentUserId(u.id);
        if (u.email) setCurrentEmail(u.email);
        if (u.name) {
          setCurrentFullName(u.name);
          setCurrentAuthorName((prev) => prev || u.name);
        }
      }
    }).catch(() => {});
    refreshDiamonds();
    const loadCase = async () => {
      try {
        // Читаем из Firebase как основного источника
        const fbSnap = await get(ref(getFirebaseDB(), `case_club_posts/${id}`));
        let found: ClinicalCase | null = fbSnap.exists() ? fbSnap.val() : null;
        // Fallback: локальный кэш
        if (!found) {
          const raw = await AsyncStorage.getItem('@global_case_club_posts');
          const posts: ClinicalCase[] = raw ? JSON.parse(raw) : [];
          found = posts.find((p) => p.id === id) ?? null;
        }
        setItem(found);
        if (found) {
          setLocalCase({ ...found });
          setEditedDescription(found.fullDescription);
          setComments(found.commentsList ?? []);
        }
      } catch (e) {
        console.error('[CaseDetails] Ошибка чтения AsyncStorage:', e);
      }
    };
    loadCase();
  }, [id]);

  if (!item) {
    return (
      <ImageBackground source={require('@/assets/images/background.png')} style={{ flex: 1 }} resizeMode="cover">
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <GlobalHeader diamonds={diamonds} newOrdersCount={3} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Кейс не найден</Text>
        </View>
      </ImageBackground>
    );
  }

  const isOwn = isOwnCase(item, currentUserId, currentEmail, currentAuthorName, currentFullName);
  const isAnon = !!item.anonymous;

  const formatShortName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    const [last, first, middle] = parts;
    const firstI = first ? first[0].toUpperCase() + '.' : '';
    const middleI = middle ? middle[0].toUpperCase() + '.' : '';
    return `${last} ${firstI}${middleI}`;
  };

  const resolvedRole = isOwn && identity?.role ? identity.role : ((item as any).role ?? '');
  const isTech = resolvedRole === 'Техник' || resolvedRole === 'Зубной техник' || resolvedRole === 'technician';
  const roleDisplay = isTech ? 'Зубной техник' : 'Врач';

  const rawName = isAnon ? 'Анонимный коллега' : isOwn && identity?.name ? identity.name : item.author;
  const displayName = isAnon ? rawName : formatShortName(rawName);
  const avatarSource: ImageSourcePropType | null = (() => {
    if (isAnon) return null;
    if (isOwn && identity?.avatarSource) return identity.avatarSource;
    if (item.avatar && item.avatar.startsWith('http')) return { uri: item.avatar };
    if ((item as any).avatarPresetId) {
      return PRESET_AVATARS[((item as any).avatarPresetId - 1) % PRESET_AVATARS.length];
    }
    return null;
  })();

  /* ---- Real menu actions ---- */
  const handleEditText = () => {
    setMenuVisible(false);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (localCase) {
      setLocalCase({ ...localCase, fullDescription: editedDescription });
      // Update the original CASES array
      const index = CASES.findIndex(c => c.id === localCase.id);
      if (index !== -1) {
        CASES[index].fullDescription = editedDescription;
      }
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedDescription(localCase?.fullDescription || '');
  };

  const handleAddComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    const authorName = identity?.name ?? 'Анонимный';
    const newComment: CaseComment = {
      id: Date.now().toString(),
      author: authorName,
      avatar: '',
      text,
    };
    const updated = [newComment, ...comments];
    setComments(updated);
    setCommentText('');
    try {
      // Обновляем в Firebase
      await set(ref(getFirebaseDB(), `case_club_posts/${item.id}/commentsList`), updated);
      // Обновляем локальный кэш
      const raw = await AsyncStorage.getItem('@global_case_club_posts');
      const posts: ClinicalCase[] = raw ? JSON.parse(raw) : [];
      const idx = posts.findIndex((p) => p.id === item.id);
      if (idx !== -1) {
        posts[idx].commentsList = updated;
        await AsyncStorage.setItem('@global_case_club_posts', JSON.stringify(posts));
      }
    } catch (e) {
      console.error('[CaseDetails] Ошибка сохранения комментария:', e);
    }
  };

  const handleDeletePhoto = () => {
    setMenuVisible(false);
    if (localCase && localCase.media.length > 0) {
      const updatedMedia = localCase.media.slice(1);
      setLocalCase({ ...localCase, media: updatedMedia });
      // Update the original CASES array
      const index = CASES.findIndex(c => c.id === localCase.id);
      if (index !== -1) {
        CASES[index].media = updatedMedia;
      }
    }
  };

  const handleDeletePost = () => {
    setMenuVisible(false);
    deleteCaseById(item.id);
    router.back();
  };

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={{ flex: 1, backgroundColor: 'transparent' }}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <GlobalHeader diamonds={diamonds} newOrdersCount={3} />

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navBackButton} activeOpacity={0.7} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#f2ca50" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Просмотр кейса</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Author */}
        <View style={styles.authorBlock}>
          <AuthorAvatar source={avatarSource} size={62} />
          <View style={styles.authorInfo}>
            <View style={[styles.roleBadge, isTech && styles.roleBadgeTech]}>
              <Text style={[styles.roleBadgeText, isTech && styles.roleBadgeTextTech]}>{roleDisplay}</Text>
            </View>
            <Text style={styles.authorName}>{displayName}</Text>
          </View>
          {isOwn && (
            <TouchableOpacity style={styles.manageButton} activeOpacity={0.7} onPress={() => setMenuVisible(true)}>
              <Ionicons name="ellipsis-vertical" size={22} color="#f2ca50" />
            </TouchableOpacity>
          )}
        </View>

        {/* Media */}
        {(() => {
          const rawMedia = localCase?.media ?? item.media;
          const normMedia: CaseMedia[] = (Array.isArray(rawMedia)
            ? rawMedia as any[]
            : (rawMedia && typeof rawMedia === 'object' ? Object.values(rawMedia) as any[] : []))
            .filter((m: any) => m?.uri?.startsWith('https://') || m?.uri?.startsWith('data:'));
          return normMedia.length > 0
            ? <MediaCarousel media={normMedia} onPressPhoto={(i) => setViewer({ media: normMedia, index: i })} />
            : null;
        })()}

        {/* Tags */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsRow}>
          {((): string[] => { const t = (localCase || item).tags; return Array.isArray(t) ? t : (t && typeof t === 'object' ? Object.values(t) : []); })().map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Описание клинической ситуации — сразу после хэштегов */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="document-text-outline" size={20} color="#f2ca50" />
            <Text style={styles.sectionTitle}>Клиническая ситуация</Text>
          </View>
          {isEditing ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.editInput}
                value={editedDescription}
                onChangeText={setEditedDescription}
                multiline
                placeholder="Введите описание кейса..."
                placeholderTextColor="rgba(255,255,255,0.5)"
              />
              <View style={styles.editButtons}>
                <TouchableOpacity style={styles.editButton} activeOpacity={0.7} onPress={handleCancelEdit}>
                  <Text style={styles.editButtonText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.editButton, styles.editButtonSave]} activeOpacity={0.7} onPress={handleSaveEdit}>
                  <Text style={styles.editButtonTextSave}>Сохранить</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.fullDescription}>{localCase?.fullDescription || item.fullDescription}</Text>
          )}
        </View>

        {/* AI-разбор — под описанием */}
        <AiReviewBlock review={item.aiReview} onSpent={refreshDiamonds} />

        {/* Riddle */}
        {item.riddle && <RiddleBlock riddle={item.riddle} onReward={refreshDiamonds} />}

        {/* Comment input — inside scroll */}
        <View style={styles.commentInputRow}>
          <TextInput
            style={styles.commentInput}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Написать комментарий..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={handleAddComment}
          />
          <TouchableOpacity
            style={styles.commentSendBtn}
            activeOpacity={0.75}
            onPress={handleAddComment}
          >
            <Ionicons name="send" size={18} color="#0b0e14" />
          </TouchableOpacity>
        </View>

        {/* Comments list */}
        {comments.length > 0 && (
          <View style={styles.commentsList}>
            {comments.map((c) => (
              <View key={c.id} style={styles.commentItem}>
                <View style={styles.commentAvatar}>
                  {identity?.avatarSource && c.author === identity?.name ? (
                    <Image source={identity.avatarSource} style={styles.commentAvatarImg} />
                  ) : (
                    <Ionicons name="person" size={16} color="rgba(242,202,80,0.7)" />
                  )}
                </View>
                <View style={styles.commentBody}>
                  <Text style={styles.commentAuthorText}>{c.author}</Text>
                  <Text style={styles.commentContentText}>{c.text}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>

      <BottomTabBar />

      <FullscreenViewer
        media={viewer?.media ?? null}
        initialIndex={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
      />

      <PostActionsSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onEditText={handleEditText}
        onDeletePhoto={handleDeletePhoto}
        onDeletePost={handleDeletePost}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 18, fontWeight: '700', color: '#ffffff' },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  navBackButton: {
    position: 'absolute',
    left: 16,
    padding: 8,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 12 },

  authorBlock: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  authorInfo: { flex: 1, marginLeft: 14 },
  avatar: {
    borderWidth: 2,
    borderColor: 'rgba(242, 202, 80, 0.6)',
    backgroundColor: '#1a2030',
  },
  avatarSilhouette: { alignItems: 'center', justifyContent: 'center' },
  authorName: { fontSize: 17, fontWeight: '700', color: '#ffffff', marginBottom: 6 },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.5)',
    backgroundColor: 'rgba(242, 202, 80, 0.1)',
  },
  roleBadgeTech: { borderColor: 'rgba(79, 195, 247, 0.5)', backgroundColor: 'rgba(79, 195, 247, 0.1)' },
  roleBadgeText: { fontSize: 12, fontWeight: '700', color: '#f2ca50', letterSpacing: 0.5 },
  roleBadgeTextTech: { color: '#4fc3f7' },
  manageButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  mediaWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 14 },
  mediaImage: { width: MEDIA_WIDTH, height: 240, borderRadius: 16, backgroundColor: '#10141f' },
  stageBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(11, 14, 20, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  stageBadgeText: { fontSize: 11, fontWeight: '700', color: '#ffffff', letterSpacing: 0.5, textTransform: 'uppercase' },
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
    backgroundColor: 'rgba(11, 14, 20, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  counterText: { fontSize: 11, fontWeight: '700', color: '#ffffff', letterSpacing: 0.3 },
  dotsRow: { position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255, 255, 255, 0.4)' },
  dotActive: { backgroundColor: '#f2ca50', width: 18 },

  tagsRow: { gap: 8, paddingVertical: 2, marginBottom: 16 },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(242, 202, 80, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.35)',
    borderRadius: 4,
  },
  tagText: { fontSize: 12, fontWeight: '600', color: '#f2ca50', letterSpacing: 0.3 },

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
  fullDescription: { fontSize: 14, lineHeight: 22, color: 'rgba(255, 255, 255, 0.82)' },
  editContainer: { marginBottom: 12 },
  editInput: {
    backgroundColor: 'rgba(11, 14, 20, 0.6)',
    borderRadius: 12,
    padding: 14,
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    minHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 12,
  },
  editButtons: { flexDirection: 'row', gap: 10 },
  editButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  editButtonSave: {
    backgroundColor: '#f2ca50',
    borderColor: '#f2ca50',
  },
  editButtonText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  editButtonTextSave: { fontSize: 14, fontWeight: '700', color: '#0b0e14' },

  /* AI review */
  aiBadgeRow: { marginBottom: 12 },
  aiTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(20, 10, 10, 0.8)',
    borderWidth: 2,
    borderColor: '#8b0000',
  },
  aiTagText: { fontSize: 11, fontWeight: '900', color: '#ff4444', letterSpacing: 1 },
  aiHint: { fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.65)', marginBottom: 14 },
  aiRunButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f2ca50',
    borderRadius: 12,
    paddingVertical: 13,
  },
  aiRunText: { fontSize: 15, fontWeight: '800', color: '#0b0e14', letterSpacing: 0.3 },
  eshafotnikButton: {
    marginTop: 4,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  eshafotnikText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff8a8a',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  aiReviewBubble: {
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    borderRadius: 12,
    padding: 14,
  },
  aiReviewText: { fontSize: 14, lineHeight: 22, color: 'rgba(255,255,255,0.9)', fontStyle: 'italic' },
  aiLikeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  aiLikeText: { fontSize: 13, fontWeight: '600', color: '#f2ca50' },

  /* Riddle */
  rewardLine: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(79, 195, 247, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(79, 195, 247, 0.4)',
    marginBottom: 14,
  },
  rewardLineText: { fontSize: 12, fontWeight: '700', color: '#4fc3f7' },
  riddleQuestion: { fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.85)', marginBottom: 14 },
  hexGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  hexContent: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 1 },
  hexLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  hexPercent: { fontSize: 9, fontWeight: '700', color: '#ffffff' },
  riddleResult: { fontSize: 13, fontWeight: '600', color: '#7CFC8A', marginTop: 16, textAlign: 'center' },
  riddleResultWrong: { color: '#ff9e9e' },

  /* Comments */
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  commentBubble: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 26, 0.6)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginBottom: 2 },
  commentText: { fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.7)' },
  addCommentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  addCommentText: { fontSize: 13, color: 'rgba(242, 202, 80, 0.8)', fontWeight: '500' },
  commentsList: {
    marginTop: 8,
    gap: 6,
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: 8,
  },
  commentAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(242,202,80,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  commentAvatarImg: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  commentBody: {
    flex: 1,
  },
  commentAuthorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f2ca50',
    marginBottom: 3,
  },
  commentContentText: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.85)',
  },

  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 20, 35, 0.9)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
    paddingVertical: 8,
    paddingRight: 8,
  },
  commentSendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f2ca50',
    alignItems: 'center',
    justifyContent: 'center',
  },


  /* Fullscreen viewer */
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
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
  viewerSlide: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, alignItems: 'center', justifyContent: 'center' },
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
