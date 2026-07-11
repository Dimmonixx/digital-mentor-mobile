import BottomTabBar from '@/components/BottomTabBar';
import { DemoOverlay, DemoOverlayData, PostActionsSheet } from '@/components/case-post-actions';
import GlobalHeader from '@/components/global-header';
import { API_BASE_URL } from '@/constants/config';
import { getFirebaseDB } from '@/constants/firebase';
import {
    CASES,
    CaseComment,
    CaseMedia,
    ClinicalCase,
    isOwnCase
} from '@/data/cases';
import { getUserIdentity } from '@/utils/getUserIdentity';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { get, off, onValue, ref, remove, set } from 'firebase/database';
import { TrendingUpDown } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Clipboard,
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
  caseId,
  riddle,
  onReward,
}: {
  caseId: string;
  riddle: ClinicalCase['riddle'];
  onReward: () => void;
}) => {
  const [picked, setPicked] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctShade, setCorrectShade] = useState<string | null>(null);
  if (!riddle) return null;

  const submitServerRiddle = async (label: string) => {
    let userId = '';
    try {
      const rawUser = await AsyncStorage.getItem('user');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        userId = u.id || u.email || '';
      }
    } catch {}

    if (!userId || !caseId) return;

    try {
      const response = await fetch('http://62.238.13.160:8000/case-club/riddle/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          user_id: userId,
          selected_shade: label,
        }),
      });

      if (response.status === 400) {
        Alert.alert('Уже решено', 'Вы уже отправляли ответ на эту загадку.');
        setCorrectShade(riddle.correct);
        setIsCorrect(picked === riddle.correct);
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        Alert.alert('Ошибка', data.detail || `Не удалось проверить ответ (${response.status})`);
        return;
      }

      const data = await response.json();
      setIsCorrect(Boolean(data.correct));
      setCorrectShade(data.correct_shade || null);
      if (data.correct) {
        onReward();
      }
    } catch (e) {
      console.warn('[CaseDetails] riddle request failed:', e);
      Alert.alert('Ошибка', 'Не удалось связаться с сервером. Проверьте подключение.');
    }
  };

  const onPick = async (label: string) => {
    if (picked != null) return;
    setPicked(label);
    await submitServerRiddle(label);
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
            correct={correctShade ? opt.label === correctShade : opt.label === riddle.correct}
            onPress={() => onPick(opt.label)}
          />
        ))}
      </View>
      {picked != null && (
        <View style={[styles.riddleVerdictCard, isCorrect && styles.riddleVerdictCardCorrect]}>
          <Ionicons
            name={isCorrect ? 'checkmark-circle' : 'close-circle'}
            size={28}
            color={isCorrect ? '#f2ca50' : '#d32f2f'}
          />
          <Text style={[styles.riddleVerdictTitle, isCorrect && styles.riddleVerdictTitleCorrect]}>
            {isCorrect ? 'ВЕРНО' : 'НЕВЕРНО'}
          </Text>
          <Text style={styles.riddleVerdictText}>
            {isCorrect
              ? `Правильный ответ — ${correctShade}. Вам начислен +1 заряд ИИ.`
              : `Правильный ответ — ${correctShade}. Вы выбрали ${picked}.`}
          </Text>
        </View>
      )}
    </View>
  );
};

const cleanMarkdown = (text: string): string => {
  return text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^---+$/gm, '───────────')
    .replace(/^-\s/gm, '• ')
    .trim();
};

/* ---------------- AI review (harsh critic) ---------------- */
const AiReviewBlock = ({ 
  caseId, 
  currentUserId, 
  userEmail, 
  initialTotal, 
  initialReview,
  showVoteModal,
  setShowVoteModal
}: { 
  caseId: string; 
  currentUserId: string; 
  userEmail: string; 
  initialTotal: number; 
  initialReview: string; 
  showVoteModal: boolean;
  setShowVoteModal: (show: boolean) => void;
}) => {
  console.log('=== AIBLOCK RENDER ===', { caseId, currentUserId });
  const [total, setTotal] = useState(initialTotal);
  const [aiReview, setAiReview] = useState(initialReview);
  const [showVerdictModal, setShowVerdictModal] = useState(false);
  const [selectedEnergy, setSelectedEnergy] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  console.log('=== SENSEI STATE CHECK ===', { aiReview: !!aiReview, isGenerating, total, senseiState: aiReview ? 'ready' : (isGenerating || total >= 5) ? 'processing' : 'pending' });
  const senseiState = aiReview ? 'ready' : (isGenerating || total >= 5) ? 'processing' : 'pending';
  console.log('=== SENSEI STATE ===', { total, aiReview: aiReview?.slice(0, 50), senseiState });

  useEffect(() => {
    if (!caseId) return;
    AsyncStorage.getItem(`sensei_generating_${caseId}`).then(val => {
      if (val === 'true') setIsGenerating(true);
    });
    const totalRef = ref(getFirebaseDB(), `case_club/${caseId}/aiReviewTotal`);
    const reviewRef = ref(getFirebaseDB(), `case_club/${caseId}/aiReview`);

    const unsubTotal = onValue(totalRef, (snap) => {
      setTotal(snap.val() || 0);
    });

    const unsubReview = onValue(reviewRef, (snap) => {
      const review = snap.val() || '';
      console.log('=== REVIEW UPDATED ===', review);
      setAiReview(review);
      if (review) {
        AsyncStorage.removeItem(`sensei_generating_${caseId}`);
      }
    });

    return () => {
      off(totalRef);
      off(reviewRef);
    };
  }, [caseId]);

  const handleVote = async () => {
    console.log('=== HANDLE VOTE ===', { currentUserId, selectedEnergy, caseId });
    if (!currentUserId) return;
    const willTriggerSensei = (total + selectedEnergy) >= 5;
    if (willTriggerSensei) {
      setShowVoteModal(false);
      setIsGenerating(true);
      AsyncStorage.setItem(`sensei_generating_${caseId}`, 'true');
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/case-club/sensei-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          user_id: currentUserId,
          energy_amount: selectedEnergy,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setTotal(data.total || 0);
        setIsGenerating(false);
        (globalThis as any).forceDiamondUpdate?.();
        console.log('=== SENSEI VOTE RESULT ===', data);
        if (data.status === 'ready' && data.aiReview) {
          setAiReview(data.aiReview);
          setShowVoteModal(false);
          setShowVerdictModal(true);
        }
      }
    } catch (e) {
      console.error('[AiReviewBlock] Ошибка голосования:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name="skull-outline" size={28} color="#ff6b6b" />
        <Text style={styles.sectionTitle}>AI-разбор работы</Text>
      </View>
      
      {senseiState === 'ready' && (
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.verdictReadyButton}
          onPress={() => setShowVerdictModal(true)}
        >
          <Text style={styles.verdictReadyText}>⚔️ Вердикт Сенсея готов</Text>
        </TouchableOpacity>
      )}

      {senseiState === 'processing' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>⏳ Сенсей составляет вердикт...</Text>
        </View>
      )}

      {senseiState === 'pending' && (
        <View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(total / 5) * 100}%` }]} />
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.callSenseiButton}
            onPress={() => setShowVoteModal(true)}
            disabled={senseiState !== 'pending'}
          >
            <Text style={styles.callSenseiText}>Вызвать Сенсея {total}/5⚡</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Модал выбора энергии */}
      <Modal visible={showVoteModal} transparent animationType="fade" onRequestClose={() => setShowVoteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.voteModal}>
            <Text style={styles.voteModalTitle}>Вызвать Сенсея</Text>
            <Text style={styles.voteModalText}>
              💀 AI-Сенсей — строгий эксперт с 30-летним опытом. Он разберёт работу жёстко, честно и профессионально — без лести и снисхождения.{"\n\n"}Когда сообщество накопит 5⚡ — вердикт появится для всех навсегда.
            </Text>
            
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(total / 5) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>{total}/5 энергии накоплено</Text>
            
            <View style={styles.energyButtons}>
              {[1, 2, 3, 5].map((energy) => (
                <TouchableOpacity
                  key={energy}
                  style={[
                    styles.energyButton,
                    selectedEnergy === energy && styles.energyButtonSelected
                  ]}
                  onPress={() => setSelectedEnergy(energy)}
                >
                  <Text style={[
                    styles.energyButtonText,
                    selectedEnergy === energy && styles.energyButtonTextSelected
                  ]}>
                    {energy}⚡
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity 
              style={styles.submitButton} 
              onPress={handleVote}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Вносим...' : 'Внести'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => setShowVoteModal(false)}
            >
              <Text style={styles.cancelButtonText}>Выход</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модал вердикта */}
      <Modal visible={showVerdictModal} transparent animationType="fade" onRequestClose={() => setShowVerdictModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', paddingTop: 60, paddingBottom: 40, paddingHorizontal: 20 }}>
          <View style={{ flex: 1, width: '100%', backgroundColor: '#1a1f2e', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#ff6b6b', textAlign: 'center', marginBottom: 12 }}>⚔️ Вердикт Сенсея</Text>
            <ScrollView style={{ marginBottom: 16 }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.verdictModalText}>{cleanMarkdown(aiReview)}</Text>
            </ScrollView>
            <TouchableOpacity 
              style={styles.closeVerdictButton} 
              onPress={() => setShowVerdictModal(false)}
            >
              <Text style={styles.closeVerdictButtonText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
          <Text style={styles.commentAuthor}>{formatShortName(c.author)}</Text>
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
  const commentsScrollRef = useRef<ScrollView>(null);
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
  const [commentAuthorAvatars, setCommentAuthorAvatars] = useState<Record<string, any>>({});
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentEmail, setCurrentEmail] = useState<string>('');
  const [currentAuthorName, setCurrentAuthorName] = useState<string>('');
  const [currentFullName, setCurrentFullName] = useState<string>('');
  const [currentUserFullName, setCurrentUserFullName] = useState<string>('');
  const [authorProfileName, setAuthorProfileName] = useState<string>('');
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [selectedComment, setSelectedComment] = useState<any>(null);
  const [showCommentMenu, setShowCommentMenu] = useState(false);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [overlayData, setOverlayData] = useState<DemoOverlayData>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    AsyncStorage.getItem('user').then(async (raw) => {
      if (raw) {
        const u = JSON.parse(raw);
        if (u.id) setCurrentUserId(u.id);
        if (u.email) setCurrentEmail(u.email);
        if (u.name) {
          setCurrentFullName(u.name);
          setCurrentAuthorName((prev) => prev || u.name);
        }
        // Загружаем полное имя из профиля Firebase
        if (u.id) {
          const profileSnap = await get(ref(getFirebaseDB(), `users/${u.id}/profile`));
          if (profileSnap.exists()) {
            setCurrentUserFullName(profileSnap.val().name || '');
          }
        }
      }
    }).catch(() => {});
    refreshDiamonds();
    const loadCase = async () => {
      try {
        // Читаем из Firebase как основного источника
        const fbSnap = await get(ref(getFirebaseDB(), `case_club/${id}`));
        let found: ClinicalCase | null = fbSnap.exists() ? fbSnap.val() : null;
        // Fallback: локальный кэш
        if (!found) {
          const raw = await AsyncStorage.getItem('@global_case_club_posts');
          const posts: ClinicalCase[] = raw ? JSON.parse(raw) : [];
          found = posts.find((p) => p.id === id) ?? null;
        }
        setItem(found);
        
        // Нормализация данных из case_club формата
        if (found && !(found as any).media && (found as any).imageUrl) {
          const imageUrl = (found as any).imageUrl;
          const additionalImages = (found as any).additionalImages || [];
          const mediaArr = [
            { uri: imageUrl, stage: 'Обложка' },
            ...additionalImages.map((url: string, i: number) => ({ uri: url, stage: `Фото ${i + 2}` }))
          ];
          (found as any).media = mediaArr;
        }
        if (found && !(found as any).fullDescription && (found as any).description) {
          (found as any).fullDescription = (found as any).description;
        }
        
        if (found) {
          setLocalCase({ ...found });
          setEditedDescription(found.fullDescription);
          setComments(found.commentsList ?? []);
          console.log('=== COMMENTS LOADED ===', { id, commentsList: found?.commentsList });
          
          // Загружаем профиль автора для актуального имени
          if ((found as any).authorId) {
            try {
              const profileSnap = await get(ref(getFirebaseDB(), `users/${(found as any).authorId}/profile`));
              if (profileSnap.exists()) {
                const profile = profileSnap.val();
                if (profile.name) {
                  setAuthorProfileName(profile.name);
                }
              }
            } catch (e) {
              console.error('[CaseDetails] Ошибка загрузки профиля автора:', e);
            }
          }
        }
      } catch (e) {
        console.error('[CaseDetails] Ошибка чтения AsyncStorage:', e);
      }
    };
    loadCase();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const commentsRef = ref(getFirebaseDB(), `case_club/${id}/commentsList`);

    const unsub = onValue(commentsRef, async (snapshot) => {
      if (!snapshot.exists()) {
        setComments([]);
        setCommentAuthorAvatars({});
        return;
      }

      const commentsData = snapshot.val();
      const commentsList = Array.isArray(commentsData) ? commentsData : Object.values(commentsData);
      setComments(commentsList);

      const uniqueAuthorIds = [...new Set(
        commentsList
          .map((c: any) => c.authorId)
          .filter((authorId: any) => !!authorId)
      )] as string[];

      const avatarEntries = await Promise.all(
        uniqueAuthorIds.map(async (authorId) => {
          try {
            const profileSnap = await get(ref(getFirebaseDB(), `users/${authorId}/profile`));
            if (profileSnap.exists()) {
              return [authorId, profileSnap.val()] as [string, any];
            }
          } catch (e) {
            console.error('[CaseDetails] Ошибка загрузки аватарки автора комментария:', e);
          }
          return [authorId, null] as [string, any];
        })
      );

      const avatarsMap: Record<string, any> = {};
      avatarEntries.forEach(([authorId, profile]) => {
        if (profile) avatarsMap[authorId] = profile;
      });
      setCommentAuthorAvatars(avatarsMap);
    });

    return () => off(commentsRef);
  }, [id]);

  if (!item) {
    return (
      <ImageBackground source={require('@/assets/images/background.png')} style={{ flex: 1 }} resizeMode="cover">
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <GlobalHeader 
          diamonds={diamonds}
          newOrdersCount={(globalThis as any).getNewOrdersCount?.() ?? 0}
          onBurgerPress={() => (globalThis as any).openDrawer?.()}
        />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Кейс не найден</Text>
        </View>
      </ImageBackground>
    );
  }

  const isOwn = isOwnCase(item, currentUserId, currentEmail, currentAuthorName, currentFullName);
  const isAnon = !!item.anonymous;

  const formatShortName = (fullName: string) => {
    if (!fullName) return 'Аноним';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    const [last, first, middle] = parts;
    const firstI = first ? first[0].toUpperCase() + '.' : '';
    const middleI = middle ? middle[0].toUpperCase() + '.' : '';
    return `${last} ${firstI}${middleI}`;
  };

  const formatCommentTime = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) + ' ' +
      d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const resolvedRole = isOwn && identity?.role ? identity.role : ((item as any).role ?? '');
  const isTech = resolvedRole === 'Техник' || resolvedRole === 'Зубной техник' || resolvedRole === 'technician';
  const roleDisplay = isTech ? 'Зубной техник' : 'Врач';

  const rawName = isAnon ? 'Анонимный коллега' : authorProfileName || (isOwn && identity?.name ? identity.name : item.author);
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
    console.log('=== ADD COMMENT ===', { itemId: item?.id, id });
    const text = commentText.trim();
    if (!text) return;
    const authorName = currentUserFullName || identity?.name || 'Анонимный';
    console.log('=== AUTHOR NAME ===', { currentUserFullName, identityName: identity?.name, authorName });
    const newComment: CaseComment = {
      id: Date.now().toString(),
      author: authorName,
      authorId: currentUserId,
      avatar: '',
      text,
      createdAt: Date.now(),
    } as CaseComment;
    const updated = [newComment, ...comments];
    setComments(updated);
    setCommentText('');
    setTimeout(() => commentsScrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      // Обновляем в Firebase
      await set(ref(getFirebaseDB(), `case_club/${id}/commentsList`), updated);
      console.log('=== COMMENT SAVED TO FIREBASE ===', { id, updated });
      await set(ref(getFirebaseDB(), `case_club/${id}/commentsCount`), updated.length);
    } catch (e) {
      console.error('[CaseDetails] Ошибка сохранения комментария:', e);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const updated = comments.filter((c) => c.id !== commentId);
    setComments(updated);
    setShowCommentMenu(false);
    setSelectedComment(null);
    try {
      await set(ref(getFirebaseDB(), `case_club/${id}/commentsList`), updated);
      await set(ref(getFirebaseDB(), `case_club/${id}/commentsCount`), updated.length);
    } catch (e) {
      console.error('[CaseDetails] Ошибка удаления комментария:', e);
    }
  };

  const handleEditComment = async (commentId: string, newText: string) => {
    const updated = comments.map((c) => c.id === commentId ? { ...c, text: newText } : c);
    setComments(updated);
    setShowCommentMenu(false);
    setSelectedComment(null);
    try {
      await set(ref(getFirebaseDB(), `case_club/${id}/commentsList`), updated);
    } catch (e) {
      console.error('[CaseDetails] Ошибка редактирования комментария:', e);
    }
  };

  const handleCopyComment = (text: string) => {
    Clipboard.setString(text);
    setShowCommentMenu(false);
    setSelectedComment(null);
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
    setOverlayData({
      title: 'Удалить кейс?',
      message: 'Это действие нельзя отменить. Кейс будет удалён навсегда.',
      icon: 'trash-outline',
      danger: true,
      confirmText: 'Удалить',
      onConfirm: async () => {
        setOverlayData(null);
        try {
          await remove(ref(getFirebaseDB(), `case_club/${id}`));
        } catch (e) {
          console.error('[CaseDetails] Ошибка удаления кейса:', e);
        }
        router.back();
      },
    });
  };

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={{ flex: 1, backgroundColor: 'transparent' }}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <GlobalHeader 
          diamonds={diamonds}
          aiDailyLimit={(globalThis as any).getAiDailyLimit?.() ?? 15}
          newOrdersCount={(globalThis as any).getNewOrdersCount?.() ?? 0}
          onBurgerPress={() => (globalThis as any).openDrawer?.()}
        />

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navBackButton} activeOpacity={0.7} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#f2ca50" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Просмотр кейса</Text>
      </View>

      <ScrollView ref={commentsScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
        <AiReviewBlock 
          caseId={(item as any).id || id}
          currentUserId={currentUserId}
          userEmail={currentEmail}
          initialTotal={(item as any).aiReviewTotal || 0}
          initialReview={(item as any).aiReview || ''}
          showVoteModal={showVoteModal}
          setShowVoteModal={setShowVoteModal}
        />

        {/* Riddle */}
        {item.riddle && <RiddleBlock caseId={id} riddle={item.riddle} onReward={refreshDiamonds} />}

        {/* Comments list */}
        {comments.length > 0 && (
          <View style={styles.commentsList}>
            {comments.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.commentItem}
                activeOpacity={0.85}
                onLongPress={() => { setSelectedComment(c); setShowCommentMenu(true); }}
              >
                <View style={styles.commentAvatar}>
                  {(() => {
                    const authorProfile = (c as any).authorId ? commentAuthorAvatars[(c as any).authorId] : null;
                    let avatarSource: any = null;
                    if (authorProfile?.avatarType === 'custom' && authorProfile?.avatarUrl) {
                      avatarSource = { uri: authorProfile.avatarUrl };
                    } else if (authorProfile?.avatarType === 'preset' && authorProfile?.avatarPresetId) {
                      avatarSource = PRESET_AVATARS[(authorProfile.avatarPresetId - 1) % PRESET_AVATARS.length];
                    } else if (identity?.avatarSource && (c.author === identity?.name || c.author === currentUserFullName)) {
                      avatarSource = identity.avatarSource;
                    }
                    return avatarSource ? (
                      <Image source={avatarSource} style={styles.commentAvatarImg} />
                    ) : (
                      <Ionicons name="person" size={16} color="rgba(242,202,80,0.7)" />
                    );
                  })()}
                </View>
                <View style={styles.commentBody}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.commentAuthorText}>{formatShortName(c.author)}</Text>
                    {(c as any).createdAt ? (
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
                        {formatCommentTime((c as any).createdAt)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.commentContentText}>{c.text}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

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
            <TrendingUpDown size={18} color="#0b0e14" />
          </TouchableOpacity>
        </View>

        
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

      <DemoOverlay data={overlayData} onClose={() => setOverlayData(null)} />

      {/* Comment Context Menu Modal */}
      <Modal
        visible={showCommentMenu}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowCommentMenu(false); setIsEditingComment(false); setShowDeleteConfirm(false); }}
      >
        <TouchableOpacity
          style={styles.commentMenuOverlay}
          activeOpacity={1}
          onPress={() => { setShowCommentMenu(false); setIsEditingComment(false); setShowDeleteConfirm(false); }}
        >
          <View style={styles.commentMenuCard}>

            {/* Режим просмотра */}
            {!isEditingComment && !showDeleteConfirm && (
              <>
                <Text style={styles.commentMenuAuthor} numberOfLines={1}>
                  {formatShortName(selectedComment?.author || '')}
                </Text>
                <Text style={styles.commentMenuText} numberOfLines={3}>{selectedComment?.text}</Text>

                <TouchableOpacity style={styles.commentMenuBtn} onPress={() => handleCopyComment(selectedComment?.text || '')}>
                  <Text style={styles.commentMenuBtnText}>📋 Копировать</Text>
                </TouchableOpacity>

                {(selectedComment?.author === currentUserFullName || selectedComment?.author === identity?.name) && (
                  <TouchableOpacity
                    style={styles.commentMenuBtn}
                    onPress={() => { setIsEditingComment(true); setEditingCommentText(selectedComment?.text || ''); }}
                  >
                    <Text style={styles.commentMenuBtnText}>✏️ Редактировать</Text>
                  </TouchableOpacity>
                )}

                {(selectedComment?.author === currentUserFullName || selectedComment?.author === identity?.name) && (
                  <TouchableOpacity
                    style={styles.commentMenuBtn}
                    onPress={() => setShowDeleteConfirm(true)}
                  >
                    <Text style={[styles.commentMenuBtnText, { color: '#ff6b6b' }]}>🗑 Удалить</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.commentMenuCancelBtn} onPress={() => setShowCommentMenu(false)}>
                  <Text style={styles.commentMenuCancelText}>Закрыть</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Режим редактирования */}
            {isEditingComment && (
              <>
                <Text style={styles.commentMenuAuthor}>Редактировать</Text>
                <TextInput
                  style={styles.commentEditInput}
                  value={editingCommentText}
                  onChangeText={setEditingCommentText}
                  multiline
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.commentMenuSaveBtn}
                  onPress={() => { handleEditComment(selectedComment.id, editingCommentText); setIsEditingComment(false); }}
                >
                  <Text style={styles.commentMenuSaveBtnText}>Сохранить</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.commentMenuCancelBtn} onPress={() => setIsEditingComment(false)}>
                  <Text style={styles.commentMenuCancelText}>Отмена</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Режим подтверждения удаления */}
            {showDeleteConfirm && (
              <>
                <Text style={styles.commentMenuAuthor}>Удалить комментарий?</Text>
                <Text style={styles.commentMenuText}>Это действие нельзя отменить.</Text>
                <TouchableOpacity
                  style={styles.commentMenuDeleteBtn}
                  onPress={() => { handleDeleteComment(selectedComment.id); setShowDeleteConfirm(false); }}
                >
                  <Text style={styles.commentMenuDeleteBtnText}>Удалить</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.commentMenuCancelBtn} onPress={() => setShowDeleteConfirm(false)}>
                  <Text style={styles.commentMenuCancelText}>Отмена</Text>
                </TouchableOpacity>
              </>
            )}

          </View>
        </TouchableOpacity>
      </Modal>
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
  senseiProgressButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    borderRadius: 20,
    gap: 2,
  },
  senseiProgressText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ff6b6b',
    marginTop: -2,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 12,
  },

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

  /* New AI Review Styles */
  verdictReadyButton: {
    backgroundColor: 'rgba(242, 202, 80, 0.15)',
    borderWidth: 1,
    borderColor: '#f2ca50',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  verdictReadyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f2ca50',
    letterSpacing: 0.3,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f2ca50',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: 12,
  },
  callSenseiButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.4)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  callSenseiText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff6b6b',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  voteModal: {
    backgroundColor: '#1a1f2e',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  voteModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  voteModalText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  energyButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  energyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    width: 60,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  energyButtonSelected: {
    backgroundColor: 'rgba(242, 202, 80, 0.2)',
    borderColor: '#f2ca50',
  },
  energyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  energyButtonTextSelected: {
    color: '#f2ca50',
  },
  submitButton: {
    backgroundColor: '#f2ca50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1206',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  verdictModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  verdictModal: {
    backgroundColor: '#1a1f2e',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  verdictModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 16,
  },
  verdictModalText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 20,
    marginBottom: 20,
  },
  closeVerdictButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.4)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeVerdictButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6b6b',
  },

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
  riddleVerdictCard: {
    backgroundColor: 'rgba(10, 16, 30, 0.92)',
    borderRadius: 16,
    padding: 18,
    marginTop: 18,
    borderWidth: 1,
    borderColor: 'rgba(211, 47, 47, 0.6)',
    alignItems: 'center',
    gap: 8,
  },
  riddleVerdictCardCorrect: {
    borderColor: 'rgba(242, 202, 80, 0.6)',
  },
  riddleVerdictTitle: {
    color: '#ff9e9e',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  riddleVerdictTitleCorrect: {
    color: '#f2ca50',
  },
  riddleVerdictText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },

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

  /* Comment Context Menu */
  commentMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  commentMenuCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.2)',
  },
  commentMenuAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f2ca50',
    marginBottom: 4,
  },
  commentMenuText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.55)',
    marginBottom: 16,
    lineHeight: 18,
  },
  commentMenuBtn: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.07)',
  },
  commentMenuBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  commentMenuCancelBtn: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    marginTop: 4,
    alignItems: 'center',
  },
  commentMenuCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  commentEditInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.4)',
    borderRadius: 10,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    minHeight: 80,
    marginBottom: 12,
    marginTop: 8,
    textAlignVertical: 'top',
  },
  commentMenuSaveBtn: {
    backgroundColor: '#f2ca50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  commentMenuSaveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1206',
  },
  commentMenuDeleteBtn: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderWidth: 1,
    borderColor: '#ff6b6b',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  commentMenuDeleteBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ff6b6b',
  },
});
