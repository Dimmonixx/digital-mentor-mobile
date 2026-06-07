import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  ImageBackground,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Polygon, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_WIDTH = SCREEN_WIDTH - 40;

const AVAILABLE_TAGS = [
  '#Виниры',
  '#Имплантация',
  '#Цирконий',
  '#Мост',
  '#Окклюзия',
  '#Реставрация',
  '#ISO_21',
  '#ISO_14',
  '#ISO_11',
];

const MEDIA_SLOTS = ['До', 'В процессе', 'После'];

const VITA_SHADES = ['A1', 'A2', 'A3', 'A3.5', 'B1', 'B2', 'C2', 'D3'];

/* Hexagonal tag chip */
const HexTag = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => {
  const W = Math.max(96, label.length * 9 + 44);
  const H = 44;
  const stroke = active ? '#4fc3f7' : 'rgba(242, 202, 80, 0.5)';
  return (
    <TouchableOpacity activeOpacity={0.85} style={{ width: W, height: H, marginRight: 10 }} onPress={onPress}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="hexTagBody" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={active ? '#16314a' : '#1c2536'} />
            <Stop offset="100%" stopColor="#0a0f1a" />
          </SvgLinearGradient>
        </Defs>
        <Polygon
          points={`14,3 ${W - 14},3 ${W - 3},${H / 2} ${W - 14},${H - 3} 14,${H - 3} 3,${H / 2}`}
          fill="url(#hexTagBody)"
          stroke={stroke}
          strokeWidth={1.5}
        />
      </Svg>
      <View style={styles.hexTagContent}>
        {active && <Ionicons name="checkmark" size={14} color="#4fc3f7" />}
        <Text style={[styles.hexTagText, { color: active ? '#4fc3f7' : '#f2ca50' }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default function CreateCaseScreen() {
  const insets = useSafeAreaInsets();
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isRiddle, setIsRiddle] = useState(false);
  const [riddleAnswer, setRiddleAnswer] = useState<string | null>(null);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handlePublish = () => {
    Alert.alert(
      'Кейс отправлен',
      'Кейс успешно отправлен на модерацию. Вам начислено +10 💎 за вклад в сообщество!',
      [{ text: 'Отлично', onPress: () => router.back() }]
    );
    (globalThis as any).spendDiamonds?.(-10);
    (globalThis as any).forceDiamondUpdate?.();
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

          {/* Tags */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="pricetags-outline" size={20} color="#f2ca50" />
              <Text style={styles.sectionTitle}>Категории</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsScroll}>
              {AVAILABLE_TAGS.map((tag) => (
                <HexTag
                  key={tag}
                  label={tag}
                  active={selectedTags.includes(tag)}
                  onPress={() => toggleTag(tag)}
                />
              ))}
            </ScrollView>
          </View>

          {/* Media upload */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="images-outline" size={20} color="#f2ca50" />
              <Text style={styles.sectionTitle}>Фото</Text>
            </View>
            <View style={styles.mediaRow}>
              {MEDIA_SLOTS.map((slot) => (
                <TouchableOpacity key={slot} activeOpacity={0.8} style={styles.mediaSlot}>
                  <Ionicons name="camera-outline" size={30} color="#f2ca50" />
                  <Text style={styles.mediaSlotText}>{slot}</Text>
                </TouchableOpacity>
              ))}
            </View>
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

          {/* Publish button */}
          <TouchableOpacity activeOpacity={0.85} style={styles.publishButton} onPress={handlePublish}>
            <Svg width={CONTENT_WIDTH} height={68} viewBox={`0 0 ${CONTENT_WIDTH} 68`} style={StyleSheet.absoluteFill}>
              <Defs>
                <SvgLinearGradient id="publishBody" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#ffe680" />
                  <Stop offset="50%" stopColor="#f2ca50" />
                  <Stop offset="100%" stopColor="#c79a2e" />
                </SvgLinearGradient>
              </Defs>
              <Polygon
                points={`24,6 ${CONTENT_WIDTH - 24},6 ${CONTENT_WIDTH - 48},62 48,62`}
                fill="url(#publishBody)"
                stroke="#fff3c4"
                strokeWidth={1.5}
              />
            </Svg>
            <View style={styles.publishContent}>
              <Ionicons name="cloud-upload-outline" size={22} color="#1a1206" />
              <Text style={styles.publishText}>Опубликовать кейс</Text>
            </View>
          </TouchableOpacity>

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
  headerTitle: { flex: 1, fontSize: 26, fontWeight: '700', color: '#ffffff', letterSpacing: 0.5 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

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

  tagsScroll: { paddingVertical: 4, alignItems: 'center' },
  hexTagContent: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  hexTagText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },

  mediaRow: { flexDirection: 'row', gap: 12 },
  mediaSlot: {
    flex: 1,
    height: 100,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(242, 202, 80, 0.5)',
    backgroundColor: 'rgba(242, 202, 80, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mediaSlotText: { fontSize: 12, fontWeight: '600', color: '#f2ca50', textTransform: 'uppercase' },

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

  publishButton: {
    width: CONTENT_WIDTH,
    height: 68,
    marginTop: 8,
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
});
