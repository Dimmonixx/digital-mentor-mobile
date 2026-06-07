import { getCaseById, RatingStat, SpectralShade } from '@/data/cases';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    ImageBackground,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Polygon, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_WIDTH = SCREEN_WIDTH - 40;
const MEDIA_WIDTH = CONTENT_WIDTH;

/* ---------------- Media carousel ---------------- */
const MediaCarousel = ({ media }: { media: { uri: string; stage: string }[] }) => {
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
        renderItem={({ item }) => (
          <View style={{ width: MEDIA_WIDTH }}>
            <Image source={{ uri: item.uri }} style={styles.mediaImage} />
            <View style={styles.stageBadge}>
              <Text style={styles.stageBadgeText}>{item.stage}</Text>
            </View>
          </View>
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

/* ---------------- Spectral analysis VITA ---------------- */
const SHADE_COLORS: Record<string, string> = {
  A1: '#f4e6c8',
  A2: '#ecd6a6',
  'A3': '#e2c485',
  'A3.5': '#d4b06a',
  B1: '#f0e4bf',
  B2: '#e6d29a',
  C2: '#cdbf9a',
};

const SpectralBlock = ({ data }: { data: SpectralShade[] }) => (
  <View style={styles.spectralWrap}>
    <View style={styles.spectralHeader}>
      <Ionicons name="color-filter-outline" size={18} color="#4fc3f7" />
      <Text style={styles.spectralTitle}>Спектральный анализ VITA</Text>
      <View style={styles.aiTag}>
        <Text style={styles.aiTagText}>AI</Text>
      </View>
    </View>
    <View style={styles.spectralRow}>
      {data.map((z) => (
        <View key={z.zone} style={styles.spectralBlock}>
          <Text style={styles.spectralZone}>{z.zone}</Text>
          <View style={styles.spectralBarTrack}>
            <LinearGradient
              colors={[SHADE_COLORS[z.shade] || '#f2ca50', '#8B6914']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[styles.spectralBarFill, { height: `${z.value}%` }]}
            />
          </View>
          <View
            style={[
              styles.spectralSwatch,
              { backgroundColor: SHADE_COLORS[z.shade] || '#f2ca50' },
            ]}
          />
          <Text style={styles.spectralShade}>{z.shade}</Text>
        </View>
      ))}
    </View>
  </View>
);

/* ---------------- Expert voting (crystals) ---------------- */
const recompute = (base: RatingStat, userVote: number | null): number => {
  if (userVote == null) return base.avg;
  return (base.avg * base.count + userVote) / (base.count + 1);
};

const CrystalRow = ({
  label,
  base,
  vote,
  onVote,
}: {
  label: string;
  base: RatingStat;
  vote: number | null;
  onVote: (v: number) => void;
}) => {
  const avg = recompute(base, vote);
  return (
    <View style={styles.crystalRow}>
      <View style={styles.crystalLabelRow}>
        <Text style={styles.crystalLabel}>{label}</Text>
        <Text style={styles.crystalAvg}>{avg.toFixed(1)} 💎</Text>
      </View>
      <View style={styles.crystalsLine}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = vote != null && n <= vote;
          return (
            <TouchableOpacity
              key={n}
              activeOpacity={0.7}
              style={styles.crystalBtn}
              onPress={() => onVote(n)}
            >
              <Ionicons
                name="diamond"
                size={26}
                color={active ? '#4fc3f7' : 'rgba(255,255,255,0.18)'}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      {vote != null && (
        <Text style={styles.crystalVoted}>Ваш голос: {vote} 💎</Text>
      )}
    </View>
  );
};

/* ---------------- Riddle hex button ---------------- */
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
  const W = (CONTENT_WIDTH - 24 - 24) / 2; // 2 per row, gaps
  const H = 92;
  const stroke = revealed && correct ? '#7CFC8A' : selected ? '#4fc3f7' : '#f2ca50';
  return (
    <TouchableOpacity activeOpacity={0.85} style={{ width: W, height: H }} onPress={onPress} disabled={revealed}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="hexBtnBody" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#1c2536" />
            <Stop offset="100%" stopColor="#0a0f1a" />
          </SvgLinearGradient>
        </Defs>
        <Polygon
          points={`${W * 0.25},4 ${W * 0.75},4 ${W - 4},${H / 2} ${W * 0.75},${H - 4} ${W * 0.25},${H - 4} 4,${H / 2}`}
          fill="url(#hexBtnBody)"
          stroke={stroke}
          strokeWidth={2}
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
}: {
  riddle: NonNullable<ReturnType<typeof getCaseById>>['riddle'];
}) => {
  const [picked, setPicked] = useState<string | null>(null);
  if (!riddle) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name="help-circle-outline" size={20} color="#f2ca50" />
        <Text style={styles.sectionTitle}>Кейс-загадка</Text>
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
            onPress={() => setPicked(opt.label)}
          />
        ))}
      </View>
      {picked != null && (
        <Text style={styles.riddleResult}>
          {picked === riddle.correct
            ? `Верно! Большинство коллег выбрали ${riddle.correct}.`
            : `Правильный ответ — ${riddle.correct}. Вы выбрали ${picked}.`}
        </Text>
      )}
    </View>
  );
};

/* ---------------- Screen ---------------- */
export default function CaseDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useMemo(() => getCaseById(id), [id]);

  const [aesthetics, setAesthetics] = useState<number | null>(null);
  const [occlusion, setOcclusion] = useState<number | null>(null);
  const [anatomy, setAnatomy] = useState<number | null>(null);

  if (!item) {
    return (
      <ImageBackground
        source={require('@/assets/images/background.png')}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={28} color="#f2ca50" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Кейс не найден</Text>
          </View>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={{ flex: 1, backgroundColor: 'transparent' }}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#f2ca50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Детали кейса</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Author */}
          <View style={styles.authorBlock}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName}>{item.author}</Text>
              <View style={[styles.roleBadge, item.role === 'Техник' && styles.roleBadgeTech]}>
                <Text style={[styles.roleBadgeText, item.role === 'Техник' && styles.roleBadgeTextTech]}>
                  {item.role}
                </Text>
              </View>
            </View>
          </View>

          {/* Media */}
          <MediaCarousel media={item.media} />

          {/* Tags */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsRow}>
            {item.tags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Full description */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="document-text-outline" size={20} color="#f2ca50" />
              <Text style={styles.sectionTitle}>Клиническая ситуация</Text>
            </View>
            <Text style={styles.fullDescription}>{item.fullDescription}</Text>
          </View>

          {/* Spectral analysis */}
          <View style={styles.section}>
            <SpectralBlock data={item.spectral} />
          </View>

          {/* Expert voting */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="ribbon-outline" size={20} color="#f2ca50" />
              <Text style={styles.sectionTitle}>Экспертное голосование</Text>
            </View>
            <CrystalRow label="Эстетика" base={item.votes.aesthetics} vote={aesthetics} onVote={setAesthetics} />
            <CrystalRow label="Функция / Окклюзия" base={item.votes.occlusion} vote={occlusion} onVote={setOcclusion} />
            <CrystalRow label="Анатомия / Морфология" base={item.votes.anatomy} vote={anatomy} onVote={setAnatomy} />
          </View>

          {/* Riddle */}
          {item.riddle && <RiddleBlock riddle={item.riddle} />}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
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
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 60 },

  authorBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(242, 202, 80, 0.6)',
    backgroundColor: '#1a2030',
  },
  authorName: { fontSize: 16, fontWeight: '600', color: '#ffffff', marginBottom: 4 },
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

  /* Spectral */
  spectralWrap: {},
  spectralHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  spectralTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#4fc3f7' },
  aiTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(79, 195, 247, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(79, 195, 247, 0.5)',
  },
  aiTagText: { fontSize: 10, fontWeight: '900', color: '#4fc3f7', letterSpacing: 1 },
  spectralRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  spectralBlock: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(10, 15, 26, 0.6)',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  spectralZone: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 10, textTransform: 'uppercase' },
  spectralBarTrack: {
    width: 16,
    height: 90,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 10,
  },
  spectralBarFill: { width: '100%', borderRadius: 8 },
  spectralSwatch: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 6,
  },
  spectralShade: { fontSize: 14, fontWeight: '800', color: '#f2ca50' },

  /* Crystals */
  crystalRow: { marginBottom: 18 },
  crystalLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  crystalLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  crystalAvg: { fontSize: 14, fontWeight: '800', color: '#4fc3f7' },
  crystalsLine: { flexDirection: 'row', gap: 8 },
  crystalBtn: { padding: 2 },
  crystalVoted: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 6 },

  /* Riddle */
  riddleQuestion: { fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.85)', marginBottom: 16 },
  hexGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between' },
  hexContent: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 2 },
  hexLabel: { fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  hexPercent: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  riddleResult: { fontSize: 13, fontWeight: '600', color: '#7CFC8A', marginTop: 16, textAlign: 'center' },
});
