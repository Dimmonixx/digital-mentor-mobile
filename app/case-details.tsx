import { PostActionsSheet } from '@/components/case-post-actions';
import GlobalHeader from '@/components/global-header';
import {
  CASES,
  CaseComment,
  CaseMedia,
  ClinicalCase,
  deleteCaseById,
  getCaseById,
  isOwnCase,
  registerAiLike,
  registerCorrectRiddle,
  roleLabel
} from '@/data/cases';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const AI_REVIEW_COST = 3;

// Компактная сетка гексагонов (4 в ряд)
const HEX_GAP = 8;
const HEX_COLS = 4;
const HEX_W = Math.floor((CONTENT_WIDTH - 32 - HEX_GAP * (HEX_COLS - 1)) / HEX_COLS * 0.8);
const HEX_H = 48;

type Identity = { name: string; avatarSource: ImageSourcePropType | null } | undefined;

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
const MediaCarousel = ({ media, onPressPhoto }: { media: CaseMedia[]; onPressPhoto: (i: number) => void }) => {
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
  riddle: NonNullable<ReturnType<typeof getCaseById>>['riddle'];
  onReward: () => void;
}) => {
  const [picked, setPicked] = useState<string | null>(null);
  const [rewarded, setRewarded] = useState(false);
  if (!riddle) return null;

  const onPick = (label: string) => {
    if (picked != null) return;
    setPicked(label);
    if (label === riddle.correct && !rewarded) {
      setRewarded(true);
      (globalThis as any).spendDiamonds?.(-1); // начисляем +1 💎
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
        <Ionicons name="diamond-outline" size={13} color="#4fc3f7" />
        <Text style={styles.rewardLineText}>+1 💎 за верный ответ</Text>
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
            ? `Верно! Вам начислен +1 💎. Большинство коллег выбрали ${riddle.correct}.`
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

  const runReview = () => {
    const ok = (globalThis as any).spendDiamonds?.(AI_REVIEW_COST);
    if (!ok) {
      Alert.alert('Недостаточно 💎', `Для AI-разбора нужно ${AI_REVIEW_COST} 💎. Пополните баланс в разделе «Премиум».`);
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
      <View style={styles.aiBadgeRow}>
        <View style={styles.aiTag}>
          <Text style={styles.aiTagText}>ИНКВИЗИТОР</Text>
        </View>
      </View>

      {!revealed ? (
        <>
          <Text style={styles.aiHint}>
            Беспощадный цифровой Инквизитор найдет нависающие края, оценит уступ и устроит тотальную профессиональную прожарку керамики без цензуры.
          </Text>
          <TouchableOpacity activeOpacity={0.85} style={styles.aiRunButton} onPress={runReview}>
            <Ionicons name="flash" size={18} color="#0b0e14" />
            <Text style={styles.aiRunText}>Включить прожарку ИИ · {AI_REVIEW_COST} 💎</Text>
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
  const item = useMemo(() => getCaseById(id), [id]);
  const [identity, setIdentity] = useState<Identity>(() => (globalThis as any).getCaseClubIdentity?.());
  const [viewer, setViewer] = useState<{ media: CaseMedia[]; index: number } | null>(null);
  const [diamonds, setDiamonds] = useState<number>(() => (globalThis as any).getDiamondBalance?.() ?? 0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [localCase, setLocalCase] = useState<ClinicalCase | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');

  const refreshDiamonds = () => setDiamonds((globalThis as any).getDiamondBalance?.() ?? 0);

  useEffect(() => {
    setIdentity((globalThis as any).getCaseClubIdentity?.());
    refreshDiamonds();
    if (item) {
      setLocalCase({ ...item });
      setEditedDescription(item.fullDescription);
    }
  }, [item]);

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

  const isOwn = isOwnCase(item);
  const isAnon = !!item.anonymous;
  const isTech = item.role === 'Техник';
  const displayName = isAnon ? 'Анонимный коллега' : isOwn && identity?.name ? identity.name : item.author;
  const avatarSource: ImageSourcePropType | null = isAnon
    ? null
    : isOwn && identity?.avatarSource
      ? identity.avatarSource
      : { uri: item.avatar };

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
              <Text style={[styles.roleBadgeText, isTech && styles.roleBadgeTextTech]}>{roleLabel(item.role)}</Text>
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
        <MediaCarousel media={localCase?.media || item.media} onPressPhoto={(i) => setViewer({ media: localCase?.media || item.media, index: i })} />

        {/* Tags */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsRow}>
          {(localCase || item).tags.map((tag) => (
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

        <View style={{ height: 40 }} />
      </ScrollView>

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

  scrollContent: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 12 },

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
