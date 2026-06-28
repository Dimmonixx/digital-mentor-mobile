import CustomAlert from '@/components/CustomAlert';
import { ANTHROPIC_API_KEY } from '@/constants/config';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { uploadMediaToServer } from '@/utils/saveToArchive';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    Image,
    ImageBackground,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNewOrdersCount } from '../hooks/useNewOrdersCount';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const VITA_SHADES = [
  "A1", "A2", "A3", "A3.5", "A4",
  "B1", "B2", "B3", "B4",
  "C1", "C2", "C3", "C4",
  "D2", "D3", "D4",
  "BL1", "BL2", "BL3", "BL4"
];

const WORK_STAGES = [
  "Не указан",
  "После 1-го обжига",
  "После 2-го обжига",
  "Финальный обжиг",
  "Готовая работа (глазурь)"
];

const ANALYSIS_TYPES = [
  "Общий анализ работы",
  "Проверить цвет и оттенок",
  "Проверить форму и морфологию",
  "Оценить симметрию",
  "Просто похвастаться 😎",
  "Найти косяки",
  "Финальная проверка перед сдачей"
];

const CONSTRUCTION_TYPES = [
  "Коронка",
  "Винир",
  "Мостовидный протез",
  "Абатмент",
  "Вкладка",
  "Накладка",
];

const UPPER_TEETH = ["18","17","16","15","14","13","12","11",
                     "21","22","23","24","25","26","27","28"];
const LOWER_TEETH = ["48","47","46","45","44","43","42","41",
                     "31","32","33","34","35","36","37","38"];

const ANALYSIS_PROMPTS = {
  general: "Ты — Сенсей, критический и бескомпромиссный эксперт в эстетической стоматологии. Оцени работу со всей строгостью. ЖЕСТКОЕ ПРАВИЛО: Забудь про дежурную вежливость и толерантность! Если работа — отстой, пиши прямо и аргументированно. Не пытайся хвалить «для галочки». Проанализируй макро- и микрорельеф, прозрачность, форму и интеграцию. Ищи малейшие изъяны.",
  color_match: "Ты — Сенсей, жесткий эксперт-колорист. Оцени ТОЛЬКО попадание в заказанный цвет по шкале VITA. ПРАВИЛО: Никакой дипломатии. Если цвет неестественно белый или провалена прозрачность — разнеси эту ошибку профессиональным языком. Сфокусируйся на пришейке, теле и режущем крае. Оценивай ИСКЛЮЧИТЕЛЬНО цвет, игнорируй форму.",
  morphology: "Ты — Сенсей, суровый профессор анатомии зубов. Сфокусируйся ИСКЛЮЧИТЕЛЬНО на морфологии, макрорельефе, фиссурах. ПРАВИЛО: Никакой жалости. Если мамелоны плоские, валики стерты, а форма зуба квадратная вместо анатомической — укажи на это прямо. Полностью игнорируй цвет и десну.",
  symmetry: "Ты — Сенсей, челюстно-лицевой архитектор с синдромом идеального порядка. Твоя цель — идеальная геометрия. ПРАВИЛО: Ищи малейшие диспропорции. Наклон осей вбок, смещение зенитов шеек даже на полмиллиметра, разная ширина коронок 11 и 21 зубов — фиксируй всё. Никакой похвалы, только сухие геометрические факты отклонений. Игнорируй цвет.",
  fun: "Ты — Сенсей, опытный ментор с едким профессиональным юмором. Коллега решил 'просто похвастаться', но если там косяки — потролли его по-дружески, но тонко и по делу, чтобы в следующий раз целился в идеал.",
  issues: "Ты — Сенсей, злейший инспектор ОТК. Твоя единственная цель — найти технологический брак и косяки. Поры в керамике, наплывы глазури, сколы, черные треугольники, нависающие края, плохой проксимальный контакт. Пиши жестко, хлестко, пунктами, без вступлений и резюме.",
  final_check: "Ты — Сенсей, главный врач элитной клиники перед фиксацией работы в кресле. Никаких компромиссов, ведь на кону репутация. Если работа сырая — отправляй на переделывать с жестким списком правок. Вынеси финальный вердикт: Фиксация или Доработка."
};

const ANALYSIS_TYPE_KEYS: Record<string, keyof typeof ANALYSIS_PROMPTS> = {
  "Общий анализ работы": "general",
  "Проверить цвет и оттенок": "color_match",
  "Проверить форму и морфологию": "morphology",
  "Оценить симметрию": "symmetry",
  "Просто похвастаться 😎": "fun",
  "Найти косяки": "issues",
  "Финальная проверка перед сдачей": "final_check"
};

const ANALYSIS_PRICES: Record<keyof typeof ANALYSIS_PROMPTS, number> = {
  general: 1,
  color_match: 1,
  morphology: 1,
  symmetry: 1,
  fun: 1,
  issues: 1,
  final_check: 1,
};

const ANALYSIS_BUTTON_TITLES: Record<keyof typeof ANALYSIS_PROMPTS, string> = {
  general: 'общий анализ',
  color_match: 'проверку цвета',
  morphology: 'проверку морфологии',
  symmetry: 'проверку симметрии',
  fun: 'похвастаться',
  issues: 'поиск косяков',
  final_check: 'финальную проверку',
};

const LOADING_STATUSES = [
  "Сенсей сканирует макро- и микрорельеф...",
  "Анализируем соответствие заказанному цвету...",
  "Сопоставляем геометрию с зубами-антагонистами...",
  "Формируем финальный экспертный вердикт..."
];

const CLAUDE_MODEL = 'claude-sonnet-4-6';

function resolveMimeType(asset: ImagePicker.ImagePickerAsset): 'image/jpeg' | 'image/png' {
  if (asset.mimeType === 'image/png') return 'image/png';
  if (asset.mimeType === 'image/jpeg' || asset.mimeType === 'image/jpg') return 'image/jpeg';
  if (asset.uri.toLowerCase().endsWith('.png')) return 'image/png';
  return 'image/jpeg';
}

async function analyzeWithClaude(
  base64: string,
  mediaType: 'image/jpeg' | 'image/png',
  vitaShade: string,
  workStage: string,
  analysisType: string,
  teeth: string,
  comment: string,
): Promise<string> {
  const analysisTypeKey = ANALYSIS_TYPE_KEYS[analysisType] || 'general';
  const systemPrompt = ANALYSIS_PROMPTS[analysisTypeKey];

  const prompt = `Ты — Сенсей, строгий и опытный зубной техник-наставник с 30-летним стажем. Ты циничен, беспристрастен и не прощаешь брака. Оцени керамическую работу на фото с профессиональной жесткостью.

ПАРАМЕТРЫ РАБОТЫ:
- Зубы: ${teeth}
- Заказанный цвет: ${vitaShade}
- Этап работы: ${workStage}
- Тип анализа: ${analysisType}
- Комментарий: ${comment}

ПРАВИЛО ФИЛЬТРАЦИИ КАТЕГОРИЙ:
- Если тип анализа "Проверить цвет и оттенок", заполни ТОЛЬКО секцию orderMatch (соответствие цвета). Во всех остальных секциях (anatomy, optics, gumAnalysis) верни строго пустые строки "" или null!
- Если тип анализа "Проверить форму и морфологию" или "Оценить симметрию", заполни ТОЛЬКО секцию anatomy. Секции цвета (orderMatch) и розовой эстетики (gumAnalysis) верни строго пустыми ""!
- Если тип анализа "Найти косяки", пиши строго в секцию technicalChecklist, остальные секции оставь пустыми!
- Если тип анализа "Финальная проверка перед сдачей", заполни все секции как при общем анализе.
- Если тип анализа "Общий анализ работы", заполни все секции.
- Запрещено генерировать текст в секциях, которые не относятся к выбранному типу анализа!

ФОРМАТ ОТВЕТА (СТРОГО ТОЛЬКО JSON, без markdown-разметки):
Верни ТОЛЬКО валидный JSON-объект следующей структуры:
{
  "orderMatch": {
    "status": "КРИТИЧНО | ВАЖНО | НОРМА",
    "text": "Анализ соответствия заказанному оттенку VITA и учет цвета культи/использования опакера."
  },
  "anatomy": {
    "status": "КРИТИЧНО | ВАЖНО | НОРМА",
    "neck": "Пришеечная треть: плотность прилегания, анатомический контур, переход цвета, интенсивность.",
    "body": "Экватор и средняя треть: макроформа, симметрия парных зубов по ISO (избегать зеркального клонирования), вертикальные валики и горизонтальная макротекстура.",
    "edge": "Режущий край: прозрачность (гало-эффект, опалесценция), индивидуальные особенности, естественная асимметрия углов."
  },
  "optics": {
    "status": "КРИТИЧНО | ВАЖНО | НОРМА",
    "text": "Оценка равномерности глазури (исключить гиперглазурь, сглаживающую рельеф, и сухие зоны), светоотражение поверхности и внутренние эффекты."
  },
  "gumAnalysis": {
    "status": "КРИТИЧНО | ВАЖНО | НОРМА | НЕ ПРИМЕНИМО",
    "text": "Розовая эстетика: контур зенитов, форма десневых сосочков, переход керамика-десна. Если десна на фото отсутствует, статус строго 'НЕ ПРИМЕНИМО', а текст пустой."
  },
  "technicalChecklist": [
    {
      "level": "КРИТИЧЕСКИЙ | ЖЕСТКИЙ | РЕКОМЕНДАЦИЯ | НЕ ОБЯЗАТЕЛЬНО",
      "criterion": "Краткая емкая формулировка конкретной ошибки или рекомендации (выдать от 3 до 5 динамических критериев на основе дефектов работы)."
    }
  ],
  "finalVerdict": "Общий жесткий, циничный и беспристрастный вывод Сенсея. Прямой вердикт: готова ли работа к сдаче или это хлам, требующий тотального переделывания."
}

Правила:
- Используй глубокую стоматологическую терминологию (мамелоны, перикиматий, зениты, опакер, подтон, ISO-нумерация)
- Замечай малейшие отклонения от идеала
- Никакой жалости к браку и хламу, только сухие факты и экспертный аудит
- Статусы: КРИТИЧНО (красный), ВАЖНО (желтый), НОРМА (зеленый), НЕ ПРИМЕНИМО (серый)
- Верни ТОЛЬКО JSON, без \`\`\`json ... \`\`\`
- Пиши содержательно, но емко, без лишней "воды", чтобы гарантированно уложиться в лимит ответа и прислать валидный, полностью закрытый JSON-объект`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  const data = (await res.json()) as {
    error?: { message?: string };
    content?: Array<{ type: string; text?: string }>;
  };

  if (!res.ok) {
    const msg = data.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const textBlock = data.content?.find((c) => c.type === 'text' && c.text);
  const text = textBlock?.text?.trim() ?? '';
  if (!text) {
    throw new Error('Не удалось получить ответ модели. Попробуйте другое фото.');
  }
  return text;
}

export default function WorkAnalysisScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const backgroundColor = theme?.bg || '#0a0f1d';
  const scrollViewRef = useRef<ScrollView>(null);
  const newOrdersCount = useNewOrdersCount();
  
  const [selectedTeeth, setSelectedTeeth] = useState<string[]>([]);
  const [selectedShade, setSelectedShade] = useState<string>("Не указан");
  const [workStage, setWorkStage] = useState<string>("Не указан");
  const [analysisType, setAnalysisType] = useState<string>("Общий анализ работы");
  const [notes, setNotes] = useState<string>("");
  const [image, setImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [currentStatusIndex, setCurrentStatusIndex] = useState<number>(0);
  const [isImageModalVisible, setIsImageModalVisible] = useState<boolean>(false);
  const [resultsY, setResultsY] = useState<number>(0);
  const [alertVisible, setAlertVisible] = useState<boolean>(false);
  const [alertTitle, setAlertTitle] = useState<string>('');
  const [alertMessage, setAlertMessage] = useState<string>('');
  const [diamondBalance, setDiamondBalance] = useState<number>((globalThis as any).getDiamondBalance?.() ?? 0);
  const [constructionType, setConstructionType] = useState<string>('Коронка');
  const [critiqueResult, setCritiqueResult] = useState<{ critique_id: string; status: string; rating: number } | null>(null);
  const [expertModalVisible, setExpertModalVisible] = useState<boolean>(false);
  const [colorScore, setColorScore] = useState<number>(8);
  const [anatomyScore, setAnatomyScore] = useState<number>(8);
  const [marginScore, setMarginScore] = useState<number>(8);
  const [expertComment, setExpertComment] = useState<string>('');
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  const analysisTypeKey = ANALYSIS_TYPE_KEYS[analysisType] || 'general';
  const analysisPrice = ANALYSIS_PRICES[analysisTypeKey];
  const analysisButtonTitle = ANALYSIS_BUTTON_TITLES[analysisTypeKey];

  useEffect(() => {
    setDiamondBalance((globalThis as any).getDiamondBalance?.() ?? 0);
    const prev = (globalThis as any).forceDiamondUpdate;
    (globalThis as any).forceDiamondUpdate = () => {
      setDiamondBalance((globalThis as any).getDiamondBalance?.() ?? 0);
      prev?.();
    };
    return () => { (globalThis as any).forceDiamondUpdate = prev; };
  }, []);

  // Calculate dynamic cost based on teeth count and analysis type
  const calculateAnalysisCost = (): number => {
    const teethCount = selectedTeeth.length;
    const basePrice = ANALYSIS_PRICES[analysisTypeKey] || 3;
    
    // 1 💎: Single tooth, simple analysis
    if (teethCount <= 1 && (analysisTypeKey === 'color_match' || analysisTypeKey === 'fun')) {
      return 1;
    }
    
    // 2 💎: Multiple teeth (2-3), or medium complexity analysis
    if (teethCount <= 3 || analysisTypeKey === 'morphology' || analysisTypeKey === 'symmetry' || analysisTypeKey === 'issues') {
      return 2;
    }
    
    // 3 💎: Many teeth (4+), or high complexity analysis
    if (teethCount >= 4 || analysisTypeKey === 'general' || analysisTypeKey === 'final_check') {
      return 3;
    }
    
    return basePrice;
  };

  const dynamicCost = calculateAnalysisCost();

  const toggleTooth = (tooth: string) => {
    setSelectedTeeth(prev =>
      prev.includes(tooth) ? prev.filter(t => t !== tooth) : [...prev, tooth]
    );
  };

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      setCurrentStatusIndex(0);
      interval = setInterval(() => {
        setCurrentStatusIndex(prev => (prev + 1) % LOADING_STATUSES.length);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    if (analysisResult && scrollViewRef.current && resultsY > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: resultsY, animated: true });
      }, 300);
    }
  }, [analysisResult, resultsY]);

  const setImageFromAsset = (asset: ImagePicker.ImagePickerAsset) => {
    setImage(asset.uri);
    setAnalysisResult(null);
    const b64 = asset.base64;
    if (!b64) {
      setImageBase64(null);
      setAlertTitle('Ошибка');
      setAlertMessage('Не удалось получить данные изображения. Попробуйте выбрать фото снова.');
      setAlertVisible(true);
      return;
    }
    setImageBase64(b64);
    setImageMime(resolveMimeType(asset));
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImageFromAsset(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImageFromAsset(result.assets[0]);
    }
  };

  const uploadWorkImage = async (uri: string): Promise<string | null> => {
    if (uri.startsWith('file://') || uri.startsWith('content://')) {
      return await uploadMediaToServer(uri);
    }
    try {
      const match = uri.match(/^data:image\/(\w+);base64,(.*)$/);
      if (!match) return null;
      const ext = match[1] === 'png' ? 'png' : 'jpg';
      const base64 = match[2];
      const fs = FileSystem as any;
      const tempUri = `${fs.cacheDirectory}work_upload_${Date.now()}.${ext}`;
      await fs.writeAsStringAsync(tempUri, base64, {
        encoding: fs.EncodingType?.Base64 || 'base64',
      });
      const url = await uploadMediaToServer(tempUri);
      try {
        await fs.deleteAsync(tempUri, { idempotent: true });
      } catch {}
      return url;
    } catch (e) {
      console.error('[WorkAnalysis] uploadWorkImage error:', e);
      return null;
    }
  };

  const submitWork = async () => {
    if (!image) {
      setAlertTitle('Ошибка');
      setAlertMessage('Пожалуйста, загрузите фото работы');
      setAlertVisible(true);
      return;
    }

    setIsLoading(true);
    setCritiqueResult(null);

    try {
      const imageUrl = await uploadWorkImage(image);
      if (!imageUrl) {
        setAlertTitle('Ошибка');
        setAlertMessage('Не удалось загрузить фото на сервер');
        setAlertVisible(true);
        setIsLoading(false);
        return;
      }

      const rawUser = await AsyncStorage.getItem('user');
      const userObj = rawUser ? JSON.parse(rawUser) : null;
      const technicianId = userObj?.id || userObj?.email || '';
      const caseId = selectedTeeth.length > 0 ? selectedTeeth.join('-') : `work-${Date.now()}`;

      const response = await fetch('http://62.238.13.160:8000/analysis/work/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technician_id: technicianId,
          case_id: caseId,
          work_image_url: imageUrl,
          construction_type: constructionType,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAlertTitle('Ошибка');
        setAlertMessage(data.detail || `Ошибка сервера ${response.status}`);
        setAlertVisible(true);
        setIsLoading(false);
        return;
      }

      setCritiqueResult({
        critique_id: data.critique_id || '',
        status: 'pending',
        rating: 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось отправить работу';
      setAlertTitle('Ошибка');
      setAlertMessage(message);
      setAlertVisible(true);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const submitExpertEvaluation = async () => {
    if (!critiqueResult?.critique_id) return;
    setIsEvaluating(true);
    try {
      const rawUser = await AsyncStorage.getItem('user');
      const userObj = rawUser ? JSON.parse(rawUser) : null;
      const expertId = userObj?.id || userObj?.email || '';

      const response = await fetch('http://62.238.13.160:8000/analysis/work/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          critique_id: critiqueResult.critique_id,
          expert_id: expertId,
          color_score: colorScore,
          anatomy_score: anatomyScore,
          margin_score: marginScore,
          comment: expertComment.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAlertTitle('Ошибка');
        setAlertMessage(data.detail || `Ошибка сервера ${response.status}`);
        setAlertVisible(true);
        setIsEvaluating(false);
        return;
      }

      setCritiqueResult(prev => prev ? { ...prev, status: data.status || 'reviewed', rating: data.rating || 0 } : null);
      setExpertModalVisible(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось отправить оценку';
      setAlertTitle('Ошибка');
      setAlertMessage(message);
      setAlertVisible(true);
    } finally {
      setIsEvaluating(false);
    }
  };

  const parseAnalysisResult = (result: string) => {
    try {
      // Remove markdown code blocks if present
      const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return parsed;
    } catch (error) {
      console.error('Failed to parse JSON:', error);
      console.log('Сырой ответ от Claude:', result);
      return null;
    }
  };

  const renderCritiqueResult = () => {
    if (!critiqueResult) return null;

    const isReviewed = critiqueResult.status === 'reviewed';

    return (
      <View style={styles.resultContainer}>
        <View style={styles.critiqueCard}>
          <View style={styles.critiqueHeader}>
            <Ionicons name="scan-outline" size={22} color="#f2ca50" />
            <Text style={styles.critiqueTitle}>РАБОТА НА РАЗБОРЕ</Text>
          </View>
          <Text style={styles.critiqueId}>ID: {critiqueResult.critique_id}</Text>
          <View style={[styles.critiqueStatusBadge, isReviewed && styles.critiqueStatusBadgeReviewed]}>
            <Text style={styles.critiqueStatusText}>
              {isReviewed ? 'РАЗОБРАНО' : 'ОЖИДАЕТ ЭКСПЕРТА'}
            </Text>
          </View>
          {isReviewed && (
            <View style={styles.ratingBlock}>
              <Text style={styles.ratingValue}>{critiqueResult.rating.toFixed(1)}</Text>
              <Text style={styles.ratingLabel}>средний балл</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.expertBtn}
            onPress={() => setExpertModalVisible(true)}
          >
            <Text style={styles.expertBtnText}>Оценить как эксперт</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderScoreSelector = (value: number, onSelect: (v: number) => void) => (
    <View style={styles.scoreRow}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
        <TouchableOpacity
          key={s}
          style={[styles.scoreBtn, value === s && styles.scoreBtnActive]}
          onPress={() => onSelect(s)}
        >
          <Text style={[styles.scoreBtnText, value === s && styles.scoreBtnTextActive]}>{s}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ImageBackground
        source={require('@/assets/images/background.png')}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        resizeMode="cover"
      >
        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      {isLoading ? (
        <View style={styles.fullScreenLoader}>
          <LottieView
            source={require('@/assets/images/cyber_head.json')}
            autoPlay
            loop
            style={styles.loaderAnimation}
          />
          <Text style={styles.loaderStatusText}>
            {LOADING_STATUSES[currentStatusIndex]}
          </Text>
        </View>
      ) : (
        <>
          {/* DiLabs Header */}
          <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
            <View style={styles.leftContainer}>
              <TouchableOpacity style={styles.burgerButton}>
                <Ionicons name="menu-outline" size={28} color="#f2ca50" />
              </TouchableOpacity>
            </View>
            <View style={styles.absoluteCenter}>
              <Image
                source={require('@/assets/images/header-logo.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
            </View>
            <View style={styles.rightContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(13,15,20,0.65)', borderWidth: 1, borderColor: '#bda15d', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 5 }}>
                <Ionicons name="diamond" size={12} color="#bda15d" />
                <Text style={{ color: '#bda15d', fontSize: 12, fontWeight: '600' }}>{diamondBalance}</Text>
              </View>
              <TouchableOpacity
                style={styles.bellButton}
                onPress={() => { router.push('/(tabs)/search'); }}
              >
                <Ionicons name="notifications" size={16} color="#bda15d" />
                {newOrdersCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {newOrdersCount > 99 ? '99+' : newOrdersCount.toString()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

      {/* Local Header */}
      <View style={styles.localHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#f2ca50" />
        </TouchableOpacity>
        <Text style={styles.localTitle}>Анализ работы</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} ref={scrollViewRef}>
        {image === null ? (
          <>
            {/* Стартовое меню - если фото не выбрано */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.primaryBtn} onPress={takePhoto} activeOpacity={0.85}>
                <Ionicons name="camera-outline" size={22} color="#031427" />
                <Text style={styles.primaryBtnText}>Сфотографировать</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={pickImage} activeOpacity={0.85}>
                <Ionicons name="images-outline" size={22} color="#f2ca50" />
                <Text style={styles.secondaryBtnText}>Из галереи</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.recommendationsBtn}
              onPress={() => {
                setAlertTitle('Рекомендации для точного результата');
                setAlertMessage('Фотографируйте работу при естественном освещении. Избегайте бликов и теней. Располагайте камеру перпендикулярно поверхности работы.');
                setAlertVisible(true);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.recommendationsBtnText}>
                💡 Рекомендации для точного результата
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Форма с параметрами - если фото выбрано */}
            {/* 1-й БЛОК: Фото работы */}
            <View style={styles.cardBlock}>
              <Text style={styles.blockHeader}>📷 Фото работы</Text>
              <View style={styles.imageButtonsCompact}>
                <TouchableOpacity style={styles.imageButtonCompact} onPress={takePhoto}>
                  <Ionicons name="camera" size={20} color="#f2ca50" />
                  <Text style={styles.imageButtonTextCompact}>Фото</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.imageButtonCompact} onPress={pickImage}>
                  <Ionicons name="image" size={20} color="#f2ca50" />
                  <Text style={styles.imageButtonTextCompact}>Галерея</Text>
                </TouchableOpacity>
              </View>

              {image && (
                <TouchableOpacity onPress={() => setIsImageModalVisible(true)}>
                  <Image source={{ uri: image }} style={styles.previewImageCompact} />
                </TouchableOpacity>
              )}
            </View>

            {/* 2-й БЛОК: Зубная формула */}
            <View style={styles.cardBlock}>
              <View style={styles.sectionHeader}>
                <Text style={styles.blockHeader}>🦷 Зубная формула</Text>
                {selectedTeeth.length > 0 && (
                  <TouchableOpacity onPress={() => setSelectedTeeth([])} style={styles.clearTeethButton}>
                    <Text style={styles.clearTeethText}>Очистить</Text>
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.teethScrollContent}
                style={{ marginBottom: 4 }}
              >
                <View style={styles.teethRowCompact}>
                  {UPPER_TEETH.map(tooth => (
                    <TouchableOpacity
                      key={tooth}
                      style={[
                        styles.toothButtonCompact,
                        selectedTeeth.includes(tooth) && styles.toothButtonSelected
                      ]}
                      onPress={() => toggleTooth(tooth)}
                    >
                      <Text style={[
                        styles.toothTextCompact,
                        selectedTeeth.includes(tooth) && styles.toothTextSelected
                      ]}>{tooth}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.teethScrollContent}
              >
                <View style={styles.teethRowCompact}>
                  {LOWER_TEETH.map(tooth => (
                    <TouchableOpacity
                      key={tooth}
                      style={[
                        styles.toothButtonCompact,
                        selectedTeeth.includes(tooth) && styles.toothButtonSelected
                      ]}
                      onPress={() => toggleTooth(tooth)}
                    >
                      <Text style={[
                        styles.toothTextCompact,
                        selectedTeeth.includes(tooth) && styles.toothTextSelected
                      ]}>{tooth}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {selectedTeeth.length > 0 && (
                <Text style={styles.selectedTeethText}>
                  Выбрано: {selectedTeeth.join(', ')}
                </Text>
              )}
            </View>

            {/* 3-й БЛОК: Параметры анализа */}
            <View style={styles.cardBlock}>
              <Text style={styles.blockHeader}>⚙️ Параметры анализа</Text>
          
          {/* Блок: Заказанный цвет */}
          <View style={styles.parameterBlock}>
            <Text style={styles.parameterBlockLabel}>Заказанный цвет</Text>
            <View style={styles.pickerContainer}>
              {["Не указан", ...VITA_SHADES].map(shade => (
                <TouchableOpacity
                  key={shade}
                  style={[
                    styles.pickerItemCompact,
                    selectedShade === shade && styles.pickerItemSelected
                  ]}
                  onPress={() => setSelectedShade(shade)}
                >
                  <Text style={[
                    styles.pickerTextCompact,
                    selectedShade === shade && styles.pickerTextSelected
                  ]}>{shade}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Блок: Этап работы */}
          <View style={styles.parameterBlock}>
            <Text style={styles.parameterBlockLabel}>Этап работы</Text>
            <View style={styles.pickerContainer}>
              {WORK_STAGES.map(stage => (
                <TouchableOpacity
                  key={stage}
                  style={[
                    styles.pickerItemCompact,
                    workStage === stage && styles.pickerItemSelected
                  ]}
                  onPress={() => setWorkStage(stage)}
                >
                  <Text style={[
                    styles.pickerTextCompact,
                    workStage === stage && styles.pickerTextSelected
                  ]}>{stage}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Блок: Тип конструкции */}
          <View style={styles.parameterBlock}>
            <Text style={styles.parameterBlockLabel}>Тип конструкции</Text>
            <View style={styles.pickerContainer}>
              {CONSTRUCTION_TYPES.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.pickerItemCompact,
                    constructionType === type && styles.pickerItemSelected
                  ]}
                  onPress={() => setConstructionType(type)}
                >
                  <Text style={[
                    styles.pickerTextCompact,
                    constructionType === type && styles.pickerTextSelected
                  ]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
            </View>

            {/* Кнопка запуска */}
            <TouchableOpacity
              style={[styles.analyzeButton, isLoading && styles.analyzeButtonDisabled]}
              onPress={submitWork}
              disabled={isLoading}
            >
              {isLoading ? (
                <View style={styles.fullScreenLoader}>
                  <LottieView
                    source={require('@/assets/images/cyber_head.json')}
                    autoPlay
                    loop
                    style={styles.loaderAnimation}
                  />
                  <Text style={styles.loaderStatusText}>
                    {LOADING_STATUSES[currentStatusIndex]}
                  </Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="cloud-upload-outline" size={20} color="#0a0f1d" />
                  <Text style={styles.analyzeButtonText} numberOfLines={1} adjustsFontSizeToFit>
                    Отправить на экспертный разбор
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {renderCritiqueResult()}
          </>
        )}
      </ScrollView>

      <Modal
        visible={isImageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsImageModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsImageModalVisible(false)}
        >
          {image && <Image source={{ uri: image }} style={styles.modalImage} resizeMode="contain" />}
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setIsImageModalVisible(false)}
          >
            <Ionicons name="close" size={32} color="#f2ca50" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={expertModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setExpertModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.expertModalContent}>
            <View style={styles.expertModalHeader}>
              <Text style={styles.expertModalTitle}>Экспертная оценка</Text>
              <TouchableOpacity onPress={() => setExpertModalVisible(false)}>
                <Ionicons name="close" size={24} color="#f2ca50" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.scoreLabel}>Цвет</Text>
              {renderScoreSelector(colorScore, setColorScore)}

              <Text style={styles.scoreLabel}>Анатомия и морфология</Text>
              {renderScoreSelector(anatomyScore, setAnatomyScore)}

              <Text style={styles.scoreLabel}>Прилегание и маргинальный край</Text>
              {renderScoreSelector(marginScore, setMarginScore)}

              <TextInput
                style={styles.expertCommentInput}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholder="Комментарий эксперта..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={expertComment}
                onChangeText={setExpertComment}
              />

              <TouchableOpacity
                style={[styles.expertSubmitBtn, isEvaluating && styles.expertSubmitBtnDisabled]}
                onPress={submitExpertEvaluation}
                disabled={isEvaluating}
              >
                <Text style={styles.expertSubmitBtnText}>Отправить оценку</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </>
      )}
    </View>
    </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dilabsHeader: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f2ca50',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f2ca50',
  },
  leftContainer: {
    width: 100,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 8,
    width: 100,
  },
  absoluteCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burgerButton: {
    padding: 4,
  },
  headerLogo: {
    width: 180,
    height: 56,
  },
  bellButton: {
    backgroundColor: 'rgba(13, 15, 20, 0.65)',
    borderWidth: 1,
    borderColor: '#bda15d',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#c0392b',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: 'rgba(13,15,20,0.8)',
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  localHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f2ca5030',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f2ca50',
    paddingVertical: 16,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: '#031427',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0a1628',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#f2ca50',
  },
  secondaryBtnText: {
    color: '#f2ca50',
    fontSize: 16,
    fontWeight: '700',
  },
  recommendationsBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#f2ca5060',
    borderRadius: 20,
    backgroundColor: 'transparent',
    marginTop: 40,
  },
  recommendationsBtnText: {
    color: '#f2ca50',
    fontSize: 13,
    opacity: 0.7,
    textAlign: 'center',
  },
  localTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f2ca50',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f2ca5030',
  },
  backButton: {
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f2ca50',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f2ca5030',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f2ca50',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#f2ca50',
    marginBottom: 4,
    marginTop: 6,
  },
  // Parameters block
  parametersBlock: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f2ca5030',
    backgroundColor: '#1a1f2e',
  },
  // Card block style for monolithic cards
  cardBlock: {
    backgroundColor: '#1a1f2e',
    borderWidth: 1,
    borderColor: '#f2ca5050',
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 12,
    marginBottom: 16,
  },
  blockHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f2ca50',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f2ca50',
    marginBottom: 8,
  },
  parameterRow: {
    marginBottom: 6,
  },
  parameterLabel: {
    fontSize: 11,
    color: '#f2ca50',
    marginBottom: 3,
  },
  parameterBlock: {
    backgroundColor: 'rgba(13, 17, 23, 0.6)',
    borderWidth: 1,
    borderColor: '#f2ca5030',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  parameterBlockLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  pickerScroll: {
    marginBottom: 2,
  },
  pickerItemCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#f2ca5050',
    borderRadius: 6,
  },
  pickerTextCompact: {
    fontSize: 11,
    color: '#f2ca50',
  },
  // Teeth compact
  teethScrollContent: {
    paddingHorizontal: 4,
  },
  teethRowCompact: {
    flexDirection: 'row',
  },
  toothButtonCompact: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#f2ca5050',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 3,
  },
  toothButtonSelected: {
    backgroundColor: '#f2ca50',
    borderColor: '#f2ca50',
  },
  toothTextCompact: {
    fontSize: 10,
    color: '#f2ca50',
  },
  toothTextSelected: {
    color: '#0a0f1d',
    fontWeight: 'bold',
  },
  clearTeethButton: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: '#f2ca5030',
    borderRadius: 4,
  },
  clearTeethText: {
    fontSize: 10,
    color: '#f2ca50',
  },
  selectedTeethText: {
    fontSize: 11,
    color: '#4fc3f7',
    marginTop: 4,
  },
  // Image buttons compact
  imageButtonsCompact: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  imageButtonCompact: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderWidth: 1,
    borderColor: '#f2ca50',
    borderRadius: 6,
    marginRight: 6,
  },
  imageButtonTextCompact: {
    color: '#f2ca50',
    marginLeft: 4,
    fontSize: 11,
  },
  previewImageCompact: {
    width: '100%',
    height: 120,
    borderRadius: 6,
  },
  // Text input
  textInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#f2ca5050',
    borderRadius: 6,
    padding: 8,
    color: '#ffffff',
    fontSize: 12,
  },
  // Analyze button
  analyzeButton: {
    backgroundColor: '#f2ca50',
    opacity: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    zIndex: 10,
    elevation: 10,
  },
  analyzeButtonDisabled: {
    opacity: 0.5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzeButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0a0f1d',
    marginLeft: 8,
  },
  fullScreenLoader: {
    flex: 1,
    backgroundColor: '#0B101D',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loaderAnimation: {
    width: 180,
    height: 180,
  },
  loaderStatusText: {
    marginTop: 24,
    fontSize: 16,
    fontWeight: '600',
    color: '#f2ca50',
    textAlign: 'center',
    paddingHorizontal: 32,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  // Result cards
  resultContainer: {
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#f44336',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#1a1f2e',
    borderWidth: 1,
    borderColor: '#f2ca5050',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  cardHeader: {
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0a0f1d',
  },
  cardText: {
    fontSize: 13,
    color: '#ffffff',
    lineHeight: 18,
  },
  subsection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f2ca5030',
  },
  subsectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#f2ca50',
    marginBottom: 2,
  },
  checklistItem: {
    flexDirection: 'column',
    marginBottom: 8,
  },
  checklistBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  checklistBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0a0f1d',
  },
  checklistText: {
    fontSize: 12,
    color: '#ffffff',
    lineHeight: 16,
  },
  verdictCard: {
    backgroundColor: '#0a0f1d',
    borderWidth: 2,
    borderColor: '#f2ca50',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  verdictTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f2ca50',
    marginBottom: 6,
  },
  verdictText: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
  },
  clearButton: {
    backgroundColor: '#f2ca5050',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  clearButtonText: {
    fontSize: 13,
    color: '#f2ca50',
  },
  // Legacy styles (keep for compatibility)
  teethRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  toothButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f2ca5050',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    marginBottom: 6,
  },
  toothText: {
    fontSize: 12,
    color: '#f2ca50',
  },
  imageButtons: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  imageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#f2ca50',
    borderRadius: 8,
    marginRight: 8,
  },
  imageButtonText: {
    color: '#f2ca50',
    marginLeft: 8,
    fontSize: 14,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  label: {
    fontSize: 14,
    color: '#f2ca50',
    marginBottom: 8,
    marginTop: 12,
  },
  pickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#f2ca5050',
    borderRadius: 8,
    marginRight: 8,
  },
  pickerText: {
    fontSize: 14,
    color: '#f2ca50',
  },
  pickerItemSelected: {
    backgroundColor: '#f2ca50',
    borderColor: '#f2ca50',
  },
  pickerTextSelected: {
    color: '#0a0f1d',
    fontWeight: 'bold',
  },
  textArea: {
    height: 80,
    borderWidth: 1,
    borderColor: '#f2ca5050',
    borderRadius: 8,
    padding: 12,
  },
  textAreaPlaceholder: {
    fontSize: 14,
    color: '#f2ca5050',
  },
  critiqueCard: {
    backgroundColor: 'rgba(10, 16, 30, 0.92)',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.45)',
  },
  critiqueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  critiqueTitle: {
    color: '#f2ca50',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  critiqueId: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    marginBottom: 12,
  },
  critiqueStatusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(242, 202, 80, 0.15)',
    borderWidth: 1,
    borderColor: '#f2ca50',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  critiqueStatusBadgeReviewed: {
    backgroundColor: '#f2ca50',
  },
  critiqueStatusText: {
    color: '#f2ca50',
    fontSize: 12,
    fontWeight: '700',
  },
  ratingBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 12,
  },
  ratingValue: {
    color: '#f2ca50',
    fontSize: 32,
    fontWeight: '800',
  },
  ratingLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '500',
  },
  expertBtn: {
    backgroundColor: 'rgba(242, 202, 80, 0.15)',
    borderWidth: 1,
    borderColor: '#f2ca50',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  expertBtnText: {
    color: '#f2ca50',
    fontSize: 14,
    fontWeight: '700',
  },
  expertModalContent: {
    backgroundColor: '#0a0f1d',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f2ca50',
    margin: 20,
    padding: 20,
    maxHeight: '80%',
  },
  expertModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  expertModalTitle: {
    color: '#f2ca50',
    fontSize: 18,
    fontWeight: '700',
  },
  scoreLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scoreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBtnActive: {
    backgroundColor: '#f2ca50',
    borderColor: '#f2ca50',
  },
  scoreBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  scoreBtnTextActive: {
    color: '#0a0f1d',
  },
  expertCommentInput: {
    height: 90,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.4)',
    borderRadius: 12,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    marginTop: 16,
    textAlignVertical: 'top',
  },
  expertSubmitBtn: {
    backgroundColor: '#f2ca50',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  expertSubmitBtnDisabled: {
    opacity: 0.5,
  },
  expertSubmitBtnText: {
    color: '#0a0f1d',
    fontSize: 15,
    fontWeight: '700',
  },
});
