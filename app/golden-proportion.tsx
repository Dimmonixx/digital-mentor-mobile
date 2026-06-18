import BottomTabBar from '@/components/BottomTabBar';
import { saveToArchive } from '@/utils/saveToArchive';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Animated,
    GestureResponderEvent,
    Image,
    ImageBackground,
    Modal,
    PanResponder,
    PanResponderGestureState,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type MethodType = 'golden' | 'red' | 'preston';

const METHODS: { key: MethodType; label: string; icon: any; hint: string }[] = [
  {
    key: 'golden',
    label: 'Golden Proportion',
    icon: 'sparkles-outline',
    hint: 'Ширина зубов визуально уменьшается от центра к краям на 61.8%. Классический жёсткий стандарт.',
  },
  {
    key: 'red',
    label: 'RED Proportion',
    icon: 'swap-horizontal-outline',
    hint: 'Соотношение ширины соседних зубов остаётся неизменным вдоль всего ряда. Зубы выглядят крупнее.',
  },
  {
    key: 'preston',
    label: 'Preston Ratio',
    icon: 'person-outline',
    hint: 'Расчёт базируется на индивидуальных физических пропорциях пациента без жёстких констант.',
  },
];

const EXTRA_HINTS: Record<string, string> = {
  zenith: 'Оценка симметрии высших точек десневого контура левой и правой стороны.',
  heightWidth: 'Контроль пропорции высоты зуба к его ширине. Золотой стандарт для центральных резцов — ~80%.',
};

const getDeviationColor = (pct: number) =>
  Math.abs(pct) <= 3 ? '#4caf50' : '#f2ca50';

const getDeviationLabel = (pct: number, diffMm: number) => {
  if (Math.abs(pct) <= 3) return 'В пределах нормы';
  const dir = pct > 0 ? 'Шире нормы' : 'Уже нормы';
  return `${dir} на ${Math.abs(diffMm).toFixed(1)} мм`;
};

const MOCK_RESULTS = [
  { label: 'Центральные резцы', factMm: 8.4, deviationPct: 1,  diffMm:  0.1 },
  { label: 'Боковые резцы',    factMm: 5.4, deviationPct: 5,  diffMm:  0.2 },
  { label: 'Клыки',            factMm: 3.1, deviationPct: -2, diffMm: -0.1 },
];

export default function GoldenProportionScreen() {
  const insets = useSafeAreaInsets();
  const [photo, setPhoto] = useState<string | null>(null);
  const [method, setMethod] = useState<MethodType>('golden');
  const [gridOpacity, setGridOpacity] = useState(0.6);
  const [zenithAnalysis, setZenithAnalysis] = useState(false);
  const [heightWidthAnalysis, setHeightWidthAnalysis] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [bigGuides, setBigGuides] = useState(false);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [aiAligning, setAiAligning] = useState(false);
  const aiPulse = useRef(new Animated.Value(1)).current;
  const rotAnim = useRef(new Animated.Value(0)).current;
  const [openMethodHint, setOpenMethodHint] = useState<MethodType | null>(null);
  const [openExtraHint, setOpenExtraHint] = useState<string | null>(null);

  // Позиции подвижных линий (0..1 от ширины/высоты контейнера)
  const vLines = useRef([0.22, 0.35, 0.5, 0.65, 0.78].map(v => new Animated.Value(v))).current;
  const hLines = useRef([0.33, 0.5, 0.67].map(v => new Animated.Value(v))).current;
  // Сохранённые "сырые" значения для вычисления дельты
  const vLinesRaw = useRef([0.22, 0.35, 0.5, 0.65, 0.78]);
  const hLinesRaw = useRef([0.33, 0.5, 0.67]);
  // Размеры контейнера фото
  const photoContainerSize = useRef({ width: 1, height: 1 });

  const makePR = (
    animVal: Animated.Value,
    rawArr: number[],
    idx: number,
    axis: 'x' | 'y',
  ) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => setScrollEnabled(false),
      onPanResponderMove: (_e: GestureResponderEvent, gs: PanResponderGestureState) => {
        const size = axis === 'x'
          ? photoContainerSize.current.width
          : photoContainerSize.current.height;
        const delta = (axis === 'x' ? gs.dx : gs.dy) / size;
        animVal.setValue(Math.min(0.98, Math.max(0.02, rawArr[idx] + delta)));
      },
      onPanResponderRelease: (_e: GestureResponderEvent, gs: PanResponderGestureState) => {
        const size = axis === 'x'
          ? photoContainerSize.current.width
          : photoContainerSize.current.height;
        const delta = (axis === 'x' ? gs.dx : gs.dy) / size;
        rawArr[idx] = Math.min(0.98, Math.max(0.02, rawArr[idx] + delta));
        setScrollEnabled(true);
      },
      onPanResponderTerminate: () => setScrollEnabled(true),
    });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const vPRs = useRef(vLines.map((av, i) => makePR(av, vLinesRaw.current, i, 'x'))).current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hPRs = useRef(hLines.map((av, i) => makePR(av, hLinesRaw.current, i, 'y'))).current;

  const DEFAULT_V_POS = [0.22, 0.35, 0.5, 0.65, 0.78];
  const DEFAULT_H_POS = [0.33, 0.5, 0.67];

  const resetLines = () => {
    DEFAULT_V_POS.forEach((pos, i) => {
      vLinesRaw.current[i] = pos;
      vLines[i].setValue(pos);
    });
    DEFAULT_H_POS.forEach((pos, i) => {
      hLinesRaw.current[i] = pos;
      hLines[i].setValue(pos);
    });
  };

  const runAutoAlign = () => {
    if (aiAligning) return;
    setAiAligning(true);
    // Пульсирующая анимация кнопки
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(aiPulse, { toValue: 1.12, duration: 400, useNativeDriver: true }),
        Animated.timing(aiPulse, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    // Симуляция ИИ-анализа: через 1.6с плавно корректируем угол
    // к оптимальному значению (+4°). Не сбрасываем ручную настройку в 0.
    // TODO: в продакшене — запрос к Claude API, ответ: { rotation_angle: number }
    setTimeout(() => {
      const targetAngle = 4; // оптимальный угол по ИИ-анализу зрачковой линии
      rotAnim.setValue(rotationDeg); // стартуем с текущего положения
      Animated.timing(rotAnim, {
        toValue: targetAngle,
        duration: 700,
        useNativeDriver: false,
      }).start();
      rotAnim.addListener(({ value }) => setRotationDeg(Math.round(value)));
      setTimeout(() => {
        setRotationDeg(targetAngle);
        rotAnim.removeAllListeners();
        pulse.stop();
        aiPulse.setValue(1);
        setAiAligning(false);
      }, 750);
    }, 1600);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
      setShowResults(false);
      setRotationDeg(0);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
      setShowResults(false);
      setRotationDeg(0);
    }
  };

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.container, { paddingTop: insets.top }]}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color="#f2ca50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Золотое сечение</Text>
          <TouchableOpacity
            style={styles.infoBtn}
            onPress={() => setInfoVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="information-circle-outline" size={26} color="#f2ca50" />
          </TouchableOpacity>
        </View>

        {/* ── Модалка: О методе ── */}
        <Modal visible={infoVisible} transparent animationType="fade" onRequestClose={() => setInfoVisible(false)}>
          <View style={styles.infoOverlay}>
            <View style={styles.infoModal}>
              <View style={styles.infoModalHeader}>
                <Ionicons name="git-network-outline" size={28} color="#f2ca50" />
                <Text style={styles.infoModalTitle}>О методе Золотого сечения</Text>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.infoModalText}>
                  {'Функция анализирует гармонию улыбки по фотографии в анфас. За основу берётся видимая ширина зубов.\n\nИдеальные пропорции:\n  • Центральный резец — 1.618\n  • Боковой резец — 1.000\n  • Клык — 0.618'}
                </Text>

                <Text style={styles.infoSectionTitle}>Методики расчёта</Text>
                <View style={styles.infoUsageBlock}>
                  <Text style={styles.infoUsageLabel}>Golden Proportion</Text>
                  <Text style={styles.infoUsageText}>
                    Классическое жёсткое геометрическое уменьшение зубов от центра к краям на 61.8%. Центральный резец берётся за единицу, каждый следующий зуб уже предыдущего ровно в 1.618 раза.
                  </Text>
                </View>
                <View style={styles.infoUsageBlock}>
                  <Text style={styles.infoUsageLabel}>RED Proportion</Text>
                  <Text style={styles.infoUsageText}>
                    Соотношение ширины соседних зубов остаётся постоянным на протяжении всего зубного ряда. Позволяет подбирать пропорции индивидуально под ширину улыбки.
                  </Text>
                </View>
                <View style={styles.infoUsageBlock}>
                  <Text style={styles.infoUsageLabel}>Preston Ratio</Text>
                  <Text style={styles.infoUsageText}>
                    Расчёт основан на индивидуальных физиологических пропорциях пациента. Учитывает реальные размеры лица и менее жёсток, чем Golden Proportion.
                  </Text>
                </View>

                <Text style={styles.infoSectionTitle}>Доп. параметры анализа</Text>
                <View style={styles.infoUsageBlock}>
                  <Text style={styles.infoUsageLabel}>Анализ зенитов десны</Text>
                  <Text style={styles.infoUsageText}>
                    Оценка симметрии высших точек десневого контура (зенитов) левой и правой стороны. Асимметрия зенитов более 0.5 мм визуально заметна и влияет на эстетику улыбки.
                  </Text>
                </View>
                <View style={styles.infoUsageBlock}>
                  <Text style={styles.infoUsageLabel}>Соотношение В/Ш (80%)</Text>
                  <Text style={styles.infoUsageText}>
                    Контроль пропорции высоты зуба к его ширине. Идеальным считается соотношение около 80%: зуб шириной 10 мм должен иметь высоту 8 мм.
                  </Text>
                </View>

                <View style={styles.infoUsageBlock}>
                  <View style={styles.infoUsageRow}>
                    <Ionicons name="medkit-outline" size={16} color="#f2ca50" />
                    <Text style={styles.infoUsageLabel}>Врачу</Text>
                  </View>
                  <Text style={styles.infoUsageText}>
                    Планирование виниров и демонстрация пациенту желаемого результата до начала лечения.
                  </Text>
                </View>
                <View style={styles.infoUsageBlock}>
                  <View style={styles.infoUsageRow}>
                    <Ionicons name="construct-outline" size={16} color="#f2ca50" />
                    <Text style={styles.infoUsageLabel}>Технику</Text>
                  </View>
                  <Text style={styles.infoUsageText}>
                    Контроль симметрии и моделирование реставраций согласно эстетическим нормам.
                  </Text>
                </View>
                <View style={styles.infoDisclaimerBlock}>
                  <Ionicons name="alert-circle-outline" size={14} color="rgba(255,255,255,0.3)" />
                  <Text style={styles.infoDisclaimerText}>
                    Данные носят ориентировочный характер. Финальная клиническая оценка остаётся за специалистом.
                  </Text>
                </View>
              </ScrollView>
              <TouchableOpacity style={styles.infoCloseBtn} onPress={() => setInfoVisible(false)}>
                <Text style={styles.infoCloseBtnText}>Понятно</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <ScrollView
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* ── ШАГ 1: Загрузка фото ── */}
          <View style={styles.section}>
            <Text style={styles.stepLabel}>Шаг 1 — Загрузите фото улыбки</Text>
            {!photo ? (
              <View style={styles.uploadArea}>
                <Ionicons name="image-outline" size={48} color="rgba(242,202,80,0.4)" />
                <Text style={styles.uploadHint}>Фото улыбки пациента</Text>
                <View style={styles.uploadBtns}>
                  <TouchableOpacity style={styles.uploadBtn} onPress={pickImage} activeOpacity={0.8}>
                    <Ionicons name="images-outline" size={20} color="#031427" />
                    <Text style={styles.uploadBtnText}>Галерея</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.uploadBtn, styles.uploadBtnOutline]} onPress={takePhoto} activeOpacity={0.8}>
                    <Ionicons name="camera-outline" size={20} color="#f2ca50" />
                    <Text style={[styles.uploadBtnText, { color: '#f2ca50' }]}>Камера</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View
                style={styles.photoWrap}
                onLayout={e => {
                  const { width, height } = e.nativeEvent.layout;
                  photoContainerSize.current = { width, height };
                }}
              >
                <Image
                  source={{ uri: photo }}
                  style={[styles.photo, { transform: [{ rotate: `${rotationDeg}deg` }] }]}
                  resizeMode="contain"
                />
                {/* Подвижные направляющие */}
                <View style={[styles.gridOverlay, { opacity: gridOpacity }]}>
                  {/* Вертикальные линии */}
                  {vLines.map((animVal, i) => (
                    <Animated.View
                      key={`v${i}`}
                      style={[
                        styles.dragLineV,
                        { left: animVal.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                      ]}
                      {...vPRs[i].panHandlers}
                    >
                      <View style={styles.dragLineVInner} />
                    </Animated.View>
                  ))}
                  {/* Горизонтальные линии */}
                  {hLines.map((animVal, i) => (
                    <Animated.View
                      key={`h${i}`}
                      style={[
                        styles.dragLineH,
                        { top: animVal.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                      ]}
                      {...hPRs[i].panHandlers}
                    >
                      <View style={styles.dragLineHInner} />
                    </Animated.View>
                  ))}
                  <View style={styles.gridCenter} />
                  {/* Большие осевые линии */}
                  {bigGuides && (
                    <>
                      <View style={styles.bigGuideV} />
                      <View style={styles.bigGuideH} />
                    </>
                  )}
                </View>
                <TouchableOpacity style={styles.photoChangeHint} onPress={pickImage} activeOpacity={0.8}>
                  <Text style={styles.photoChangeText}>Нажмите, чтобы сменить фото</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── ШАГ 2–3: Прозрачность сетки (только если есть фото) ── */}
          {photo && (
            <View style={styles.section}>
              <Text style={styles.stepLabel}>Шаг 2 — Сетка и поворот</Text>

              {/* Ползунок прозрачности сетки */}
              <Text style={styles.sliderLabel}>Прозрачность сетки</Text>
              <View style={styles.sliderRow}>
                <Ionicons name="grid-outline" size={18} color="rgba(242,202,80,0.6)" />
                <View style={styles.sliderTrack}>
                  <View style={[styles.sliderFill, { width: `${gridOpacity * 100}%` }]} />
                </View>
                <Text style={styles.sliderValue}>{Math.round(gridOpacity * 100)}%</Text>
              </View>
              <View style={styles.opacityBtns}>
                {[0.2, 0.5, 0.8, 1.0].map(val => (
                  <TouchableOpacity
                    key={val}
                    style={[styles.opacityBtn, Math.abs(gridOpacity - val) < 0.05 && styles.opacityBtnActive]}
                    onPress={() => setGridOpacity(val)}
                  >
                    <Text style={[styles.opacityBtnText, Math.abs(gridOpacity - val) < 0.05 && styles.opacityBtnTextActive]}>
                      {Math.round(val * 100)}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Поворот горизонта */}
              <Text style={[styles.sliderLabel, { marginTop: 12 }]}>
                Поворот горизонта: {rotationDeg > 0 ? '+' : ''}{rotationDeg}°
              </Text>
              <View style={[styles.sliderRow, { marginTop: 4 }]}>
                <Ionicons name="sync-outline" size={18} color="rgba(242,202,80,0.6)" />
                <View style={styles.sliderTrack}>
                  <View style={[styles.sliderFill, { width: `${((rotationDeg + 15) / 30) * 100}%` }]} />
                </View>
                <View style={styles.rotationBtns}>
                  <TouchableOpacity style={styles.rotBtn} onPress={() => setRotationDeg(v => Math.max(-15, v - 1))}>
                    <Ionicons name="remove" size={14} color="#f2ca50" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rotBtn} onPress={() => setRotationDeg(0)}>
                    <Text style={styles.rotBtnText}>0°</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rotBtn} onPress={() => setRotationDeg(v => Math.min(15, v + 1))}>
                    <Ionicons name="add" size={14} color="#f2ca50" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Кнопка ИИ-выравнивания — отдельная строка */}
              <Animated.View style={[styles.aiAlignRow, { transform: [{ scale: aiPulse }] }]}>
                <TouchableOpacity
                  style={[styles.aiAlignBtn, aiAligning && styles.aiAlignBtnActive]}
                  onPress={runAutoAlign}
                  activeOpacity={0.8}
                  disabled={aiAligning}
                >
                  <Ionicons
                    name={aiAligning ? 'hourglass-outline' : 'sparkles-outline'}
                    size={14}
                    color={aiAligning ? 'rgba(242,202,80,0.5)' : 'rgba(242,202,80,0.7)'}
                  />
                  <Text style={[styles.aiAlignBtnText, aiAligning && { opacity: 0.6 }]}>
                    {aiAligning ? 'ИИ анализирует горизонт улыбки...' : 'ИИ-выравнивание горизонта'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              {/* Сброс линий */}
              <TouchableOpacity style={styles.resetLinesBtn} onPress={resetLines} activeOpacity={0.8}>
                <Ionicons name="refresh-outline" size={14} color="rgba(242,202,80,0.7)" />
                <Text style={styles.resetLinesBtnText}>Сбросить направляющие</Text>
              </TouchableOpacity>

              {/* Тумблер больших направляющих */}
              <View style={[styles.toggleRow, { marginTop: 8, borderBottomWidth: 0 }]}>
                <View style={styles.toggleInfo}>
                  <Ionicons name="scan-outline" size={18} color="#f2ca50" />
                  <Text style={styles.toggleLabel}>Осевые линии (макро)</Text>
                </View>
                <Switch
                  value={bigGuides}
                  onValueChange={setBigGuides}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(242,202,80,0.4)' }}
                  thumbColor={bigGuides ? '#f2ca50' : 'rgba(255,255,255,0.4)'}
                />
              </View>
            </View>
          )}

          {/* ── МЕТОДИКА ── */}
          <View style={styles.section}>
            <Text style={styles.stepLabel}>Методика расчёта</Text>
            {METHODS.map(m => (
              <View key={m.key}>
                <View style={styles.methodItemRow}>
                  <TouchableOpacity
                    style={[styles.methodBtn, method === m.key && styles.methodBtnActive]}
                    onPress={() => setMethod(m.key)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={m.icon}
                      size={14}
                      color={method === m.key ? '#031427' : 'rgba(242,202,80,0.7)'}
                    />
                    <Text style={[styles.methodBtnText, method === m.key && styles.methodBtnTextActive]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.hintBtn}
                    onPress={() => setOpenMethodHint(openMethodHint === m.key ? null : m.key)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={openMethodHint === m.key ? 'close-circle-outline' : 'information-circle-outline'}
                      size={17}
                      color={openMethodHint === m.key ? '#f2ca50' : 'rgba(255,255,255,0.35)'}
                    />
                  </TouchableOpacity>
                </View>
                {openMethodHint === m.key && (
                  <View style={styles.hintBox}>
                    <Text style={styles.hintText}>{m.hint}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* ── ДОПОЛНИТЕЛЬНЫЙ АНАЛИЗ ── */}
          <View style={styles.section}>
            <Text style={styles.stepLabel}>Дополнительный анализ</Text>

            {/* Зениты */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="analytics-outline" size={18} color="#f2ca50" />
                <Text style={styles.toggleLabel}>Анализ зенитов десны</Text>
                <TouchableOpacity
                  onPress={() => setOpenExtraHint(openExtraHint === 'zenith' ? null : 'zenith')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={openExtraHint === 'zenith' ? 'close-circle-outline' : 'information-circle-outline'}
                    size={16}
                    color={openExtraHint === 'zenith' ? '#f2ca50' : 'rgba(255,255,255,0.35)'}
                  />
                </TouchableOpacity>
              </View>
              <Switch
                value={zenithAnalysis}
                onValueChange={setZenithAnalysis}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(242,202,80,0.4)' }}
                thumbColor={zenithAnalysis ? '#f2ca50' : 'rgba(255,255,255,0.4)'}
              />
            </View>
            {openExtraHint === 'zenith' && (
              <View style={styles.hintBox}>
                <Text style={styles.hintText}>{EXTRA_HINTS.zenith}</Text>
              </View>
            )}

            {/* В/Ш */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="resize-outline" size={18} color="#f2ca50" />
                <Text style={styles.toggleLabel}>Соотношение В/Ш (80%)</Text>
                <TouchableOpacity
                  onPress={() => setOpenExtraHint(openExtraHint === 'heightWidth' ? null : 'heightWidth')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={openExtraHint === 'heightWidth' ? 'close-circle-outline' : 'information-circle-outline'}
                    size={16}
                    color={openExtraHint === 'heightWidth' ? '#f2ca50' : 'rgba(255,255,255,0.35)'}
                  />
                </TouchableOpacity>
              </View>
              <Switch
                value={heightWidthAnalysis}
                onValueChange={setHeightWidthAnalysis}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(242,202,80,0.4)' }}
                thumbColor={heightWidthAnalysis ? '#f2ca50' : 'rgba(255,255,255,0.4)'}
              />
            </View>
            {openExtraHint === 'heightWidth' && (
              <View style={styles.hintBox}>
                <Text style={styles.hintText}>{EXTRA_HINTS.heightWidth}</Text>
              </View>
            )}
          </View>

          {/* ── КНОПКА АНАЛИЗА ── */}
          {photo && (
            <TouchableOpacity
              style={styles.analyzeBtn}
              onPress={async () => {
                setShowResults(true);
                saveToArchive(
                  'golden_proportion',
                  'Анализ пропорций',
                  {
                    imageUri: photo,
                    angle: rotationDeg,
                    linesCoordinates: {
                      vertical: vLinesRaw.current.slice(),
                      horizontal: hLinesRaw.current.slice(),
                    },
                    method,
                    calculations: Object.fromEntries(
                      MOCK_RESULTS.map(r => [
                        r.label,
                        { factMm: r.factMm, deviationPct: r.deviationPct, diffMm: r.diffMm },
                      ])
                    ),
                  },
                );
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="git-network-outline" size={22} color="#031427" />
              <Text style={styles.analyzeBtnText}>Рассчитать пропорции</Text>
            </TouchableOpacity>
          )}

          {/* ── ШАГ 4–5: РЕЗУЛЬТАТЫ ── */}
          {showResults && (
            <View style={styles.section}>
              <View style={styles.resultsHeader}>
                <Text style={styles.stepLabel}>Результаты анализа</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.methodActiveBadge}>
                    <Text style={styles.methodActiveBadgeText}>
                      {METHODS.find(m => m.key === method)?.label}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.shareResultBtn}
                    onPress={() => router.push('/global-archive?tab=golden_proportion' as any)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="share-social-outline" size={15} color="#f2ca50" />
                    <Text style={styles.shareResultBtnText}>Поделиться</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {MOCK_RESULTS.map((r, i) => {
                const color = getDeviationColor(r.deviationPct);
                const sign = r.deviationPct > 0 ? '+' : '';
                const hint = getDeviationLabel(r.deviationPct, r.diffMm);
                return (
                  <View key={i} style={styles.resultCard}>
                    <View style={styles.resultCardTop}>
                      <View style={[styles.resultDot, { backgroundColor: color }]} />
                      <Text style={styles.resultLabel}>{r.label}</Text>
                      <Text style={[styles.resultDeviationBig, { color }]}>
                        {sign}{r.deviationPct}%
                      </Text>
                    </View>
                    <Text style={styles.resultDetail}>
                      {'Факт: '}{r.factMm}{' мм  ·  '}
                      <Text style={{ color }}>{hint}</Text>
                    </Text>
                  </View>
                );
              })}
              {zenithAnalysis && (
                <View style={styles.extraResult}>
                  <Ionicons name="analytics-outline" size={16} color="#f2ca50" />
                  <Text style={styles.extraResultText}>
                    Зениты десны: Лев. +0.4 мм / Прав. −0.2 мм
                  </Text>
                </View>
              )}
              {heightWidthAnalysis && (
                <View style={styles.extraResult}>
                  <Ionicons name="resize-outline" size={16} color="#f2ca50" />
                  <Text style={styles.extraResultText}>
                    В/Ш центр. резец: 82% (норма 78–82%)
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── ПРЕВЬЮ В РЕЗУЛЬТАТАХ ── */}
          {showResults && photo && (
            <View style={styles.resultPhotoWrap}>
              <Image
                source={{ uri: photo }}
                style={[styles.resultPhoto, { transform: [{ rotate: `${rotationDeg}deg` }] }]}
                resizeMode="contain"
              />
              <View style={[styles.gridOverlay, { opacity: 0.5 }]} pointerEvents="none">
                {[0.22, 0.35, 0.5, 0.65, 0.78].map((pos, i) => (
                  <View key={`rv${i}`} style={[styles.gridLineV, { left: `${pos * 100}%` }]} />
                ))}
                {[0.5].map((pos, i) => (
                  <View key={`rh${i}`} style={[styles.gridLineH, { top: `${pos * 100}%` }]} />
                ))}
                <View style={styles.gridCenter} />
              </View>
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      </View>

      <BottomTabBar />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(242,202,80,0.15)',
    backgroundColor: 'rgba(8,13,26,0.6)',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#f2ca50',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    backgroundColor: 'rgba(8,13,26,0.75)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.15)',
    padding: 16,
    marginBottom: 14,
  },
  stepLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  uploadArea: {
    alignItems: 'center',
    paddingVertical: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(242,202,80,0.2)',
    borderStyle: 'dashed',
    borderRadius: 12,
    gap: 10,
  },
  uploadHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
  },
  uploadBtns: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f2ca50',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  uploadBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(242,202,80,0.5)',
  },
  uploadBtnText: {
    color: '#031427',
    fontSize: 14,
    fontWeight: '700',
  },
  photoWrap: {
    borderRadius: 12,
    backgroundColor: '#0a0f1e',
    aspectRatio: 4 / 3,
    position: 'relative',
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  dragLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 20,
    marginLeft: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragLineVInner: {
    width: 1.5,
    height: '100%',
    backgroundColor: '#f2ca50',
  },
  dragLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 20,
    marginTop: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragLineHInner: {
    height: 1.5,
    width: '100%',
    backgroundColor: '#f2ca50',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#f2ca50',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#f2ca50',
  },
  gridCenter: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1.5,
    backgroundColor: '#fff',
    opacity: 0.6,
  },
  photoChangeHint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 6,
    alignItems: 'center',
  },
  photoChangeText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sliderTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    position: 'relative',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#f2ca50',
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    top: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f2ca50',
    marginLeft: -10,
  },
  sliderValue: {
    color: '#f2ca50',
    fontSize: 13,
    fontWeight: '600',
    width: 36,
    textAlign: 'right',
  },
  opacityBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  opacityBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.25)',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  opacityBtnActive: {
    backgroundColor: 'rgba(242,202,80,0.15)',
    borderColor: '#f2ca50',
  },
  opacityBtnText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  opacityBtnTextActive: {
    color: '#f2ca50',
  },
  methodRow: {
    gap: 8,
  },
  methodItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  hintBtn: {
    padding: 2,
  },
  methodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.2)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  methodBtnActive: {
    backgroundColor: 'rgba(242,202,80,0.12)',
    borderColor: '#f2ca50',
  },
  methodBtnText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
  },
  methodBtnTextActive: {
    color: '#f2ca50',
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggleLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f2ca50',
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 14,
  },
  analyzeBtnText: {
    color: '#031427',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  methodActiveBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(242,202,80,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.3)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  methodActiveBadgeText: {
    color: '#f2ca50',
    fontSize: 12,
    fontWeight: '600',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  resultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  resultDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  resultLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  resultRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  resultRatio: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  resultDeviation: {
    fontSize: 12,
    fontWeight: '600',
  },
  extraResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 10,
    backgroundColor: 'rgba(242,202,80,0.06)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.15)',
  },
  extraResultText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    flex: 1,
  },
  disclaimer: {
    marginTop: 12,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
  },
  disclaimerText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    lineHeight: 16,
  },
  infoBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoModal: {
    backgroundColor: '#0d1525',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.2)',
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  infoModalTitle: {
    color: '#f2ca50',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  infoModalText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  infoUsageBlock: {
    backgroundColor: 'rgba(242,202,80,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.15)',
    padding: 12,
    marginBottom: 10,
  },
  infoUsageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoUsageLabel: {
    color: '#f2ca50',
    fontSize: 13,
    fontWeight: '700',
  },
  infoUsageText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 19,
  },
  infoDisclaimerBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
    marginBottom: 16,
  },
  infoDisclaimerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  infoCloseBtn: {
    backgroundColor: '#f2ca50',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  infoCloseBtnText: {
    color: '#031427',
    fontSize: 15,
    fontWeight: '700',
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  resultCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 5,
  },
  resultCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultDeviationBig: {
    marginLeft: 'auto',
    fontSize: 15,
    fontWeight: '700',
  },
  resultDetail: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    paddingLeft: 18,
  },
  sliderLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  rotationBtns: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
  },
  rotBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242,202,80,0.05)',
  },
  rotBtnText: {
    color: '#f2ca50',
    fontSize: 11,
    fontWeight: '700',
  },
  bigGuideV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 2,
    backgroundColor: '#ffffff',
    opacity: 0.55,
  },
  bigGuideH: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 2,
    backgroundColor: '#ffffff',
    opacity: 0.55,
  },
  infoSectionTitle: {
    color: '#f2ca50',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 8,
  },
  resultPhotoWrap: {
    borderRadius: 16,
    backgroundColor: '#0a0f1e',
    aspectRatio: 4 / 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.2)',
    position: 'relative',
  },
  resultPhoto: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  footerDivider: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(242,202,80,0.2)',
    marginVertical: 6,
  },
  footerText: {
    color: '#f2ca50',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  footerSub: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    letterSpacing: 1,
  },
  rotHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 2,
  },
  aiAlignRow: {
    marginTop: 8,
    marginBottom: 2,
    alignItems: 'flex-end',
  },
  aiAlignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.4)',
    backgroundColor: 'rgba(242,202,80,0.08)',
  },
  aiAlignBtnActive: {
    borderColor: 'rgba(242,202,80,0.15)',
    backgroundColor: 'rgba(242,202,80,0.04)',
  },
  aiAlignBtnText: {
    color: '#f2ca50',
    fontSize: 11,
    fontWeight: '600',
  },
  resetLinesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.2)',
    backgroundColor: 'rgba(242,202,80,0.04)',
  },
  resetLinesBtnText: {
    color: 'rgba(242,202,80,0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  hintBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(242,202,80,0.3)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  hintText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    lineHeight: 18,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shareResultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.35)',
    backgroundColor: 'rgba(242,202,80,0.07)',
  },
  shareResultBtnText: {
    color: '#f2ca50',
    fontSize: 11,
    fontWeight: '600',
  },
});
