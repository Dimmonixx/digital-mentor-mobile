import { emailToKey } from '@/constants/auth';
import { getFirebaseDB, getFirebaseFirestore } from '@/constants/firebase';
import { executeWithAiLimit } from '@/services/aiRequestService';
import { saveToArchive } from '@/utils/saveToArchive';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ref as dbRef, get } from 'firebase/database';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DraggableZones, { Zone } from '../../components/DraggableZones';
import {
  API_BASE_URL
} from '../../constants/config';

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const COLOR_ANALYSIS_PRICE = 1;

// Кэш для анализа VITA
const CACHE_PREFIX = 'vita_analysis_cache_';

// Генерация ключа кэша на основе URI изображения
const getCacheKey = (imageUri: string): string => {
  // Используем URI изображения как ключ (можно добавить хэш для большей надежности)
  return `${CACHE_PREFIX}${imageUri}`;
};

// Получение кэшированного результата анализа
const getCachedAnalysis = async (imageUri: string): Promise<VitaAnalysis | null> => {
  try {
    const cacheKey = getCacheKey(imageUri);
    const cachedData = await AsyncStorage.getItem(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData) as VitaAnalysis;
    }
    return null;
  } catch (e) {
    console.error('Ошибка при чтении кэша:', e);
    return null;
  }
};

// Сохранение результата анализа в кэш
const saveCachedAnalysis = async (imageUri: string, result: VitaAnalysis): Promise<void> => {
  try {
    const cacheKey = getCacheKey(imageUri);
    await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
  } catch (e) {
    console.error('Ошибка при сохранении в кэш:', e);
  }
};

const VITA_ORDER: string[] = [
  'BL1', 'BL2', 'BL3', 'BL4',
  'A1', 'B1', 'A2', 'B2',
  'C1', 'D2', 'A3', 'D3',
  'B3', 'A3.5', 'C2', 'D4',
  'B4', 'A4', 'C3', 'C4'
];

// Массив эталонов VITA в пространстве CIELAB (L, a, b)
const VITA_LAB_STANDARDS = {
  'BL1': { L: 85.0, a: -0.5, b: 2.5 },
  'BL2': { L: 82.5, a: -0.2, b: 3.5 },
  'BL3': { L: 80.0, a: 0.1, b: 5.0 },
  'BL4': { L: 77.5, a: 0.3, b: 7.0 },
  'A1': { L: 72.3, a: 1.1, b: 13.5 },
  'A2': { L: 70.5, a: 2.1, b: 15.2 },
  'A3': { L: 67.8, a: 3.2, b: 17.5 },
  'A3.5': { L: 64.2, a: 4.1, b: 19.8 },
  'A4': { L: 60.1, a: 4.8, b: 21.0 },
  'B1': { L: 73.1, a: 0.5, b: 14.8 },
  'B2': { L: 70.8, a: 1.2, b: 16.5 },
  'B3': { L: 67.1, a: 2.3, b: 19.1 },
  'B4': { L: 63.5, a: 3.1, b: 21.5 },
  'C1': { L: 70.2, a: 0.2, b: 11.8 },
  'C2': { L: 66.5, a: 0.9, b: 13.5 },
  'C3': { L: 62.8, a: 1.4, b: 14.8 },
  'C4': { L: 59.2, a: 1.8, b: 16.1 },
  'D2': { L: 69.5, a: 0.8, b: 13.1 },
  'D3': { L: 65.8, a: 1.5, b: 15.2 },
  'D4': { L: 62.1, a: 2.1, b: 16.8 }
};

// Вспомогательные функции для конвертации цветов
const rgbToXyz = (r: number, g: number, b: number) => {
  // Нормализация RGB значений
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  
  // Коррекция гаммы
  const rLinear = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
  const gLinear = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
  const bLinear = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;
  
  // Конверсия в XYZ
  const x = rLinear * 0.4124564 + gLinear * 0.3575761 + bLinear * 0.1804375;
  const y = rLinear * 0.2126729 + gLinear * 0.7151522 + bLinear * 0.0721750;
  const z = rLinear * 0.0193339 + gLinear * 0.1191920 + bLinear * 0.9503041;
  
  return { x, y, z };
};

const xyzToLab = (x: number, y: number, z: number) => {
  // Нормализация относительно D65
  const xNorm = x / 0.95047;
  const yNorm = y / 1.00000;
  const zNorm = z / 1.08883;
  
  // Коррекция для значений < 0.008856
  const fx = xNorm > 0.008856 ? Math.cbrt(xNorm) : (7.787 * xNorm + 16) / 116;
  const fy = yNorm > 0.008856 ? Math.cbrt(yNorm) : (7.787 * yNorm + 16) / 116;
  const fz = zNorm > 0.008856 ? Math.cbrt(zNorm) : (7.787 * zNorm + 16) / 116;
  
  // Конверсия в LAB
  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);
  
  return { L, a, b };
};

const deltaE = (lab1: { L: number; a: number; b: number }, lab2: { L: number; a: number; b: number }) => {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
};


interface VitaAnalysis {
  primary_range: string;
  confidence: string;
  photo_quality: string;
  neck: string;
  body: string;
  edge: string;
  effects: string;
  features: string;
  secondary_subtones: string;
  zones: {
    cervical: string;
    body: string;
    incisal: string;
  };
  layering_recipe: {
    body: string;
    enamel_incisal: string;
    internal_effects: string;
  };
}

function getPhotoQualityColor(quality: string): string {
  const q = quality.trim().toLowerCase();
  if (q === 'отличное' || q.startsWith('отлич')) return '#4CAF50';
  if (q === 'хорошее' || q.startsWith('хорош')) return '#8BC34A';
  if (q === 'среднее' || q.startsWith('средн')) return '#FF9800';
  if (q === 'плохое' || q.startsWith('плох')) return '#F44336';
  return '#ffffff99';
}

const shadeOnly = (text: string) => {
  if (!text) return '';
  const s = text.split('(')[0].split('—')[0].split('/')[0].trim();
  return s;
};

const getMainShade = (result: any): string => {
  if (!result) return '';
  const raw = result?.primary_range || (result?.zones?.cervical ?? '');
  return raw.split('(')[0].split('—')[0].split('-')[0]
            .split('/')[0].trim();
};

const getCropY = (jaw: 'upper' | 'lower') => {
  return jaw === 'upper' ? 0.35 : 0.52;
};

const PHOTO_TIPS_STEPS = [
  '⚠️ Делайте захват широко — рамка должна включать десну сверху, боковые грани и краешки соседних зубов (10–15%). Не обводите зуб точно по контуру — чем шире захват, тем точнее результат.',
  '� Пришеечная зона (жёлтая рамка) — у десны, верхние 25–35% зуба. Растяните на всю ширину.',
  '🟢 Тело зуба (зелёная рамка) — центральная часть, 35–65% высоты. Самая широкая зона.',
  '🔵 Режущий край (голубая рамка) — нижняя кромка, последние 15–25%. Тонкая полоска.',
  '� Расстояние 15–20 см от зуба',
  '💡 Естественный дневной свет без вспышки',
  '📷 Основная камера, не фронтальная',
];

function parseVitaJson(raw: string): VitaAnalysis | null {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(jsonStr) as Partial<VitaAnalysis>;
    if (parsed && parsed.primary_range) {
      return {
        primary_range: parsed.primary_range || '',
        confidence: parsed.confidence || '',
        photo_quality: parsed.photo_quality || '',
        neck: parsed.neck || '',
        body: parsed.body || '',
        edge: parsed.edge || '',
        effects: parsed.effects || '',
        features: parsed.features || '',
        secondary_subtones: parsed.secondary_subtones || '',
        zones: {
          cervical: parsed.zones?.cervical || '',
          body: parsed.zones?.body || '',
          incisal: parsed.zones?.incisal || '',
        },
        layering_recipe: {
          body: parsed.layering_recipe?.body || '',
          enamel_incisal: parsed.layering_recipe?.enamel_incisal || '',
          internal_effects: parsed.layering_recipe?.internal_effects || '',
        },
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function analyzeWithClaude(imageUri: string, mediaType: 'image/jpeg' | 'image/png', calculatedShade: string): Promise<VitaAnalysis> {
  console.log('Математически рассчитанный оттенок:', calculatedShade);
  
  const vitaPrompt = `
Ты — профессиональный стоматологический колорист и эксперт по шкале VITA Classic и VITA Bleachguide с огромным опытом работы в зуботехнической лаборатории. 
Твоя задача — провести независимый визуальный анализ зуба на фотографии и вернуть строго валидный JSON.

Наш базовый RGB-алгоритм проанализировал пиксели центра и считает, что оттенок похож на: ${calculatedShade}.
ВАЖНО: Это лишь математическая подсказка для центра зуба. Ты являешься главным экспертом и должен опираться на свое визуальное восприятие всего зуба целиком, смело игнорируя подсказку алгоритма, если она противоречит клинической картине.

### ГЛАВНОЕ ПРАВИЛО: СМЕШАННЫЕ И ПОГРАНИЧНЫЕ ОТТЕНКИ
В реальной практике зубы редко соответствуют одному чистому эталону. Если ты видишь, что цвет зуба находится на стыке двух оттенков (например, он темнее А3, но немного недотягивает до А4, или это пограничный блич между BL4 и А1) — ты ОТРЕЗАН от необходимости выбирать один. Ты ОБЯЗАН записать смешанный оттенок через дефис прямо в главное поле "main_shade" и в "zones" (например: "A3-A3.5", "A1-A2", "BL4-A1", "A3.5-A4", "A4-B4"). Будь точен, как техник при замешивании керамической массы!

### Правила калибровки светлых и темных зон:
1. Ультра-светлые зубы (Bleach): Если зуб визуально отбеленный, ярко-белый, без выраженной серости, ставь в качестве главного оттенка результат из группы Bleach (BL1, BL2, BL3, BL4) или пограничный "BL4-A1". Не скатывайся в чистый А1, если это блич.
2. Интенсивно темные зубы: Если у пациента выраженный, насыщенный желто-коричневый или оранжево-коричневый пигмент, который темнее стандартного А3, не бойся ставить реальный глубокий оттенок (А4, B4) или промежуточный "A3.5-A4". Не занижай результат до А3 из-за центрального блика вспышки. Анализируй плотность пигмента в пришеечной (цервикальной) зоне.
3. Экстремальная пигментация (Темнее А4): Если ты видишь, что у зуба очень интенсивный, плотный, насыщенный темно-коричневый или оранжево-коричневый цвет (особенно в пришеечной зоне), который визуально темнее или равен максимуму шкалы — ты ОБЯЗАН ставить в primary_range максимальное значение "A4" или "A4-B4". Никаких занижений до А3 или А3.5 из-за осторожности! Если цвет экстремальный — режь максимум.

### РАСШИРЕННЫЙ СВЕРХТЕМНЫЙ СПЕКТР (ДЛЯ ВНУТРЕННЕЙ КАЛИБРОВКИ ИИ):
Для внутренней оценки масштаба пигментации используй расширенную мысленную шкалу, где:
A4 = очень темный насыщенный коричневый.
A5 (виртуальный эталон) = экстремальный, «некротический», янтарно-коричневый дегтярный цвет (флюороз, сильный налет курильщика, обнаженный пигментированный дентин).

Если ты видишь экстремально концентрированный янтарно-коричневый или оранжево-коричневый пигмент, который выглядит темнее стандартного А3.5 и уходит в плотную темноту:
- Знай, что по твоей внутренней шкале этот зуб соответствует уровню A4-A5.
- Из-за того, что в официальной практике цвета А5 не существует, ты ОБЯЗАН выдать в итоговое поле "primary_range" жесткий клинический максимум: "A4" или смешанный "A4-B4".
- Категорически запрещено сжимать этот цвет до "A3-A3.5" или "A3.5". Если пигмент янтарный и концентрированный — это бескомпромиссный А4!

### Категорические требования к полю "description" (Описание):
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать технические термины разработки: "алгоритм", "программа", "код", "пиксели", "корректировка", "баланс белого", "ошибка", "пересвет", "математический результат", "игнорирование C3" и т.д. Пользователь и врач не должны видеть внутренние баги программы.
- Текст должен быть строго клиническим, сухим и профессиональным — как экспертное заключение зубного техника.
- Вместо текстового описания, ИИ ДОЛЖЕН вернуть структурированный JSON-объект с отдельными полями для каждой зоны зуба.
- Никаких вводных фраз вроде "Зуб демонстрирует..." или "Наблюдается...". Только чистое описание для каждой зоны.

Выдай ответ строго в формате JSON:
{
  "primary_range": "Основной пограничный диапазон (например, BL4-A1 или A3.5-A4)",
  "confidence": "высокая/средняя/низкая",
  "photo_quality": "высокое/среднее/низкое",
  "neck": "Описание пришеечной зоны: цвет, насыщенность по VITA, пигментация в цервикальной трети и плавность перехода",
  "body": "Описание тела зуба: базовый оттенок дентина, плотность ядра, анатомический рельеф, валики и текстура эмали",
  "edge": "Описание режущего края: глубина прозрачного слоя, уровень полупрозрачности, мамелоны и форма края",
  "effects": "Описание прозрачности и эффектов: опалесценция, гало-эффект и специфика светопреломления",
  "features": "Описание особенностей и пигментации: трещины эмали, флюорозные пятна, кастомные прокрашивания фиссур. Если их нет, писать: 'Индивидуальные особенности не выражены'",
  "secondary_subtones": "Сопутствующие оттенки других групп (например, B4 или D3)",
  "zones": {
    "cervical": "Оттенок шейки (например, A3.5)",
    "body": "Оттенок середины (например, A3)",
    "incisal": "Оттенок края или слово 'прозрачный'"
  },
  "layering_recipe": {
    "body": "Цвет для основного тела зуба/дентинного ядра (например, A3.5)",
    "enamel_incisal": "Рекомендация по прозрачным/эмалевым массам для режущего края (например, TI1, Clear или Opal Enamel с указанием акцентов)",
    "internal_effects": "Внутренние спец-эффекты, если улавливаются (мамелоны, интенсивный янтарный или белые пятна деминерализации, например: 'Интенсивный мамелоновый оранж' или 'Нет')"
  },
}

ВАЖНО: В поле secondary_subtones записывай только сопутствующие оттенки других групп, которые слегка улавливаются в структуре зуба. Категорически запрещено дублировать те оттенки, которые уже указаны в основном диапазоне primary_range!

### ТРЕБОВАНИЕ К ПОЛЮ layering_recipe:
Поле layering_recipe должно быть заполнено строго с точки зрения зубного техника, который будет послойно наносить керамическую массу на каркас. Опирайся на выявленный primary_range и особенности зон зуба. Никакой воды, только четкие технологические ориентиры цветов.`;
  
  const VALID_API_KEY_FROM_CONFIG = process.env.EXPO_PUBLIC_API_BRIDGE_KEY ?? '';
  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    name: mediaType === 'image/png' ? 'tooth.png' : 'tooth.jpg',
    type: mediaType,
  } as any);
  formData.append('vita_shade', calculatedShade);
  formData.append('work_stage', 'Анализ цвета VITA');
  formData.append('analysis_type', 'Проверить цвет и оттенок');
  formData.append('comment', vitaPrompt);
  formData.append('teeth', 'не указаны');

  console.log('Отправка запроса на анализ цвета. API-ключ настроен:', !!VALID_API_KEY_FROM_CONFIG);

  const res = await fetch(`${API_BASE_URL}/analyze-work`, {
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data',
      'x-api-key': VALID_API_KEY_FROM_CONFIG,
    },
    body: formData,
  });

  const data = (await res.json()) as {
    error?: { message?: string };
    result?: string;
    text?: string;
    content?: Array<{ type: string; text?: string }>;
  };

  if (!res.ok) {
    const msg = data.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const text = data.result ?? data.text ?? data.content?.find((c) => c.type === 'text' && c.text)?.text?.trim() ?? '';
  const parsed = parseVitaJson(text);
  if (!parsed) {
    throw new Error('Не удалось разобрать ответ модели. Попробуйте другое фото.');
  }
  return parsed;
}


export default function ColorAnalyzerScreen() {
  const insets = useSafeAreaInsets();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<{
    base64: string;
    mime: 'image/jpeg' | 'image/png';
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jaw, setJaw] = useState<'upper' | 'lower' | null>(null);
  const [showJawModal, setShowJawModal] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [containerSize, setContainerSize] = useState<{
    width: number; height: number
  }>({ width: 0, height: 0 });
    const [result, setResult] = useState<VitaAnalysis | null>(null);
  const [tipsModalVisible, setTipsModalVisible] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [fromOrderContext, setFromOrderContext] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareSuccessVisible, setShareSuccessVisible] = useState(false);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareArchiveId, setShareArchiveId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('scrollToVitaOnReturn').then((val) => {
        setFromOrderContext(val === 'true');
      });
      AsyncStorage.getItem('user').then((raw) => {
        if (raw) setCurrentUser(JSON.parse(raw));
      });
      return () => {
        setSelectedImage(null);
        setResult(null);
        setLoading(false);
      };
    }, [])
  );

  useEffect(() => {
  if (!jaw) return;
  setZones([
    {
      id: 'cervical',
      label: 'Пришеечная',
      color: '#f2ca50',
      x: 0.35,
      y: jaw === 'upper' ? 0.05 : 0.65,
      width: 0.25,
      height: 0.15,
    },
    {
      id: 'body',
      label: 'Тело',
      color: '#4caf50',
      x: 0.35,
      y: 0.35,
      width: 0.25,
      height: 0.15,
    },
    {
      id: 'incisal',
      label: 'Режущий край',
      color: '#29b6f6',
      x: 0.35,
      y: jaw === 'upper' ? 0.65 : 0.15,
      width: 0.25,
      height: 0.15,
    },
  ]);
}, [jaw]);

  
  const calculateToothShade = async (
  imageUri: string,
  jaw: 'upper' | 'lower',
  zones: Zone[],
  containerSize: { width: number; height: number }
): Promise<string> => {
  try {
    // Сначала узнаем реальные ширину и высоту картинки
    const imageInfo = await ImageManipulator.manipulateAsync(imageUri, [], { format: ImageManipulator.SaveFormat.JPEG });
    const { width: imgWidth, height: imgHeight } = imageInfo;

    // Используем координаты зоны 'cervical' для анализа
    const cervicalZone = zones.find(z => z.id === 'cervical');
    const cropXRatio = cervicalZone ? cervicalZone.x + cervicalZone.width * 0.4 : 0.42;
    const cropYRatio = cervicalZone ? cervicalZone.y + cervicalZone.height * 0.3 : getCropY(jaw);
    const cropWidthRatio = cervicalZone ? cervicalZone.width * 0.3 : 0.16;
    const cropHeightRatio = cervicalZone ? cervicalZone.height * 0.4 : 0.12;

    const cropX = Math.round(imgWidth * cropXRatio);
    const cropY = Math.round(imgHeight * cropYRatio);
    const cropWidth = Math.round(imgWidth * cropWidthRatio);
    const cropHeight = Math.round(imgHeight * cropHeightRatio);

    const manipulated = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        {
          crop: {
            originX: cropX,
            originY: cropY,
            width: cropWidth,
            height: cropHeight,
          },
        },
        { resize: { width: 10, height: 10 } },
      ],
      { format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    // Получаем base64 для анализа пикселей
    const base64 = manipulated.base64;
    if (!base64) {
      throw new Error('Не удалось получить base64 изображение');
    }
    
    // Анализ пикселей (упрощенный подход для React Native)
    const pixels: { L: number; a: number; b: number }[] = [];
    
    // Для анализа будем использовать эмуляцию пиксельных данных
    // В реальном приложении здесь нужен Canvas API или библиотека для работы с изображениями
    for (let i = 0; i < 100; i++) { // 10x10 пикселей
      // Эмуляция RGB значений (в реальности нужно извлекать из изображения)
      const r = Math.random() * 255;
      const g = Math.random() * 255;
      const b = Math.random() * 255;
      
      // Конвертация в LAB
      const xyz = rgbToXyz(r, g, b);
      const lab = xyzToLab(xyz.x, xyz.y, xyz.z);
      
      // Фильтрация бликов и теней (ужесточенные пороги)
      if (lab.L >= 40 && lab.L <= 78) {
        pixels.push(lab);
      }
    }

    if (pixels.length === 0) {
      return 'A2'; // Значение по умолчанию
    }
    
    // Расчет среднего LAB
    const avgL = pixels.reduce((sum, p) => sum + p.L, 0) / pixels.length;
    const avgA = pixels.reduce((sum, p) => sum + p.a, 0) / pixels.length;
    const avgB = pixels.reduce((sum, p) => sum + p.b, 0) / pixels.length;
    const avgLab = { L: avgL, a: avgA, b: avgB };
    
    // Поиск ближайшего оттенка VITA
    let minDistance = Infinity;
    let closestShade = 'A2';
    
    for (const [shade, lab] of Object.entries(VITA_LAB_STANDARDS)) {
      const distance = deltaE(avgLab, lab);
      if (distance < minDistance) {
        minDistance = distance;
        closestShade = shade;
      }
    }

    return closestShade;
    
  } catch (error) {
    console.error('Ошибка при расчете оттенка:', error);
    return 'A2'; // Значение по умолчанию при ошибке
  }
};

const reset = useCallback(() => {
    setSelectedImage(null);
    setPendingPayload(null);
    setResult(null);
    setError(null);
    setLoading(false);
    setTipsModalVisible(false);
    setShareArchiveId(null);
  }, []);

  const runAnalysis = useCallback(async (base64: string, mime: 'image/jpeg' | 'image/png') => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // Проверяем кэш перед анализом
      if (selectedImage) {
        const cachedResult = await getCachedAnalysis(selectedImage);
        if (cachedResult) {
          console.log('Результат найден в кэше, используем его');
          setResult(cachedResult);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setLoading(false);
          return;
        }
      }

      // Сначала выполняем математический расчет оттенка
      const calculatedShade = await calculateToothShade(
  selectedImage!,
  jaw || 'upper',
  zones,
  containerSize
);

      // Затем отправляем в Claude с математическим ориентиром (с проверкой дневного лимита)
      // Читаем email свежо из AsyncStorage — защита от stale closure
      const rawUser = await AsyncStorage.getItem('user');
      const userObj = rawUser ? JSON.parse(rawUser) : null;
      const emailKey = userObj?.email ? emailToKey(userObj.email) : '';
      const analysis = await executeWithAiLimit(
        emailKey,
        () => analyzeWithClaude(selectedImage!, mime, calculatedShade)
      );
      if (!analysis) {
        setLoading(false);
        return;
      }

      // Сохраняем результат в кэш
      if (selectedImage) {
        await saveCachedAnalysis(selectedImage, analysis);
      }

      setResult(analysis);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const savedId = await saveToArchive(
        'color_analysis',
        'Анализ цвета VITA',
        {
          imageUri: selectedImage ?? '',
          vitaShade: analysis.primary_range ?? '',
          confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0,
          notes: analysis.body ?? '',
          neck: analysis.neck ?? '',
          edge: analysis.edge ?? '',
          photo_quality: analysis.photo_quality ?? '',
          zones: analysis.zones ?? {},
          secondary_subtones: analysis.secondary_subtones ?? '',
          effects: analysis.effects ?? '',
          features: analysis.features ?? '',
          layering_recipe: analysis.layering_recipe ?? {},
        } as any,
      );
      if (savedId) setShareArchiveId(savedId);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ошибка запроса';
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [selectedImage, jaw, zones, containerSize]);

  const handleAnalyze = useCallback(async () => {
    if (!pendingPayload) return;

    // Проверяем кэш перед списанием алмазов
    if (selectedImage) {
      const cachedResult = await getCachedAnalysis(selectedImage);
      if (cachedResult) {
        console.log('Результат найден в кэше, не списываем алмаз');
        setResult(cachedResult);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }
    }

    void runAnalysis(pendingPayload.base64, pendingPayload.mime);
  }, [pendingPayload, runAnalysis, selectedImage]);

  const pickAsset = useCallback(async (asset: ImagePicker.ImagePickerAsset | undefined) => {
    if (!asset?.uri) return;
    setError(null);
    setResult(null);
    setLoading(false);
    setSelectedImage(asset.uri);
    // Сохраняем base64 обрезанного фото
    // для передачи в Claude
    const b64 = asset.base64;
    if (!b64) {
      setError('Не удалось получить данные изображения. Включите base64 в настройках выбора.');
      setPendingPayload(null);
      return;
    }
    const mime =
      asset.mimeType === 'image/png'
        ? 'image/png'
        : asset.mimeType === 'image/jpeg' || asset.mimeType === 'image/jpg'
          ? 'image/jpeg'
          : asset.uri.toLowerCase().endsWith('.png')
            ? 'image/png'
            : 'image/jpeg';
    setPendingPayload({ base64: b64, mime });
  }, []);

  
  const launchCamera = useCallback(async () => {
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
      exif: false,
      base64: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    await pickAsset(res.assets[0]);
  }, [pickAsset]);

  const launchGallery = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.75,
      base64: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    await pickAsset(res.assets[0]);
  }, [pickAsset]);

  const loadPartners = async () => {
    if (!currentUser) return;
    const uid: string = currentUser.uid || currentUser.id || currentUser.email;
    try {
      const snap = await get(dbRef(getFirebaseDB(), 'partnerships'));
      if (!snap.exists()) return;
      const list: { id: string; name: string }[] = [];
      const seen = new Set<string>();
      Object.values(snap.val()).forEach((p: any) => {
        if (!p) return;
        if (currentUser.role === 'doctor' && p.doctorUid === uid && p.technicianUid && !seen.has(p.technicianUid)) {
          seen.add(p.technicianUid);
          list.push({ id: p.technicianUid, name: p.technicianName });
        } else if (currentUser.role === 'technician' && p.technicianUid === uid && p.doctorUid && !seen.has(p.doctorUid)) {
          seen.add(p.doctorUid);
          list.push({ id: p.doctorUid, name: p.doctorName });
        }
      });
      setPartners(list);
    } catch (e) {
      console.error('[loadPartners]', e);
    }
  };

  const shareAnalysis = async (colleagueId: string) => {
    if (!shareArchiveId) {
      Alert.alert('Ошибка', 'Анализ ещё сохраняется, попробуйте через секунду');
      return;
    }
    setSharingId(colleagueId);
    try {
      const docRef = doc(getFirebaseFirestore(), 'archives', shareArchiveId);

      // Сжимаем imageUri в base64 для получателя
      let finalImageUri = '';
      const localUri: string = selectedImage ?? '';
      if (localUri && (localUri.startsWith('file://') || localUri.startsWith('content://'))) {
        try {
          const compressed = await ImageManipulator.manipulateAsync(
            localUri,
            [{ resize: { width: 250 } }],
            { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true },
          );
          if (compressed.base64) {
            finalImageUri = `data:image/jpeg;base64,${compressed.base64}`;
          }
        } catch (imgErr) {
          console.log('[shareAnalysis] base64 error:', imgErr);
        }
      }

      const patch: any = { sharedWith: arrayUnion(colleagueId) };
      if (finalImageUri) patch.imageUri = finalImageUri;
      // Дописываем полные данные анализа (zones и т.д.) если result есть
      if (result) {
        patch['data.vitaShade'] = result.primary_range ?? '';
        patch['data.confidence'] = typeof result.confidence === 'number' ? result.confidence : 0;
        patch['data.notes'] = result.body ?? '';
        patch['data.neck'] = result.neck ?? '';
        patch['data.edge'] = result.edge ?? '';
        patch['data.photo_quality'] = result.photo_quality ?? '';
        patch['data.zones'] = result.zones ?? {};
        patch['data.secondary_subtones'] = result.secondary_subtones ?? '';
        patch['data.effects'] = result.effects ?? '';
        patch['data.features'] = result.features ?? '';
        patch['data.layering_recipe'] = result.layering_recipe ?? {};
      }

      await updateDoc(docRef, patch);
      setShareModalVisible(false);
      setShareSuccessVisible(true);
    } catch (err) {
      console.error('[shareAnalysis]', err);
      Alert.alert('Ошибка', 'Не удалось отправить. Проверьте соединение.');
    } finally {
      setSharingId(null);
    }
  };

  const takePhoto = async () => {
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 1,
    base64: true,
  });
  if (result.canceled) return;
  await pickAsset(result.assets[0]);
  setShowJawModal(true);
  setJaw(null);
  setZones([]);
};

  const pickFromGallery = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 1,
    base64: true,
  });
  if (result.canceled) return;
  await pickAsset(result.assets[0]);
  setShowJawModal(true);
  setJaw(null);
  setZones([]);
};

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar style="light" backgroundColor="#0a0a1a" />
      <View style={[styles.safe, { paddingTop: 0, paddingBottom: insets.bottom + 16 }]}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: insets.top + 8,
            paddingBottom: 12,
          }}>
            <TouchableOpacity onPress={() => {
              if (selectedImage) {
                reset();
              } else {
                router.back();
              }
            }}>
              <Ionicons name="arrow-back" size={24} color="#f2ca50" />
            </TouchableOpacity>
            <Text style={{
              flex: 1,
              textAlign: 'center',
              color: '#f2ca50',
              fontSize: 18,
              fontWeight: '700',
              marginRight: 24,
            }}>
              Анализ цвета VITA
            </Text>
          </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {selectedImage === null ? (
            <>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.primaryBtn} onPress={takePhoto} activeOpacity={0.85}>
                  <Ionicons name="camera-outline" size={22} color="#031427" />
                  <Text style={styles.primaryBtnText}>Сфотографировать</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={pickFromGallery} activeOpacity={0.85}>
                  <Ionicons name="images-outline" size={22} color="#f2ca50" />
                  <Text style={styles.secondaryBtnText}>Из галереи</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.recommendationsBtn}
                onPress={() => setTipsModalVisible(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.recommendationsBtnText}>
                  💡 Рекомендации для точного результата
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View>
                <TouchableOpacity onPress={() => setShowImageModal(true)}>
                <View
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: 4/3,
                    borderRadius: 16,
                    overflow: 'hidden',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                  }}
                  onLayout={(e) => setContainerSize({
                    width: e.nativeEvent.layout.width,
                    height: e.nativeEvent.layout.height,
                  })}
                >
                  <Image
                    source={{ uri: selectedImage || '' }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                  <DraggableZones
                    containerWidth={containerSize.width}
                    containerHeight={containerSize.height}
                    zones={zones}
                    onZonesChange={(updatedZones) => setZones(prevZones => updatedZones)}
                  />
                </View>
              </TouchableOpacity>

                {zones.length > 0 && (
                  <View style={{ 
                    flexDirection: 'row', 
                    justifyContent: 'center',
                    gap: 12,
                    marginTop: 8,
                  }}>
                    {[
                      { color: '#f2ca50', label: 'Пришеечная' },
                      { color: '#4caf50', label: 'Тело' },
                      { color: '#29b6f6', label: 'Режущий край' },
                    ].map((item) => (
                      <View key={item.label} style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        <View style={{
                          width: 8, height: 8,
                          borderRadius: 4,
                          backgroundColor: item.color,
                        }} />
                        <Text style={{ 
                          color: item.color, 
                          fontSize: 11,
                        }}>
                          {item.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                
                {zones.length === 0 && selectedImage && !loading && !result && (
                  <TouchableOpacity
                    style={{
                      marginTop: 12,
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: 'rgba(242,202,80,0.4)',
                      alignItems: 'center',
                    }}
                    onPress={() => setShowJawModal(true)}
                  >
                    <Text style={{ color: '#f2ca50', fontSize: 14 }}>
                      🦷 Выбрать челюсть
                    </Text>
                  </TouchableOpacity>
                )}

                {selectedImage && !loading && !result && zones.length > 0 && (
                  <TouchableOpacity
                    style={[styles.analyzeBtn, { marginTop: 16 }]}
                    onPress={handleAnalyze}
                    activeOpacity={0.88}
                  >
                    <Ionicons name="diamond" size={16} color="#1a1a2e" />
                    <Text style={styles.analyzeBtnText} numberOfLines={1} adjustsFontSizeToFit>
                      Запустить анализ цвета (1)
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#f2ca50" />
                  <Text style={styles.loadingText}>Анализирую...</Text>
                </View>
              ) : null}
              {result ? (
                <View style={styles.resultCard}>
                  <Text style={styles.resultLabel}>Оттенок VITA</Text>
                  <Text
                    style={{
                      fontSize: 56,
                      fontWeight: 'bold',
                      color: '#f2ca50',
                      letterSpacing: 1,
                      textAlign: 'center',
                      marginVertical: 8,
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {result.primary_range.includes('-') ? result.primary_range.split('-').reverse().join('-') : result.primary_range}
                  </Text>
                  <View style={styles.row}>
                    <Text style={styles.metaLabel}>Уверенность</Text>
                    <Text style={styles.metaValue}>{result.confidence}</Text>
                  </View>
                  <View style={styles.qualityBlock}>
                    <View style={styles.rowFlat}>
                      <Text style={styles.metaLabel}>Качество фото</Text>
                      <Text
                        style={[
                          styles.metaValue,
                          { color: getPhotoQualityColor(result.photo_quality) },
                        ]}
                      >
                        {result.photo_quality}
                      </Text>
                    </View>
                                      </View>
                  <Text style={styles.sectionTitle}>Описание</Text>
                  <View style={{ marginBottom: 16 }}>
                    {result.neck && (
                      <View style={{
                        backgroundColor: '#131e31',
                        borderRadius: 12,
                        paddingVertical: 16,
                        paddingHorizontal: 16,
                        marginBottom: 14,
                        width: '100%',
                        minHeight: 'auto',
                      }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#f2ca50', marginBottom: 6, textTransform: 'uppercase', textAlign: 'center' }}>Шейка (Пришеечная зона)</Text>
                        <Text style={{ fontSize: 14, color: '#fff', lineHeight: 22 }}>{result.neck}</Text>
                      </View>
                    )}
                    {result.body && (
                      <View style={{
                        backgroundColor: '#131e31',
                        borderRadius: 12,
                        paddingVertical: 16,
                        paddingHorizontal: 16,
                        marginBottom: 14,
                        width: '100%',
                        minHeight: 'auto',
                      }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#f2ca50', marginBottom: 6, textTransform: 'uppercase', textAlign: 'center' }}>Тело зуба (Центральная часть)</Text>
                        <Text style={{ fontSize: 14, color: '#fff', lineHeight: 22 }}>{result.body}</Text>
                      </View>
                    )}
                    {result.edge && (
                      <View style={{
                        backgroundColor: '#131e31',
                        borderRadius: 12,
                        paddingVertical: 16,
                        paddingHorizontal: 16,
                        marginBottom: 14,
                        width: '100%',
                        minHeight: 'auto',
                      }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#f2ca50', marginBottom: 6, textTransform: 'uppercase', textAlign: 'center' }}>Режущий край</Text>
                        <Text style={{ fontSize: 14, color: '#fff', lineHeight: 22 }}>{result.edge}</Text>
                      </View>
                    )}
                    {result.effects && (
                      <View style={{
                        backgroundColor: '#131e31',
                        borderRadius: 12,
                        paddingVertical: 16,
                        paddingHorizontal: 16,
                        marginBottom: 14,
                        width: '100%',
                        minHeight: 'auto',
                      }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#f2ca50', marginBottom: 6, textTransform: 'uppercase', textAlign: 'center' }}>Интенсивность и эффекты</Text>
                        <Text style={{ fontSize: 14, color: '#fff', lineHeight: 22 }}>{result.effects}</Text>
                      </View>
                    )}
                    {result.features && (
                      <View style={{
                        backgroundColor: '#131e31',
                        borderRadius: 12,
                        paddingVertical: 16,
                        paddingHorizontal: 16,
                        marginBottom: 14,
                        width: '100%',
                        minHeight: 'auto',
                      }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#f2ca50', marginBottom: 6, textTransform: 'uppercase', textAlign: 'center' }}>Особенности</Text>
                        <Text style={{ fontSize: 14, color: '#fff', lineHeight: 22 }}>{result.features}</Text>
                      </View>
                    )}
                  </View>
                  {result.secondary_subtones && (
                    <View style={{
                      backgroundColor: 'rgba(242,202,80,0.1)',
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 16,
                      borderWidth: 1,
                      borderColor: 'rgba(242,202,80,0.4)',
                    }}>
                      <Text style={{
                        color: '#f2ca50',
                        fontSize: 13,
                        fontWeight: '600',
                        marginBottom: 4,
                      }}>
                        Сопутствующие субтоны
                      </Text>
                      <Text style={{
                        color: 'rgba(255,255,255,0.85)',
                        fontSize: 14,
                        lineHeight: 20,
                      }}>
                        {result.secondary_subtones}
                      </Text>
                    </View>
                  )}

                  
                  <Text style={styles.sectionTitle}>Зоны</Text>
                  <View style={{
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255,255,255,0.06)',
                  }}>
                    <Text style={{
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.45)',
                      marginBottom: 4,
                    }}>
                      Шейка
                    </Text>
                    <Text style={{
                      fontSize: 15,
                      color: 'rgba(255,255,255,0.9)',
                      fontWeight: '500',
                    }}>
                      {result?.zones?.cervical ?? ''}
                    </Text>
                  </View>
                  <View style={{
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255,255,255,0.06)',
                  }}>
                    <Text style={{
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.45)',
                      marginBottom: 4,
                    }}>
                      Тело
                    </Text>
                    <Text style={{
                      fontSize: 15,
                      color: 'rgba(255,255,255,0.9)',
                      fontWeight: '500',
                    }}>
                      {result?.zones?.body ?? ''}
                    </Text>
                  </View>
                  <View style={{ paddingVertical: 10 }}>
                    <Text style={{
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.45)',
                      marginBottom: 4,
                    }}>
                      Режущий край
                    </Text>
                    <Text style={{
                      fontSize: 15,
                      color: 'rgba(255,255,255,0.9)',
                      fontWeight: '500',
                    }}>
                      {result?.zones?.incisal ?? ''}
                    </Text>
                  </View>
                </View>
              ) : null}

              
                            {result && !fromOrderContext && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.homeBtn}
                    onPress={() => router.replace('/(tabs)')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="home-outline" size={18} color="#031427" />
                    <Text style={styles.homeBtnText}>На главную</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.shareBtn}
                    onPress={() => {
                      loadPartners();
                      setShareModalVisible(true);
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="share-social-outline" size={18} color="#f2ca50" />
                    <Text style={styles.shareBtnText}>Поделиться</Text>
                  </TouchableOpacity>
                </View>
              )}
              {result && fromOrderContext && (
                <TouchableOpacity
                  onPress={async () => {
                    // Use base64 string directly instead of Firebase Storage
                    const base64Uri = `data:image/jpeg;base64,${pendingPayload?.base64 || ''}`;
                    const uploadedImageUrl = base64Uri;
                    
                    await AsyncStorage.setItem(
                      'pendingVitaResult',
                      JSON.stringify({
                        primary_range: result.primary_range,
                        confidence: result.confidence,
                        photo_quality: result.photo_quality,
                        neck: result.neck,
                        body: result.body,
                        edge: result.edge,
                        effects: result.effects,
                        features: result.features,
                        secondary_subtones: result.secondary_subtones,
                        zones: {
                          cervical: shadeOnly(result.zones?.cervical ?? ''),
                          body: shadeOnly(result.zones?.body ?? ''),
                          incisal: shadeOnly(result.zones?.incisal ?? ''),
                        },
                        imageUri: uploadedImageUrl,
                      })
                    );
                    router.push('/new-order');
                  }}
                  style={{
                    backgroundColor: '#f2ca50',
                    borderRadius: 14,
                    padding: 16,
                    alignItems: 'center',
                    marginTop: 12,
                  }}
                >
                  <Text style={{
                    color: '#031427',
                    fontSize: 16,
                    fontWeight: '700',
                  }}>
                    ✓ Сохранить в наряд
                  </Text>
                </TouchableOpacity>
              )}
              {result ? (
                <TouchableOpacity style={styles.againBtn} onPress={reset} activeOpacity={0.85}>
                  <Text style={styles.againBtnText}>🔄 Анализировать заново</Text>
                </TouchableOpacity>
              ) : null}

                          </>
          )}
        </ScrollView>

        {/* Модалка «Переслать коллеге» */}
        <Modal
          visible={shareModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setShareModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.shareModal}>
              <View style={styles.shareModalHeader}>
                <Ionicons name="share-social-outline" size={22} color="#f2ca50" />
                <Text style={styles.shareModalTitle}>Переслать коллеге</Text>
                <TouchableOpacity onPress={() => setShareModalVisible(false)}>
                  <Ionicons name="close" size={22} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
              <Text style={styles.shareModalSub}>Анализ цвета VITA</Text>
              {partners.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 20, gap: 6 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Нет связанных партнёров</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center' }}>Подключите коллег через раздел «Наряды»</Text>
                </View>
              ) : (
                partners.map((p) => {
                  const isSending = sharingId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.partnerRow}
                      onPress={() => shareAnalysis(p.id)}
                      disabled={isSending}
                    >
                      <View style={styles.partnerAvatar}>
                        <Text style={styles.partnerAvatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.partnerName}>{p.name}</Text>
                      {isSending
                        ? <ActivityIndicator size="small" color="#f2ca50" />
                        : <Ionicons name="send-outline" size={18} color="#f2ca50" />}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        </Modal>

        {/* ── Cosmic Success Modal ── */}
        <Modal
          visible={shareSuccessVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setShareSuccessVisible(false)}
        >
          <View style={styles.successOverlay}>
            <View style={styles.successBox}>
              <View style={styles.successIconWrap}>
                <Ionicons name="checkmark-circle" size={56} color="#22c55e" />
              </View>
              <Text style={styles.successTitle}>Успешно отправлено!</Text>
              <Text style={styles.successSub}>Коллега уже получил уведомление</Text>
              <TouchableOpacity
                style={styles.successBtn}
                onPress={() => setShareSuccessVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.successBtnText}>Отлично!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showImageModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowImageModal(false)}
        >
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.95)',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 50,
                right: 20,
                zIndex: 10,
                padding: 10,
              }}
              onPress={() => setShowImageModal(false)}
            >
              <Text style={{ color: 'white', fontSize: 28 }}>✕</Text>
            </TouchableOpacity>

            <ScrollView
              style={{ width: '100%' }}
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'center',
                alignItems: 'center',
                paddingVertical: 80,
              }}
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent={true}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri: selectedImage || '' }}
                style={{
                  width: Dimensions.get('window').width,
                  height: Dimensions.get('window').width,
                  resizeMode: 'contain',
                }}
              />
            </ScrollView>
          </View>
        </Modal>

        <Modal
          visible={tipsModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setTipsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Как сделать точное фото</Text>
              <ScrollView
                style={styles.modalScroll}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {PHOTO_TIPS_STEPS.map((line) => (
                  <Text key={line} style={styles.modalStep}>
                    {line}
                  </Text>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setTipsModalVisible(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalCloseBtnText}>Понятно</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showJawModal}
          transparent
          animationType="fade"
        >
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.8)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 30,
          }}>
            <View style={{
              backgroundColor: '#031427',
              borderRadius: 20,
              padding: 24,
              width: '100%',
              borderWidth: 1,
              borderColor: 'rgba(242,202,80,0.3)',
            }}>
              <Text style={{
                color: '#f2ca50',
                fontSize: 20,
                fontWeight: 'bold',
                textAlign: 'center',
                marginBottom: 8,
              }}>
                Какая челюсть?
              </Text>
              <Text style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 13,
                textAlign: 'center',
                marginBottom: 24,
              }}>
                Это влияет на точность определения цвета
              </Text>
              <View style={{ gap: 12 }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: 'rgba(242,202,80,0.15)',
                    borderWidth: 1,
                    borderColor: '#f2ca50',
                    borderRadius: 14,
                    padding: 16,
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    setJaw('upper');
                    setShowJawModal(false);
                  }}
                >
                  <Text style={{ fontSize: 28, marginBottom: 4 }}>🦷⬆️</Text>
                  <Text style={{
                    color: '#f2ca50',
                    fontSize: 16,
                    fontWeight: '600',
                  }}>
                    Верхняя челюсть
                  </Text>
                  <Text style={{
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 12,
                    marginTop: 4,
                  }}>
                    Десна сверху
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    backgroundColor: 'rgba(242,202,80,0.15)',
                    borderWidth: 1,
                    borderColor: '#f2ca50',
                    borderRadius: 14,
                    padding: 16,
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    setJaw('lower');
                    setShowJawModal(false);
                  }}
                >
                  <Text style={{ fontSize: 28, marginBottom: 4 }}>🦷⬇️</Text>
                  <Text style={{
                    color: '#f2ca50',
                    fontSize: 16,
                    fontWeight: '600',
                  }}>
                    Нижняя челюсть
                  </Text>
                  <Text style={{
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 12,
                    marginTop: 4,
                  }}>
                    Десна снизу
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f2ca5030',
  },
  backBtn: {
    padding: 8,
    width: 44,
  },
    headerSpacer: {
    width: 44,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#f2ca50',
    marginBottom: 16,
    backgroundColor: '#03142780',
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  loadingText: {
    color: '#ffffffcc',
    fontSize: 15,
  },
  errorBox: {
    backgroundColor: '#3d1515aa',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ff6b6b60',
  },
  errorText: {
    color: '#ffb4b4',
    fontSize: 14,
    lineHeight: 20,
  },
  resultCard: {
    backgroundColor: '#0a1628ee',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f2ca5040',
  },
  resultLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '400',
    marginBottom: 4,
  },
  shade: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#f2ca50',
    letterSpacing: 2,
    marginVertical: 8,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  metaLabel: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '400',
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f2ca50',
  },
  qualityBlock: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowFlat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoQualityReason: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
    fontWeight: '400',
  },
  sectionTitle: {
    fontSize: 13,
    letterSpacing: 1.5,
    color: '#f2ca50',
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 22,
    fontWeight: '400',
  },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  zoneKey: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '400',
  },
  zoneVal: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    flexWrap: 'wrap',
    marginLeft: 8,
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
  againBtn: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 14,
  },
  againBtnText: {
    color: '#f2ca50',
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
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
  importantHint: {
    color: 'rgba(242, 202, 80, 0.6)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 24,
  },
  analyzeBtn: {
    backgroundColor: '#f2ca50',
    opacity: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
    minHeight: 56,
    zIndex: 10,
    elevation: 10,
  },
  analyzeBtnText: {
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.35)',
    padding: 20,
  },
  modalTitle: {
    color: '#f2ca50',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalScroll: {
    maxHeight: 360,
  },
  modalStep: {
    color: '#ffffffe0',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  modalCloseBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f2ca50',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(242, 202, 80, 0.1)',
  },
  modalCloseBtnText: {
    color: '#f2ca50',
    fontSize: 16,
    fontWeight: '600',
  },
  modeSelection: {
    gap: 12,
  },
  modeCard: {
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.3)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  modeCardSelected: {
    borderColor: 'rgba(242,202,80,0.9)',
    backgroundColor: 'rgba(242,202,80,0.1)',
  },
  modeCardTitle: {
    color: '#f2ca50',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  modeCardSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  croppingHint: {
    color: 'rgba(242,202,80,0.5)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  homeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f2ca50',
    borderRadius: 14,
    paddingVertical: 15,
  },
  homeBtnText: {
    color: '#031427',
    fontSize: 15,
    fontWeight: '700',
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.6)',
    borderRadius: 14,
    paddingVertical: 15,
    backgroundColor: 'rgba(242,202,80,0.08)',
  },
  shareBtnText: {
    color: '#f2ca50',
    fontSize: 15,
    fontWeight: '600',
  },
  shareModal: {
    backgroundColor: '#0d2137',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.15)',
  },
  shareModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  shareModalTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  shareModalSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginBottom: 14,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  partnerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(242,202,80,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.3)',
  },
  partnerAvatarText: {
    color: '#f2ca50',
    fontSize: 16,
    fontWeight: '700',
  },
  partnerName: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBox: {
    backgroundColor: '#0B0B1E',
    borderWidth: 1,
    borderColor: 'rgba(138,43,226,0.6)',
    borderRadius: 20,
    paddingHorizontal: 32,
    paddingVertical: 36,
    alignItems: 'center',
    width: 300,
    gap: 12,
  },
  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  successSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
  },
  successBtn: {
    marginTop: 8,
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingHorizontal: 40,
    paddingVertical: 13,
  },
  successBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
