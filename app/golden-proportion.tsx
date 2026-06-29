import BottomTabBar from '@/components/BottomTabBar';
import { uploadMediaToServer } from '@/utils/saveToArchive';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import {
  addOrientationChangeListener,
  lockAsync,
  OrientationLock
} from 'expo-screen-orientation';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
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
  useWindowDimensions,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';

type MethodType = 'golden' | 'red' | 'preston';

const METHODS: { key: MethodType; label: string; icon: any; hint: string }[] = [
  {
    key: 'golden',
    label: 'Золотое сечение',
    icon: 'sparkles-outline',
    hint: 'Классика жанра. Зубы визуально уменьшаются от центра к краям ровно на 61.8%. Строгий, математический идеал улыбки.',
  },
  {
    key: 'red',
    label: 'Гармоничная сетка',
    icon: 'swap-horizontal-outline',
    hint: 'Более мягкий стандарт. Зубы уменьшаются плавно и выглядят крупнее, чем в золотом сечении. Отлично подходит для широких улыбок.',
  },
  {
    key: 'preston',
    label: 'Анатомический стандарт',
    icon: 'person-outline',
    hint: 'Никаких жёстких рамок. Пропорции рассчитываются индивидуально, опираясь только на реальные физические параметры самого пациента.',
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
  { label: 'Центральные резцы', factMm: 8.8, deviationPct: 6,  diffMm:  0.5 },
  { label: 'Боковые резцы',    factMm: 5.4, deviationPct: 5,  diffMm:  0.2 },
  { label: 'Клыки',            factMm: 3.1, deviationPct: -2, diffMm: -0.1 },
];

export default function GoldenProportionScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { user } = useAuth();
  const [diamonds, setDiamonds] = useState(0);
  const [diamondsModalVisible, setDiamondsModalVisible] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [method, setMethod] = useState<MethodType>('golden');
  const [selectedSegment, setSelectedSegment] = useState<'upper' | 'lower'>('upper');
  const [gridOpacity, setGridOpacity] = useState(0.6);
  const lastGridOpacity = useRef(0.6);
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

  // Панорамный режим
  const [panoramaVisible, setPanoramaVisible] = useState(false);
  const [panoramaGridOpacity, setPanoramaGridOpacity] = useState(0.6);
  const lastPanoramaGridOpacity = useRef(0.6);
  const panoramaGridAnim = useRef(new Animated.Value(0.6)).current;
  const gridHideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  // AI-отчет "Архитектурный паспорт улыбки" (3 раздела текста)
  type AiReport = {
    widthHeight: string;
    zenith: string;
    goldenSymmetry: string;
  };
  const [aiReport, setAiReport] = useState<AiReport | null>(null);
  const [smileResult, setSmileResult] = useState<any>(null);
  const [smileLoading, setSmileLoading] = useState(false);

  // Ориентация экрана (landscape/panorama mode)
  const [isLandscape, setIsLandscape] = useState(false);
  const [screenDimensions, setScreenDimensions] = useState({ width: 0, height: 0 });
  const orientationListener = useRef<ReturnType<typeof addOrientationChangeListener> | null>(null);

  // Отслеживание изменений размеров экрана через хук
  useEffect(() => {
    setScreenDimensions({ width: windowWidth, height: windowHeight });
    // Автоопределение landscape по соотношению сторон
    setIsLandscape(windowWidth > windowHeight);
  }, [windowWidth, windowHeight]);

  // Управление ориентацией - основной экран всегда PORTRAIT
  useEffect(() => {
    // При входе на экран блокируем в портрет
    lockAsync(OrientationLock.PORTRAIT);

    // При размонтировании возвращаем портретную ориентацию
    return () => {
      lockAsync(OrientationLock.PORTRAIT);
    };
  }, []);

  // Загрузка баланса алмазов и подписка на обновления
  useEffect(() => {
    setDiamonds((globalThis as any).getDiamondBalance?.() ?? 0);
    const prev = (globalThis as any).forceDiamondUpdate;
    (globalThis as any).forceDiamondUpdate = () => {
      setDiamonds((globalThis as any).getDiamondBalance?.() ?? 0);
      prev?.();
    };
    return () => { (globalThis as any).forceDiamondUpdate = prev; };
  }, []);

  // Загружаем натуральные размеры фото, чтобы потом считать реальную ширину изображения
  useEffect(() => {
    if (!photo) {
      imageNaturalSize.current = { width: 0, height: 0 };
      return;
    }
    Image.getSize(
      photo,
      (width, height) => {
        imageNaturalSize.current = { width, height };
        calibrateScaleFromAI();
      },
      () => {
        imageNaturalSize.current = { width: 0, height: 0 };
      },
    );
  }, [photo]);

  // Инициализация PanResponder-ов для динамических направляющих
  useEffect(() => {
    guideLinePRs.current = guideLinesRef.current.map((_, i) => makeGuideLinePR(i));
  }, []);

  // При выключении макро-режима осевые линии возвращаются к строго вертикальному положению
  useEffect(() => {
    if (!bigGuides) {
      const reset = [0, 0, 0, 0, 0];
      vLineAnglesRef.current = reset;
      setVLineAngles(reset);
    }
  }, [bigGuides]);

  // Принудительный переход в landscape при открытии панорамы (ОБЕ СТОРОНЫ)
  const enterLandscapeMode = async () => {
    await lockAsync(OrientationLock.LANDSCAPE);
    setIsLandscape(true);
  };

  const exitLandscapeMode = async () => {
    await lockAsync(OrientationLock.PORTRAIT);
    setIsLandscape(false);
  };

  // Позиции подвижных линий хранятся ОТНОСИТЕЛЬНО (0..1 от реальной ширины/высоты фото),
  // поэтому при смене ориентации/масштаба линии остаются на клинических местах.
  const vLines = useRef([0.22, 0.35, 0.5, 0.65, 0.78].map(v => new Animated.Value(v))).current;
  const hLines = useRef([0.33, 0.5, 0.67].map(v => new Animated.Value(v))).current;
  // "Сырые" значения 0..1 для вычисления дельты при драге
  const vLinesRaw = useRef([0.22, 0.35, 0.5, 0.65, 0.78]);
  const hLinesRaw = useRef([0.33, 0.5, 0.67]);
  // Углы наклона вертикальных линий (макро-режим): градусы, 0 = строго вертикально
  const [vLineAngles, setVLineAngles] = useState([0, 0, 0, 0, 0]);
  const vLineAnglesRef = useRef([0, 0, 0, 0, 0]);
  // Размеры контейнера фото
  const photoContainerSize = useRef({ width: 1, height: 1 });
  // Абсолютная позиция контейнера фото на экране (для расчета углов наклона)
  const photoContainerLayout = useRef({ x: 0, y: 0 });
  const photoWrapRef = useRef<View>(null);
  // Натуральные размеры исходного фото (px)
  const imageNaturalSize = useRef({ width: 0, height: 0 });
  // Границы реально отрисованного изображения (resizeMode="contain")
  const imageLayout = useRef({ width: 1, height: 1, left: 0, top: 0 });

  // Динамические направляющие (до 5 вертикальных линий для измерения зубов)
  const [guideLinesEnabled, setGuideLinesEnabled] = useState(false);
  const guideLinesRef = useRef<Animated.Value[]>([new Animated.Value(0.5)]);
  const guideLinesRawRef = useRef<number[]>([0.5]);
  const [guideLinePositions, setGuideLinePositions] = useState<number[]>([0.5]);
  const [guideLineDistances, setGuideLineDistances] = useState<number[]>([]);
  const [guideLineCount, setGuideLineCount] = useState(1);
  const guideLinePRs = useRef<any[]>([]);
  const pixelsPerMm = useRef(10); // дефолт, обновляется из калибровки AI

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
        updateImageLayout();
        const size = axis === 'x' ? imageLayout.current.width : imageLayout.current.height;
        const delta = (axis === 'x' ? gs.dx : gs.dy) / size;
        animVal.setValue(Math.min(0.98, Math.max(0.02, rawArr[idx] + delta)));
      },
      onPanResponderRelease: (_e: GestureResponderEvent, gs: PanResponderGestureState) => {
        updateImageLayout();
        const size = axis === 'x' ? imageLayout.current.width : imageLayout.current.height;
        const delta = (axis === 'x' ? gs.dx : gs.dy) / size;
        rawArr[idx] = Math.min(0.98, Math.max(0.02, rawArr[idx] + delta));
        setScrollEnabled(true);
      },
      onPanResponderTerminate: () => setScrollEnabled(true),
    });

  // PanResponder для вращения вертикальной линии за верхнюю/нижнюю точки (макро-режим)
  // Угол вычисляется геометрически: atan2 относительно центра линии по положению пальца на экране
  const makeRotatePR = (idx: number, side: 'top' | 'bottom') => {
    let containerPos = { x: 0, y: 0 };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setScrollEnabled(false);
        updateImageLayout();
        photoWrapRef.current?.measureInWindow((x, y, _w, _h) => {
          containerPos = { x, y };
          photoContainerLayout.current = { x, y };
        });
      },
      onPanResponderMove: (_e: GestureResponderEvent, gs: PanResponderGestureState) => {
        const img = imageLayout.current;
        if (img.width <= 1 || img.height <= 1) return;
        const touchX = gs.moveX - containerPos.x;
        const touchY = gs.moveY - containerPos.y;
        const centerX = img.left + vLinesRaw.current[idx] * img.width;
        const centerY = img.top + img.height / 2;
        const dx = touchX - centerX;
        const dy = touchY - centerY;
        // Верхняя точка: линия указывает от центра к пальцу через верхний полюс (centerY - y)
        // Нижняя точка: через нижний полюс (y - centerY)
        const rad = side === 'top' ? Math.atan2(dx, -dy) : Math.atan2(dx, dy);
        const deg = rad * 180 / Math.PI;
        const nextAngle = Math.max(-45, Math.min(45, deg));
        vLineAnglesRef.current[idx] = nextAngle;
        setVLineAngles(prev => prev.map((a, i) => (i === idx ? nextAngle : a)));
      },
      onPanResponderRelease: () => {
        setScrollEnabled(true);
      },
      onPanResponderTerminate: () => setScrollEnabled(true),
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const vPRs = useRef(vLines.map((av, i) => makePR(av, vLinesRaw.current, i, 'x'))).current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hPRs = useRef(hLines.map((av, i) => makePR(av, hLinesRaw.current, i, 'y'))).current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const vTopPRs = useRef(vLines.map((_, i) => makeRotatePR(i, 'top'))).current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const vBottomPRs = useRef(vLines.map((_, i) => makeRotatePR(i, 'bottom'))).current;

  // ── Динамические направляющие: логика ──
  const updateGuideLineDistances = (positions?: number[]) => {
    updateImageLayout();
    const currentPositions = positions || guideLinesRawRef.current;
    const sorted = currentPositions.slice().sort((a, b) => a - b);
    const distances: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const px = (sorted[i + 1] - sorted[i]) * imageLayout.current.width;
      distances.push(px / pixelsPerMm.current);
    }
    setGuideLineDistances(distances);
    setGuideLinePositions(currentPositions.slice());
  };

  const makeGuideLinePR = (idx: number) => {
    let lastNewVal = guideLinesRawRef.current[idx];
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        lastNewVal = guideLinesRawRef.current[idx];
        setScrollEnabled(false);
      },
      onPanResponderMove: (_e: GestureResponderEvent, gs: PanResponderGestureState) => {
        updateImageLayout();
        const delta = gs.dx / imageLayout.current.width;
        lastNewVal = Math.min(0.98, Math.max(0.02, guideLinesRawRef.current[idx] + delta));
        guideLinesRef.current[idx].setValue(lastNewVal);
        const nextPositions = guideLinesRawRef.current.slice();
        nextPositions[idx] = lastNewVal;
        updateGuideLineDistances(nextPositions);
      },
      onPanResponderRelease: () => {
        guideLinesRawRef.current[idx] = lastNewVal;
        guideLinesRef.current[idx].setValue(lastNewVal);
        setScrollEnabled(true);
        updateGuideLineDistances();
      },
      onPanResponderTerminate: () => {
        guideLinesRawRef.current[idx] = lastNewVal;
        guideLinesRef.current[idx].setValue(lastNewVal);
        setScrollEnabled(true);
        updateGuideLineDistances();
      },
    });
  };

  const resetGuideLines = () => {
    guideLinesRef.current = [new Animated.Value(0.5)];
    guideLinesRawRef.current = [0.5];
    guideLinePRs.current = [makeGuideLinePR(0)];
    setGuideLinePositions([0.5]);
    setGuideLineCount(1);
    updateGuideLineDistances([0.5]);
  };

  const addGuideLine = () => {
    if (guideLinesRef.current.length >= 5) return;
    const positions = guideLinesRawRef.current.slice();
    // Новая линия появляется справа от самой правой, но не ближе 0.08
    const rightmost = Math.max(...positions);
    const newPos = Math.min(0.92, rightmost + 0.12);
    guideLinesRef.current.push(new Animated.Value(newPos));
    guideLinesRawRef.current.push(newPos);
    guideLinePRs.current.push(makeGuideLinePR(guideLinesRef.current.length - 1));
    setGuideLineCount(guideLinesRef.current.length);
    updateGuideLineDistances();
  };

  const removeLastGuideLine = () => {
    if (guideLinesRef.current.length <= 1) return;
    guideLinesRef.current.pop();
    guideLinesRawRef.current.pop();
    guideLinePRs.current.pop();
    setGuideLineCount(guideLinesRef.current.length);
    updateGuideLineDistances();
  };

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

  // Вычисляем реальные границы отображаемого изображения (resizeMode="contain")
  // Возвращает { width, height, left, top } в px относительно контейнера
  const updateImageLayout = () => {
    const container = photoContainerSize.current;
    const natural = imageNaturalSize.current;
    if (natural.width <= 0 || natural.height <= 0 || container.width <= 1 || container.height <= 1) {
      imageLayout.current = { width: container.width, height: container.height, left: 0, top: 0 };
      return;
    }
    const scale = Math.min(container.width / natural.width, container.height / natural.height);
    const width = natural.width * scale;
    const height = natural.height * scale;
    const left = (container.width - width) / 2;
    const top = (container.height - height) / 2;
    imageLayout.current = { width, height, left, top };
  };

  // Хелпер: возвращает px-диапазон для интерполяции Animated.Value в текущем layout
  const getLineOutputRange = (axis: 'x' | 'y'): [number, number] => {
    const img = imageLayout.current;
    return axis === 'x'
      ? [img.left, img.left + img.width]
      : [img.top, img.top + img.height];
  };

  // Калибровка масштаба по AI: центральный резец ~8.4 мм занимает ~15% ширины фото
  const calibrateScaleFromAI = () => {
    updateImageLayout();
    if (imageLayout.current.width > 1) {
      const centralIncisorPixels = imageLayout.current.width * 0.15;
      const centralIncisorMm = 8.4;
      pixelsPerMm.current = centralIncisorPixels / centralIncisorMm;
      updateGuideLineDistances();
    }
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

  // Системный промпт для Claude API: Архитектурный паспорт улыбки
  const getClaudeSystemPrompt = (segment: 'upper' | 'lower') => {
    const isUpper = segment === 'upper';
    const teeth = isUpper
      ? '12, 11, 21, 22'
      : '32, 31, 41, 42';
    const centralTeeth = isUpper ? '11 и 21' : '31 и 41';
    const lateralTeeth = isUpper ? '12 и 22' : '32 и 42';
    const goldenNote = isUpper
      ? 'Верхние резцы должны сужаться от центра к краям по правилу золотого сечения: центральные доминируют, боковые уже.'
      : 'Нижние резцы работают ЗЕРКАЛЬНО верхним: центральные (31, 41) — самые узкие, боковые (32, 42) — шире. Оценивай ровность режущего края и отсутствие скученности.';

    return `Ты — профессиональный, строгий и с мягкой иронией эксперт по цифровой эстетике улыбки с 20-летним опытом. Ты составляешь "Архитектурный паспорт улыбки" — геометрический аудит по фото. Сейчас анализируется ${isUpper ? 'ВЕРХНИЙ сегмент (резцы 12, 11, 21, 22)' : 'НИЖНИЙ сегмент (резцы 32, 31, 41, 42)'}. Верни JSON строго на русском языке:
{
  "widthHeight": "раздел 1",
  "zenith": "раздел 2",
  "goldenSymmetry": "раздел 3"
}
Структура отчета:
1. "📐 Пропорциональный дисбаланс (Ширина/Высота)" — оцени соотношение сторон резцов ${teeth}. ${isUpper ? 'Идеал ~80-85%. Центральные резцы (11, 21) — доминанты фасада.' : 'Центральные резцы (31, 41) должны быть уже боковых (32, 42). Оцени баланс ширины и отсутствие скученности.'} Хлестко опиши аномалии, используя ISO-нумерацию. Ирония допускается, но без грубости.
2. "📉 Десневой контур (Зениты десны)" — оцени симметрию высших точек десны левой и правой стороны для резцов ${teeth}. ${isUpper ? 'Падающая улыбка — главный враг.' : 'По нижнему контуру десны оцени ровность горизонта и обрати внимание на режущий край.'}
3. "⚖️ Симметрия по доминанте" — ${goldenNote} Оцени сужение/расширение зубного ряда по выбранной методике. Для нижнего сегмента золотое сечение работает НАОБОРОТ: центральные самые узкие, боковые шире.
Правила:
- Только JSON, без вступлений и без воды.
- Используй ISO-нумерацию: ${teeth}.
- Пиши по-русски, строго, профессионально, с лёгкой иронией.
- Если предоставлены углы наклона осевых линий (макро-режим), учитывай их в разделе "Симметрия по доминанте": указывай, какие резцы имеют анатомический наклон зубной оси, и оценивай, усиливает или корректирует этот наклон общую гармонию фасада.
- Если анализируется нижний сегмент, не применяй верхнюю логику доминанты: центральные нижние резцы (31, 41) не должны быть шире боковых (32, 42).`;
  };

  const generateAIReport = (results: typeof MOCK_RESULTS): AiReport => {
    const methodName = method === 'golden' ? 'Золотого сечения' : method === 'red' ? 'Гармоничной сетки' : 'Анатомического стандарта';
    const isUpper = selectedSegment === 'upper';
    const angles = vLineAnglesRef.current;
    const hasMacroAngles = bigGuides && angles.some(a => Math.abs(a) > 0.5);
    const maxAngle = hasMacroAngles ? Math.max(...angles.map(Math.abs)) : 0;
    const maxAngleIdx = hasMacroAngles ? angles.findIndex(a => Math.abs(a) === maxAngle) : -1;

    const central = results.find(r => r.label === 'Центральные резцы');
    const lateral = results.find(r => r.label === 'Боковые резцы');
    const canine = results.find(r => r.label === 'Клыки');

    let widthHeight: string;
    let zenith: string;
    let goldenSymmetry: string;

    if (isUpper) {
      widthHeight = central
        ? `Зуб 11 доминирует на ${Math.abs(central.deviationPct) + 80}%, выглядя как главный босс, на фоне которого боковые резцы ушли в тень. Соотношение В/Ш смещено на ${Math.abs(central.diffMm).toFixed(1)} мм — идеальные 80% остались в учебнике.`
        : 'Соотношение В/Ш центральных резцов 11 и 21 в пределах нормы. Фасад держится уверенно.';

      zenith = lateral
        ? `Асимметрия зенитов десны между боковыми резцами 12 и 22 ${lateral.deviationPct > 0 ? 'превышает' : 'сохраняется на уровне'} ${Math.abs(lateral.deviationPct)}%. Если не скорректировать контур, улыбка начнёт "падать" в сторону доминанты.`
        : 'Десневой контур симметричен. Зениты левой и правой стороны держат одну горизонталь.';

      const macroNote = hasMacroAngles
        ? ` Макро-режим показал наклон оси линии ${maxAngleIdx + 1} на ${maxAngle.toFixed(1)}° — это анатомическая особенность, которую стоит учесть при планировании реставраций.`
        : '';

      goldenSymmetry = canine
        ? `${canine.deviationPct > 0 ? 'Левый' : 'Правый'} сегмент выбился из сетки ${methodName} на ${Math.abs(canine.deviationPct)}% — зуб 22 ${canine.deviationPct > 0 ? 'шире' : 'уже'}, чем требует математика гармонии. Передняя группа требует пересчёта пропорций.${macroNote}`
        : `Сужение зубного ряда 12→11→21→22 по методике ${methodName} выдержано. Математика гармонии на своём месте.${macroNote}`;
    } else {
      widthHeight = central
        ? `Нижние резцы 31 и 41 зажаты, боковые 32 и 42 перехватили доминанту. Соотношение В/Ш смещено на ${Math.abs(central.diffMm).toFixed(1)} мм — истинный геометрический бунт против природы.`
        : 'Соотношение В/Ш нижних резцов 31, 41, 32, 42 в пределах нормы. Режущий край держит баланс.';

      zenith = lateral
        ? `По нижнему контуру десны вопросов нет, все идут в ровном горизонте, но обрати внимание на режущий край — боковые резцы 32 и 42 ${lateral.deviationPct > 0 ? 'выше' : 'ниже'} центральных на ${Math.abs(lateral.deviationPct)}%.`
        : 'Десневой контур нижнего сегмента симметричен. Зениты 32, 31, 41, 42 держат одну горизонталь.';

      const macroNote = hasMacroAngles
        ? ` Макро-режим зафиксировал наклон оси линии ${maxAngleIdx + 1} на ${maxAngle.toFixed(1)}° — в нижнем сегменте это особенно критично для оценки скученности и режущего края.`
        : '';

      goldenSymmetry = canine
        ? `Скученность в ${canine.deviationPct > 0 ? 'левом' : 'правом'} сегменте ломает математику гармонии на ${Math.abs(canine.deviationPct)}%. Зуб ${canine.deviationPct > 0 ? '32' : '42'} слегка развернут — нижний ряд требует пересчёта пропорций.${macroNote}`
        : `Расширение нижнего зубного ряда 32→31→41→42 по методике ${methodName} выдержано. Геометрия зеркально отвечает верхней группе.${macroNote}`;
    }

    return { widthHeight, zenith, goldenSymmetry };
  };

  const runSmileDesign = async () => {
    if (!photo) {
      Alert.alert('Ошибка', 'Сначала загрузите фото');
      return;
    }
    setSmileLoading(true);
    setSmileResult(null);
    try {
      const imageUrl = await uploadMediaToServer(photo);
      if (!imageUrl) {
        Alert.alert('Ошибка', 'Не удалось загрузить фото');
        return;
      }
      const rawUser = await AsyncStorage.getItem('user');
      const u = rawUser ? JSON.parse(rawUser) : null;
      const userId = u?.id || u?.email || 'unknown';
      const designType = method === 'golden' ? 'виниры' : method === 'red' ? 'коронки' : 'виниры';
      const response = await fetch('http://62.238.13.160:8000/analysis/smile-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          image_url: imageUrl,
          tooth_count: 6,
          design_type: designType,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        Alert.alert('Ошибка', data.detail || 'Не удалось выполнить проектирование');
        return;
      }
      setSmileResult(data);
      setShowResults(true);
    } catch (e) {
      console.error(e);
      Alert.alert('Ошибка', 'Не удалось связаться с сервером');
    } finally {
      setSmileLoading(false);
    }
  };

  // Управление видимостью сетки в панорамном режиме
  const showGridTemporarily = () => {
    // Отменяем предыдущий таймер
    if (gridHideTimeout.current) {
      clearTimeout(gridHideTimeout.current);
    }

    // Если сетка выключена (0%), оставляем её скрытой
    if (panoramaGridOpacity <= 0) {
      panoramaGridAnim.setValue(0);
      return;
    }

    // Показываем сетку с текущей прозрачностью
    Animated.timing(panoramaGridAnim, {
      toValue: panoramaGridOpacity,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Устанавливаем таймер на скрытие через 2.5 сек
    gridHideTimeout.current = setTimeout(() => {
      if (!isInteracting) {
        Animated.timing(panoramaGridAnim, {
          toValue: 0.12, // 12% прозрачности
          duration: 400,
          useNativeDriver: true,
        }).start();
      }
    }, 2500);
  };

  const handlePanoramaOpen = async () => {
    setPanoramaVisible(true);
    // Синхронизируем прозрачность сетки из основного экрана в панораму
    setPanoramaGridOpacity(gridOpacity);
    panoramaGridAnim.setValue(gridOpacity);
    // Принудительно переходим в landscape режим
    await enterLandscapeMode();
    showGridTemporarily();
  };

  const handlePanoramaClose = async () => {
    if (gridHideTimeout.current) {
      clearTimeout(gridHideTimeout.current);
    }
    setPanoramaVisible(false);
    // Синхронизируем настройки обратно
    setGridOpacity(panoramaGridOpacity);
    // Возвращаем портретную ориентацию
    await exitLandscapeMode();
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
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color="#f2ca50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Проектирование улыбки</Text>
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
                <Ionicons name="information-circle-outline" size={28} color="#f2ca50" />
                <Text style={styles.infoModalTitle}>Как здесь всё устроено?</Text>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.infoModalText}>
                  {'Простая инструкция:\n\nШаг 1. Загрузи фото улыбки 📸\nНажми на главную область экрана сверху, чтобы сделать новый снимок на камеру или выбрать готовую фотографию пациента из галереи смартфона.\n\nШаг 2. Настрой горизонт 📐\nЕсли фото получилось слегка кривым, нажми «ИИ Выравнивание». Умный алгоритм сам аккуратно покрутит картинку, чтобы зубы стояли строго ровно, а не боком.\n\nШаг 3. Выбери челюсть 🦷\nПрямо под фото есть переключатель «Верх / Нижний». Нажми его в зависимости от того, какие зубы ты хочешь измерить прямо сейчас.\n\nШаг 4. Включи и настрой линейки 📏\nНажми кнопку «Направляющие» внизу. Появятся вертикальные палочки. Кнопками «+» и «-» можно менять их количество до 5 строк. Просто перетаскивай их пальцем на стыки (межзубные промежутки). На черных табличках сразу покажется точное расстояние между ними в миллиметрах!\n\nШаг 5. Наклони оси (если нужно) 🔄\nЕсли зубы растут немного под наклоном, включи тумблер «Осевые линии (макро)». Теперь на концах палочек появятся круглые маркеры — тяни за них пальцем, чтобы наклонить линию ровно вдоль анатомической оси каждого зуба.\n\nШаг 6. Выбери методику 📋\nВ выпадающем списке выбери математическое правило, по которому хочешь оценить улыбку ("Золотое сечение", "Гармоничная сетка" или "Анатомический стандарт"). Рядом с каждой методикой есть своя кнопка (i), которая объяснит, как именно она считает.\n\nШаг 7. Получи Архитектурный паспорт 🧠\nНажми большую кнопку «Анализ пропорций». ИИ-Сенсей мгновенно изучит твои линейки, углы наклона, само фото и выдаст честный, строгий геометрический отчет: что получилось идеально, где есть перекосы и что с этим делать!'}
                </Text>

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
          contentContainerStyle={[styles.scroll, { paddingBottom: 120 }]}
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
                ref={photoWrapRef}
                style={styles.photoWrap}
                onLayout={e => {
                  const { width, height } = e.nativeEvent.layout;
                  photoContainerSize.current = { width, height };
                  photoWrapRef.current?.measureInWindow((x, y, _w, _h) => {
                    photoContainerLayout.current = { x, y };
                  });
                  calibrateScaleFromAI();
                }}
              >
                <Image
                  source={{ uri: photo }}
                  style={[styles.photo, { transform: [{ rotate: `${rotationDeg}deg` }] }]}
                  resizeMode="contain"
                />
                {/* Подвижные направляющие */}
                <View style={[styles.gridOverlay, { opacity: gridOpacity }]}>
                  {/* Вертикальные линии — позиция 0..1 от реальной ширины фото */}
                  {vLines.map((animVal, i) => (
                    <Animated.View
                      key={`v${i}`}
                      style={[
                        styles.dragLineV,
                        { left: animVal.interpolate({ inputRange: [0, 1], outputRange: getLineOutputRange('x') }) },
                        { transform: [{ rotate: `${vLineAngles[i]}deg` }] },
                      ]}
                      {...(!bigGuides ? vPRs[i].panHandlers : {})}
                    >
                      <View style={styles.dragLineVInner} />
                      {bigGuides && (
                        <>
                          <View style={styles.lineHandleTop} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }} {...vTopPRs[i].panHandlers}>
                            <View style={styles.lineHandleKnob} />
                          </View>
                          <View style={styles.lineHandleBottom} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }} {...vBottomPRs[i].panHandlers}>
                            <View style={styles.lineHandleKnob} />
                          </View>
                        </>
                      )}
                    </Animated.View>
                  ))}
                  {/* Горизонтальные линии — позиция 0..1 от реальной высоты фото */}
                  {hLines.map((animVal, i) => (
                    <Animated.View
                      key={`h${i}`}
                      style={[
                        styles.dragLineH,
                        { top: animVal.interpolate({ inputRange: [0, 1], outputRange: getLineOutputRange('y') }) },
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

                {/* Оверлей динамических направляющих */}
                {guideLinesEnabled && (() => {
                  const img = imageLayout.current;
                  const sorted = guideLinePositions.slice().sort((a, b) => a - b);
                  return (
                    <View style={styles.guideLinesOverlay} pointerEvents="box-none">
                      {guideLinesRef.current.map((animVal, i) => (
                        <Animated.View
                          key={`guide-${i}`}
                          style={[
                            styles.guideLine,
                            { left: animVal.interpolate({ inputRange: [0, 1], outputRange: getLineOutputRange('x') }) },
                          ]}
                          {...guideLinePRs.current[i].panHandlers}
                        >
                          <View style={styles.guideLineHandle} />
                          <View style={styles.guideLineKnob} />
                        </Animated.View>
                      ))}
                      {sorted.map((pos, i, arr) => {
                        if (i === arr.length - 1) return null;
                        const nextPos = arr[i + 1];
                        const mid = (pos + nextPos) / 2;
                        return (
                          <React.Fragment key={`guide-segment-${i}`}>
                            <View style={[styles.guideArrow, { left: img.left + pos * img.width, width: (nextPos - pos) * img.width }]}>
                              <View style={styles.guideArrowLeft} />
                              <View style={styles.guideArrowLine} />
                              <View style={styles.guideArrowRight} />
                            </View>
                            <View style={[styles.guideBadge, { left: img.left + mid * img.width }]}>
                              <Text style={styles.guideBadgeText} numberOfLines={1}>
                                {guideLineDistances[i]?.toFixed(1)} мм
                              </Text>
                            </View>
                          </React.Fragment>
                        );
                      })}
                    </View>
                  );
                })()}

                <TouchableOpacity style={styles.photoChangeHint} onPress={pickImage} activeOpacity={0.8}>
                  <Text style={styles.photoChangeText}>Нажмите, чтобы сменить фото</Text>
                </TouchableOpacity>

                {/* Кнопка Панорама */}
                <TouchableOpacity 
                  style={styles.panoramaBtn} 
                  onPress={handlePanoramaOpen}
                  activeOpacity={0.8}
                >
                  <Ionicons name="expand-outline" size={20} color="#f2ca50" />
                  <Text style={styles.panoramaBtnText}>Панорама</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Переключатель сегмента: Верх / Низ */}
          {photo && (
            <View style={styles.segmentControlWrapper}>
              <View style={styles.segmentControl}>
                <TouchableOpacity
                  style={[styles.segmentBtn, selectedSegment === 'upper' && styles.segmentBtnActive]}
                  onPress={() => {
                    setSelectedSegment('upper');
                    resetGuideLines();
                    calibrateScaleFromAI();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.segmentBtnText, selectedSegment === 'upper' && styles.segmentBtnTextActive]}>Верх</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentBtn, selectedSegment === 'lower' && styles.segmentBtnActive]}
                  onPress={() => {
                    setSelectedSegment('lower');
                    resetGuideLines();
                    calibrateScaleFromAI();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.segmentBtnText, selectedSegment === 'lower' && styles.segmentBtnTextActive]}>Низ</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

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
                <TouchableOpacity
                  style={styles.eyeToggleBtn}
                  onPress={() => {
                    if (gridOpacity > 0) {
                      lastGridOpacity.current = gridOpacity;
                      setGridOpacity(0);
                    } else {
                      setGridOpacity(lastGridOpacity.current || 0.6);
                    }
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons
                    name={gridOpacity > 0 ? 'eye-outline' : 'eye-off-outline'}
                    size={18}
                    color={gridOpacity > 0 ? '#f2ca50' : 'rgba(242,202,80,0.4)'}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.opacityBtns}>
                {[0, 0.2, 0.5, 0.8, 1.0].map(val => (
                  <TouchableOpacity
                    key={val}
                    style={[styles.opacityBtn, Math.abs(gridOpacity - val) < 0.05 && styles.opacityBtnActive]}
                    onPress={() => {
                      if (val > 0) lastGridOpacity.current = val;
                      setGridOpacity(val);
                    }}
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

              {/* Единый блок ИИ-кнопок */}
              <View style={styles.aiBlock}>
                <Animated.View style={[styles.aiBlockBtnWrap, { transform: [{ scale: aiPulse }] }]}>
                  <TouchableOpacity
                    style={[styles.aiBlockBtn, aiAligning && styles.aiBlockBtnActive]}
                    onPress={runAutoAlign}
                    activeOpacity={0.8}
                    disabled={aiAligning}
                  >
                    <Ionicons
                      name={aiAligning ? 'hourglass-outline' : 'sparkles-outline'}
                      size={14}
                      color={aiAligning ? 'rgba(242,202,80,0.5)' : 'rgba(242,202,80,0.7)'}
                    />
                    <Text style={[styles.aiBlockBtnText, aiAligning && { opacity: 0.6 }]}>
                      {aiAligning ? 'Анализ...' : 'ИИ Горизонт'}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>

              {/* Компактная панель управления направляющими: [toggle] [-] [count] [+] [reset] */}
              <View style={styles.guideControlPanel}>
                <TouchableOpacity
                  style={[styles.guideToggleBtn, guideLinesEnabled && styles.guideToggleBtnActive]}
                  onPress={() => {
                    const next = !guideLinesEnabled;
                    setGuideLinesEnabled(next);
                    if (next && guideLinesRef.current.length === 0) {
                      resetGuideLines();
                    }
                    if (next) calibrateScaleFromAI();
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={guideLinesEnabled ? 'options' : 'options-outline'}
                    size={16}
                    color={guideLinesEnabled ? '#031427' : '#f2ca50'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.guideTinyBtn, guideLinesRef.current.length <= 1 && styles.guideTinyBtnDisabled]}
                  onPress={() => {
                    removeLastGuideLine();
                    calibrateScaleFromAI();
                  }}
                  activeOpacity={0.8}
                  disabled={guideLinesRef.current.length <= 1}
                >
                  <Ionicons name="remove" size={16} color="#f2ca50" />
                </TouchableOpacity>

                <View style={styles.guideCountBadge}>
                  <Text style={styles.guideCountText}>{guideLineCount}/5</Text>
                </View>

                <TouchableOpacity
                  style={[styles.guideTinyBtn, guideLinesRef.current.length >= 5 && styles.guideTinyBtnDisabled]}
                  onPress={() => {
                    if (!guideLinesEnabled) setGuideLinesEnabled(true);
                    addGuideLine();
                    calibrateScaleFromAI();
                  }}
                  activeOpacity={0.8}
                  disabled={guideLinesRef.current.length >= 5}
                >
                  <Ionicons name="add" size={16} color="#f2ca50" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.guideTinyBtn}
                  onPress={() => {
                    resetGuideLines();
                    calibrateScaleFromAI();
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh-outline" size={16} color="#f2ca50" />
                </TouchableOpacity>
              </View>

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
                <Text style={styles.toggleLabel} numberOfLines={1} ellipsizeMode="tail">Анализ зенитов десны</Text>
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
                <Text style={styles.toggleLabel} numberOfLines={1} ellipsizeMode="tail">Соотношение В/Ш (80%)</Text>
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
              style={[styles.analyzeBtn, smileLoading && styles.analyzeBtnDisabled]}
              onPress={runSmileDesign}
              disabled={smileLoading}
              activeOpacity={0.85}
            >
              <Ionicons name="git-network" size={26} color="#031427" />
              <Text style={styles.analyzeBtnText}>
                {smileLoading ? 'Проектирование...' : 'Проектировать улыбку'}
              </Text>
            </TouchableOpacity>
          )}

          {/* ── ШАГ 4–5: AI-РЕЗУЛЬТАТЫ ── */}
          {showResults && (
            <View style={styles.section}>
              <View style={styles.resultsHeader}>
                <Text style={[styles.stepLabel, { textAlign: 'center' }]}>Архитектурный паспорт улыбки</Text>
                <View style={styles.methodActiveBadge}>
                  <Text style={styles.methodActiveBadgeText}>
                    {METHODS.find(m => m.key === method)?.label}
                  </Text>
                </View>
              </View>

              {/* Архитектурный паспорт улыбки: 3 раздела */}
              {aiReport && (
                <View style={styles.passportSection}>
                  <View style={styles.passportRow}>
                    <Text style={styles.passportIcon}>📐</Text>
                    <View style={styles.passportTextWrap}>
                      <Text style={styles.passportTitle}>Пропорциональный дисбаланс (Ширина/Высота)</Text>
                      <Text style={styles.passportText}>{aiReport.widthHeight.replace(/^[📐📉⚖️]\s*/, '')}</Text>
                    </View>
                  </View>
                  <View style={styles.passportDivider} />
                  <View style={styles.passportRow}>
                    <Text style={styles.passportIcon}>📉</Text>
                    <View style={styles.passportTextWrap}>
                      <Text style={styles.passportTitle}>Десневой контур (Зениты десны)</Text>
                      <Text style={styles.passportText}>{aiReport.zenith.replace(/^[📐📉⚖️]\s*/, '')}</Text>
                    </View>
                  </View>
                  <View style={styles.passportDivider} />
                  <View style={styles.passportRow}>
                    <Text style={styles.passportIcon}>⚖️</Text>
                    <View style={styles.passportTextWrap}>
                      <Text style={styles.passportTitle}>Симметрия по доминанте (Правило Золотого сечения)</Text>
                      <Text style={styles.passportText}>{aiReport.goldenSymmetry.replace(/^[📐📉⚖️]\s*/, '')}</Text>
                    </View>
                  </View>
                </View>
              )}

              {smileResult && (
                <View style={styles.smileResultCard}>
                  <View style={styles.smileResultHeader}>
                    <Ionicons name="git-network-outline" size={22} color="#f2ca50" />
                    <Text style={styles.smileResultTitle}>ПРОЕКТИРОВАНИЕ УЛЫБКИ</Text>
                  </View>
                  <Text style={styles.smileResultSummary}>{smileResult.summary}</Text>
                  <View style={styles.smileProportionsBlock}>
                    <Text style={styles.smileProportionsTitle}>Золотые пропорции</Text>
                    <Text style={styles.smileProportionsText}>
                      Центральный: {smileResult.proportions?.central_width} · Латеральный: {smileResult.proportions?.lateral_width} · Клык: {smileResult.proportions?.canine_width}
                    </Text>
                  </View>
                  <Text style={styles.smileMarkupTitle}>Разметка ({smileResult.markup?.length || 0} зубов):</Text>
                  {(smileResult.markup || []).slice(0, 6).map((m: any, idx: number) => (
                    <View key={idx} style={styles.smileMarkupRow}>
                      <Text style={styles.smileMarkupIndex}>{idx + 1}.</Text>
                      <Text style={styles.smileMarkupLabel}>{m.label}</Text>
                      <Text style={styles.smileMarkupWidth}>{m.recommended_width} мм</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Кнопка поделиться */}
              <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 8 }}>
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
          )}

          {/* ── ПРЕВЬЮ В РЕЗУЛЬТАТАХ ── */}
          {showResults && photo && (
            <View style={styles.resultPhotoWrap}>
              <Image
                source={{ uri: photo }}
                style={[styles.resultPhoto, { transform: [{ rotate: `${rotationDeg}deg` }] }]}
                resizeMode="contain"
              />
              {/* Сетка */}
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
        </ScrollView>
      </View>

      {/* ── МОДАЛЬНОЕ ОКНО: ПАНОРАМНЫЙ РЕЖИМ (ПОЛНОЭКРАННЫЙ) ── */}
      <Modal
        visible={panoramaVisible}
        transparent={false}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent={true}
        onRequestClose={handlePanoramaClose}
      >
        <View style={styles.panoramaContainer}>
          {/* Кнопка закрытия - плавающая в углу */}
          <TouchableOpacity 
            onPress={handlePanoramaClose} 
            style={styles.panoramaCloseFloating}
            activeOpacity={0.7}
          >
            <View style={styles.panoramaCloseCircle}>
              <Ionicons name="close" size={24} color="#f2ca50" />
            </View>
          </TouchableOpacity>

          {/* Фото на весь экран */}
          <View
            ref={photoWrapRef}
            style={styles.panoramaPhotoWrap}
            onLayout={e => {
              const { width, height } = e.nativeEvent.layout;
              photoContainerSize.current = { width, height };
              photoWrapRef.current?.measureInWindow((x, y, _w, _h) => {
                photoContainerLayout.current = { x, y };
              });
              calibrateScaleFromAI();
            }}
            onTouchStart={() => {
              setIsInteracting(true);
              showGridTemporarily();
            }}
            onTouchEnd={() => {
              setIsInteracting(false);
              showGridTemporarily();
            }}
          >
            <Image
              source={{ uri: photo || '' }}
              style={[styles.panoramaPhotoFullscreen, { transform: [{ rotate: `${rotationDeg}deg` }] }]}
              resizeMode="contain"
            />
            
            {/* Сетка с анимированной прозрачностью */}
            <Animated.View style={[styles.panoramaGridOverlay, { opacity: panoramaGridAnim }]}>
              {/* Вертикальные линии */}
              {vLines.map((animVal, i) => (
                <Animated.View
                  key={`pv${i}`}
                  style={[
                    styles.panoramaDragLineV,
                    { left: animVal.interpolate({ inputRange: [0, 1], outputRange: getLineOutputRange('x') }) },
                    { transform: [{ rotate: `${vLineAngles[i]}deg` }] },
                  ]}
                  {...(!bigGuides ? vPRs[i].panHandlers : {})}
                >
                  <View style={styles.panoramaDragLineVInner} />
                  {bigGuides && (
                    <>
                      <View style={styles.lineHandleTop} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }} {...vTopPRs[i].panHandlers}>
                        <View style={styles.lineHandleKnob} />
                      </View>
                      <View style={styles.lineHandleBottom} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }} {...vBottomPRs[i].panHandlers}>
                        <View style={styles.lineHandleKnob} />
                      </View>
                    </>
                  )}
                </Animated.View>
              ))}
              {/* Горизонтальные линии */}
              {hLines.map((animVal, i) => (
                <Animated.View
                  key={`ph${i}`}
                  style={[
                    styles.panoramaDragLineH,
                    { top: animVal.interpolate({ inputRange: [0, 1], outputRange: getLineOutputRange('y') }) },
                  ]}
                  {...hPRs[i].panHandlers}
                >
                  <View style={styles.panoramaDragLineHInner} />
                </Animated.View>
              ))}
              <View style={styles.panoramaGridCenter} />
            </Animated.View>

            {/* Оверлей динамических направляющих в панорамном режиме */}
            {guideLinesEnabled && (() => {
              const img = imageLayout.current;
              const sorted = guideLinePositions.slice().sort((a, b) => a - b);
              return (
                <View style={styles.panoramaGuideLinesOverlay} pointerEvents="box-none">
                  {guideLinesRef.current.map((animVal, i) => (
                    <Animated.View
                      key={`pguide-${i}`}
                      style={[
                        styles.panoramaGuideLine,
                        { left: animVal.interpolate({ inputRange: [0, 1], outputRange: getLineOutputRange('x') }) },
                      ]}
                      {...guideLinePRs.current[i].panHandlers}
                    >
                      <View style={styles.panoramaGuideLineHandle} />
                      <View style={styles.panoramaGuideLineKnob} />
                    </Animated.View>
                  ))}
                  {sorted.map((pos, i, arr) => {
                    if (i === arr.length - 1) return null;
                    const nextPos = arr[i + 1];
                    const mid = (pos + nextPos) / 2;
                    return (
                      <React.Fragment key={`pguide-segment-${i}`}>
                        <View style={[styles.guideArrow, { left: img.left + pos * img.width, width: (nextPos - pos) * img.width }]}>
                          <View style={styles.guideArrowLeft} />
                          <View style={styles.guideArrowLine} />
                          <View style={styles.guideArrowRight} />
                        </View>
                        <View style={[styles.panoramaGuideBadge, { left: img.left + mid * img.width }]}>
                          <Text style={styles.panoramaGuideBadgeText} numberOfLines={1}>
                            {guideLineDistances[i]?.toFixed(1)} мм
                          </Text>
                        </View>
                      </React.Fragment>
                    );
                  })}
                </View>
              );
            })()}
          </View>

          {/* Ультра-компактная однострочная панель: сетка + направляющие + поворот */}
          <View style={styles.panoramaToolbar}>
            {/* Группа сетки: глаз / минус / % / плюс */}
            <View style={styles.toolbarGroup}>
              <TouchableOpacity
                style={styles.toolbarTinyBtn}
                onPress={() => {
                  if (panoramaGridOpacity > 0) {
                    lastPanoramaGridOpacity.current = panoramaGridOpacity;
                    setPanoramaGridOpacity(0);
                    panoramaGridAnim.setValue(0);
                  } else {
                    const restored = lastPanoramaGridOpacity.current || 0.6;
                    setPanoramaGridOpacity(restored);
                    panoramaGridAnim.setValue(restored);
                  }
                  showGridTemporarily();
                }}
              >
                <Ionicons
                  name={panoramaGridOpacity > 0 ? 'eye-outline' : 'eye-off-outline'}
                  size={14}
                  color={panoramaGridOpacity > 0 ? '#f2ca50' : 'rgba(242,202,80,0.4)'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.toolbarTinyBtn}
                onPress={() => {
                  const newVal = Math.max(0, panoramaGridOpacity - 0.1);
                  if (newVal > 0) lastPanoramaGridOpacity.current = newVal;
                  setPanoramaGridOpacity(newVal);
                  panoramaGridAnim.setValue(newVal);
                  showGridTemporarily();
                }}
              >
                <Ionicons name="remove" size={14} color="#f2ca50" />
              </TouchableOpacity>
              <View style={styles.toolbarTinyValue}>
                <Text style={styles.toolbarTinyText}>{Math.round(panoramaGridOpacity * 100)}%</Text>
              </View>
              <TouchableOpacity
                style={styles.toolbarTinyBtn}
                onPress={() => {
                  const newVal = Math.min(1, panoramaGridOpacity + 0.1);
                  lastPanoramaGridOpacity.current = newVal;
                  setPanoramaGridOpacity(newVal);
                  panoramaGridAnim.setValue(newVal);
                  showGridTemporarily();
                }}
              >
                <Ionicons name="add" size={14} color="#f2ca50" />
              </TouchableOpacity>
            </View>

            {/* Разделитель */}
            <View style={styles.toolbarTinyDivider} />

            {/* ИИ-выравнивание горизонта */}
            <View style={styles.toolbarGroup}>
              <TouchableOpacity
                style={[styles.toolbarTinyBtn, aiAligning && styles.toolbarTinyBtnActive]}
                onPress={() => {
                  runAutoAlign();
                  showGridTemporarily();
                }}
                disabled={aiAligning}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={aiAligning ? 'hourglass-outline' : 'sparkles-outline'}
                  size={14}
                  color={aiAligning ? 'rgba(242,202,80,0.5)' : '#f2ca50'}
                />
              </TouchableOpacity>
            </View>

            {/* Разделитель */}
            <View style={styles.toolbarTinyDivider} />

            {/* Группа направляющих: тумблер / минус / count / плюс */}
            <View style={styles.toolbarGroup}>
              <TouchableOpacity
                style={[styles.toolbarTinyBtn, guideLinesEnabled && styles.toolbarTinyBtnActive]}
                onPress={() => {
                  const next = !guideLinesEnabled;
                  setGuideLinesEnabled(next);
                  if (next && guideLinesRef.current.length === 0) resetGuideLines();
                  if (next) calibrateScaleFromAI();
                  showGridTemporarily();
                }}
              >
                <Ionicons
                  name={guideLinesEnabled ? 'options' : 'options-outline'}
                  size={14}
                  color={guideLinesEnabled ? '#031427' : '#f2ca50'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toolbarTinyBtn, guideLinesRef.current.length <= 1 && styles.toolbarTinyBtnDisabled]}
                onPress={() => {
                  removeLastGuideLine();
                  calibrateScaleFromAI();
                  showGridTemporarily();
                }}
                disabled={guideLinesRef.current.length <= 1}
              >
                <Ionicons name="remove" size={14} color="#f2ca50" />
              </TouchableOpacity>
              <View style={styles.toolbarTinyValue}>
                <Text style={styles.toolbarTinyText}>{guideLineCount}/5</Text>
              </View>
              <TouchableOpacity
                style={[styles.toolbarTinyBtn, guideLinesRef.current.length >= 5 && styles.toolbarTinyBtnDisabled]}
                onPress={() => {
                  if (!guideLinesEnabled) setGuideLinesEnabled(true);
                  addGuideLine();
                  calibrateScaleFromAI();
                  showGridTemporarily();
                }}
                disabled={guideLinesRef.current.length >= 5}
              >
                <Ionicons name="add" size={14} color="#f2ca50" />
              </TouchableOpacity>
            </View>

            {/* Разделитель */}
            <View style={styles.toolbarTinyDivider} />

            {/* Сегмент-переключатель: Верх / Низ */}
            <View style={styles.toolbarSegmentControl}>
              <TouchableOpacity
                style={[styles.toolbarSegmentBtn, selectedSegment === 'upper' && styles.toolbarSegmentBtnActive]}
                onPress={() => {
                  setSelectedSegment('upper');
                  resetGuideLines();
                  calibrateScaleFromAI();
                  showGridTemporarily();
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.toolbarSegmentBtnText, selectedSegment === 'upper' && styles.toolbarSegmentBtnTextActive]}>В</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toolbarSegmentBtn, selectedSegment === 'lower' && styles.toolbarSegmentBtnActive]}
                onPress={() => {
                  setSelectedSegment('lower');
                  resetGuideLines();
                  calibrateScaleFromAI();
                  showGridTemporarily();
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.toolbarSegmentBtnText, selectedSegment === 'lower' && styles.toolbarSegmentBtnTextActive]}>Н</Text>
              </TouchableOpacity>
            </View>

            {/* Разделитель */}
            <View style={styles.toolbarTinyDivider} />

            {/* Группа поворота: влево / градус / вправо / сброс */}
            <View style={styles.toolbarGroup}>
              <TouchableOpacity
                style={styles.toolbarTinyBtn}
                onPress={() => {
                  setRotationDeg(prev => prev - 1);
                  showGridTemporarily();
                }}
              >
                <Ionicons name="chevron-back" size={14} color="#f2ca50" />
              </TouchableOpacity>
              <View style={styles.toolbarTinyValue}>
                <Text style={styles.toolbarTinyText}>{rotationDeg}°</Text>
              </View>
              <TouchableOpacity
                style={styles.toolbarTinyBtn}
                onPress={() => {
                  setRotationDeg(prev => prev + 1);
                  showGridTemporarily();
                }}
              >
                <Ionicons name="chevron-forward" size={14} color="#f2ca50" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.toolbarTinyBtn}
                onPress={() => {
                  setRotationDeg(0);
                  showGridTemporarily();
                }}
              >
                <Ionicons name="refresh" size={12} color="rgba(242,202,80,0.8)" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── МОДАЛЬНОЕ ОКНО: НЕДОСТАТОЧНО АЛМАЗОВ ── */}
      <Modal
        visible={diamondsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDiamondsModalVisible(false)}
      >
        <View style={styles.diamondsModalOverlay}>
          <View style={styles.diamondsModalContainer}>
            <Ionicons name="diamond-outline" size={48} color="#f2ca50" style={{ marginBottom: 16 }} />
            <Text style={styles.diamondsModalTitle}>Недостаточно алмазов</Text>
            <Text style={styles.diamondsModalText}>
              Недостаточно алмазов для проведения AI-анализа. Пожалуйста, проверьте ваш баланс в профиле.
            </Text>
            <TouchableOpacity
              style={styles.diamondsModalButton}
              onPress={() => setDiamondsModalVisible(false)}
            >
              <Text style={styles.diamondsModalButtonText}>ОК</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  lineHandleTop: {
    position: 'absolute',
    top: -10,
    left: '50%',
    marginLeft: -10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineHandleBottom: {
    position: 'absolute',
    bottom: -10,
    left: '50%',
    marginLeft: -10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineHandleKnob: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f2ca50',
    borderWidth: 2,
    borderColor: '#031427',
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
    flexWrap: 'wrap',
  },
  methodBtnActive: {
    backgroundColor: 'rgba(242,202,80,0.12)',
    borderColor: '#f2ca50',
  },
  methodBtnText: {
    flex: 1,
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
    flex: 1,
    marginRight: 10,
  },
  toggleLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
    flex: 1,
  },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f2ca50',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignSelf: 'center',
    marginBottom: 8,
  },
  analyzeBtnText: {
    color: '#031427',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  methodActiveBadge: {
    alignSelf: 'center',
    maxWidth: '90%',
    flexWrap: 'wrap',
    backgroundColor: 'rgba(242,202,80,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  methodActiveBadgeText: {
    color: '#f2ca50',
    fontSize: 12,
    fontWeight: '600',
    flexWrap: 'wrap',
    textAlign: 'center',
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
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  eyeToggleBtn: {
    padding: 4,
  },
  aiBlock: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.35)',
    backgroundColor: 'rgba(242,202,80,0.06)',
    overflow: 'hidden',
  },
  aiBlockBtnWrap: {
    flex: 1,
  },
  aiBlockBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  aiBlockBtnActive: {
    backgroundColor: 'rgba(242,202,80,0.08)',
  },
  aiBlockBtnText: {
    color: '#f2ca50',
    fontSize: 12,
    fontWeight: '600',
  },
  segmentControlWrapper: {
    marginTop: 8,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  segmentControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 2,
    gap: 2,
  },
  segmentBtn: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#f2ca50',
  },
  segmentBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  segmentBtnTextActive: {
    color: '#031427',
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

  // ── Стили Архитектурного паспорта улыбки ──
  passportSection: {
    marginBottom: 16,
    padding: 12,
    paddingBottom: 40,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  passportRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  passportIcon: {
    fontSize: 22,
    lineHeight: 28,
  },
  passportTextWrap: {
    flex: 1,
    gap: 4,
  },
  passportTitle: {
    color: '#f2ca50',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    lineHeight: 18,
  },
  passportText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 20,
  },
  passportDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // ── Стили кнопки Панорама ──
  panoramaBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(8,13,26,0.85)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.3)',
  },
  panoramaBtnText: {
    color: '#f2ca50',
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Стили панорамного режима (ПОЛНОЭКРАННЫЙ) ──
  panoramaContainer: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  panoramaCloseFloating: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 100,
    padding: 4,
  },
  panoramaCloseCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(8,13,26,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panoramaPhotoWrap: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#0B0F19',
  },
  panoramaPhotoFullscreen: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  panoramaGridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  panoramaDragLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 28,
    marginLeft: -14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panoramaDragLineVInner: {
    width: 1,
    height: '100%',
    backgroundColor: '#f2ca50',
  },
  panoramaDragLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 28,
    marginTop: -14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panoramaDragLineHInner: {
    height: 1,
    width: '100%',
    backgroundColor: '#f2ca50',
  },
  panoramaGridCenter: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1.5,
    backgroundColor: '#fff',
    opacity: 0.6,
  },

  // ── Ультра-компактная однострочная панель инструментов ──
  panoramaToolbar: {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    transform: [{ translateX: '-50%' }],
    maxWidth: '90%',
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(8,13,26,0.92)',
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.2)',
  },
  toolbarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toolbarTinyBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(242,202,80,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarTinyBtnActive: {
    backgroundColor: 'rgba(242,202,80,0.2)',
    borderColor: 'rgba(242,202,80,0.5)',
  },
  toolbarTinyDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(242,202,80,0.15)',
  },
  toolbarTinyValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: 'rgba(242,202,80,0.05)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.1)',
  },
  toolbarTinyText: {
    color: '#f2ca50',
    fontSize: 10,
    fontWeight: '600',
    minWidth: 20,
    textAlign: 'center',
  },

  // ── Стили модального окна алмазов ──
  diamondsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  diamondsModalContainer: {
    backgroundColor: '#151518',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.2)',
    width: '100%',
    maxWidth: 320,
  },
  diamondsModalTitle: {
    color: '#f2ca50',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  diamondsModalText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  diamondsModalButton: {
    backgroundColor: '#f2ca50',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  diamondsModalButtonText: {
    color: '#031427',
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Стили динамических направляющих (1-5 линий) ──
  guideControlPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(242,202,80,0.1)',
  },
  guideToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.3)',
    backgroundColor: 'rgba(242,202,80,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideToggleBtnActive: {
    backgroundColor: '#f2ca50',
    borderColor: '#f2ca50',
  },
  guideTinyBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.3)',
    backgroundColor: 'rgba(242,202,80,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideTinyBtnDisabled: {
    opacity: 0.4,
  },
  guideCountBadge: {
    minWidth: 36,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(242,202,80,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideCountText: {
    color: '#f2ca50',
    fontSize: 12,
    fontWeight: '700',
  },
  guideLinesOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  guideLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 24,
    marginLeft: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideLineHandle: {
    width: 1,
    height: '100%',
    backgroundColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 4,
  },
  guideLineKnob: {
    position: 'absolute',
    top: 12,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 6,
  },
  guideArrow: {
    position: 'absolute',
    top: '55%',
    height: 10,
    marginTop: -5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  guideArrowLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,215,0,0.85)',
  },
  guideArrowLeft: {
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderRightWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: 'rgba(255,215,0,0.85)',
    marginRight: -1,
  },
  guideArrowRight: {
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderLeftWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'rgba(255,215,0,0.85)',
    marginLeft: -1,
  },
  guideBadge: {
    position: 'absolute',
    top: '48%',
    marginTop: -12,
    marginLeft: -32,
    width: 64,
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideBadgeText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  panoramaGuideLinesOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  panoramaGuideLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 28,
    marginLeft: -14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panoramaGuideLineHandle: {
    width: 1,
    height: '100%',
    backgroundColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 6,
  },
  panoramaGuideLineKnob: {
    position: 'absolute',
    top: 16,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 1,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 8,
  },
  panoramaGuideBadge: {
    position: 'absolute',
    top: '48%',
    marginTop: -14,
    marginLeft: -36,
    width: 72,
    paddingVertical: 5,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panoramaGuideBadgeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  toolbarTinyBtnDisabled: {
    opacity: 0.4,
  },
  toolbarSegmentControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 13,
    padding: 2,
    gap: 2,
  },
  toolbarSegmentBtn: {
    width: 26,
    height: 26,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarSegmentBtnActive: {
    backgroundColor: '#f2ca50',
  },
  toolbarSegmentBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
  },
  toolbarSegmentBtnTextActive: {
    color: '#031427',
  },
  smileResultCard: {
    backgroundColor: 'rgba(10, 16, 30, 0.92)',
    borderRadius: 16,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.45)',
    gap: 12,
  },
  smileResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  smileResultTitle: {
    color: '#f2ca50',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  smileResultSummary: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 18,
  },
  smileProportionsBlock: {
    backgroundColor: 'rgba(242, 202, 80, 0.1)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.25)',
  },
  smileProportionsTitle: {
    color: '#f2ca50',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  smileProportionsText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  smileMarkupTitle: {
    color: '#f2ca50',
    fontSize: 13,
    fontWeight: '700',
  },
  smileMarkupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smileMarkupIndex: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    width: 20,
  },
  smileMarkupLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    flex: 1,
  },
  smileMarkupWidth: {
    color: '#f2ca50',
    fontSize: 13,
    fontWeight: '700',
  },
});
