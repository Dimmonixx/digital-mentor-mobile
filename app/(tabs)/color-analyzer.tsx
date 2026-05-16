import { ANTHROPIC_API_KEY } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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

const CLAUDE_MODEL = 'claude-sonnet-4-6';

const VITA_ORDER: string[] = [
  'BL1', 'BL2', 'BL3', 'BL4',
  'A1', 'B1', 'A2', 'B2',
  'C1', 'D2', 'A3', 'D3',
  'B3', 'A3.5', 'C2', 'D4',
  'B4', 'A4', 'C3', 'C4'
];

const VITA_PROMPT = `Ты эксперт-колорист зубного 
техника с 20-летним опытом работы с шкалой 
VITA Classic Lumin-Vacuum.

АЛГОРИТМ ОПРЕДЕЛЕНИЯ — СТРОГО СЛЕДУЙ:

ШАГ 1: Найди шейку зуба (область у десны).
Игнорируй центр и блики полностью.
Только шейка!

ШАГ 2: Определи цвет шейки:
- Есть желтизна/теплота → минимум A2, 
  скорее A3 или темнее
- Выраженная желтизна → A3-A4
- Серость → группа C
- Розоватость → группа D
- Чисто белая без теплоты → BL или B1

ШАГ 3: shade = цвет шейки. Точка.
Никогда не смотри на центр для определения 
основного оттенка!

ШАГ 4: Блики и пересвет в центре — ИГНОРИРУЙ.
Центр зуба почти всегда светлее шейки — 
это нормально, это не основной цвет.

ЗАПРЕЩЕНО:
- Определять A1 если шейка имеет желтизну
- Ориентироваться на центр или блики
- Выбирать группу B если край прозрачный
- Занижать оттенок из-за пересвета в центре
- Занижать оттенок шейки — если сомневаешься 
  между двумя соседними → выбирай ТЕМНЕЕ
- A2 на шейке допустим только если шейка 
  реально светло-кремовая без выраженной желтизны
- Выраженная желтизна на шейке = минимум A3
- Умеренная желтизна на шейке = минимум A2-A3
- Лёгкая теплота на шейке = A2

ПРАВИЛО СДВИГА:
Из-за бликов и пересвета на фото реальный 
оттенок всегда на 1 ступень ТЕМНЕЕ чем видишь.
Применяй автоматически:
видишь A1 → ставь A2
видишь A2 → ставь A3
видишь A2-A3 → ставь A3
видишь A3 → ставь A3.5
Исключение: только если confidence высокая 
И фото отличного качества без бликов.

КРИТИЧЕСКИЕ ЗАПРЕТЫ:
- НИКОГДА не определяй A1 если на шейке видна 
  хоть малейшая желтизна или теплота — A1 это 
  почти белый зуб с едва заметной теплотой
- НИКОГДА не определяй B для зуба с прозрачным краем
- При бликах и пересвете — определяй на 1-2 тона 
  ТЕМНЕЕ чем кажется визуально
- A1 встречается крайне редко у живых зубов — 
  если сомневаешься между A1 и A2 выбирай A2
- Если шейка имеет выраженную теплоту — 
  минимум A2, скорее A3

ХАРАКТЕР ГРУПП VITA Classic:

Группа A — красно-коричневые (warm brown):
Самые популярные и "живые" оттенки.
Тёплые, натуральные, желтовато-коричневые.
Край ВСЕГДА имеет прозрачность у живых зубов.
A1=светлый, A2=средний, A3=насыщенный, 
A3.5=тёмный, A4=самый насыщенный тёмный.

Группа B — красно-жёлтые (warm yellow):
Более яркие и "солнечные" чем A.
Светлые, желтоватые, чистые.
ВАЖНО: группа B НЕ прозрачная на крае!
Если край прозрачный — это не группа B.
B1=очень светлый яркий, B2=светлый, 
B3=средний, B4=насыщенный.

Группа C — серые (cool gray):
Холодные, приглушённые, сероватые.
Менее насыщенные чем A и B.
C1=светлый серый, C2=средний серый,
C3=насыщенный серый, C4=тёмный серый.

Группа D — красно-серые (reddish gray):
Самые сложные и редкие оттенки.
Серо-красноватые, глубокие, возрастные.
D2=светлый, D3=средний, D4=тёмный.

ЭТАЛОННЫЕ ОПИСАНИЯ (реальные образцы 
при дневном свете, белый фон):

A1: Шейка — тёплый кремовый лёгкая желтизна.
Середина — нейтрально-кремовый.
Край — прозрачный холодный.

A2: Шейка — насыщенный тёплый бежево-жёлтый.
Середина — кремово-жёлтый.
Край — светлее лёгкая прозрачность.

A3: Шейка — выраженный тёплый жёлто-коричневый.
Середина — насыщенный кремово-жёлтый.
Край — светлый кремовый с прозрачностью.

A3.5: Шейка — интенсивный жёлто-коричневый.
Середина — тёплый насыщенный кремово-жёлтый.
Край — кремовый с лёгкой прозрачностью.

A4: Шейка — тёмный коричнево-жёлтый самый 
насыщенный в группе A.
Середина — насыщенный тёплый.
Край — кремовый светлый.

B1: Шейка — светлый нейтральный почти белый яркий.
Середина — холодно-кремовый яркий.
Край — белый НЕ прозрачный насыщенный.

B2: Шейка — светлый кремовый с лёгким серым.
Середина — нейтральный кремовый.
Край — светлый НЕ прозрачный.

B3: Шейка — тёплый жёлтый с лёгким серым.
Середина — кремово-жёлтый.
Край — светлее НЕ прозрачный.

B4: Шейка — насыщенный жёлто-коричневый с серым.
Середина — тёплый насыщенный.
Край — кремовый НЕ прозрачный.

C1: Шейка — светлый серовато-кремовый.
Середина — нейтральный с серым подтоном.
Край — почти белый слабо прозрачный.

C2: Шейка — кремово-серый.
Середина — нейтральный серовато-кремовый.
Край — светлый.

C3: Шейка — насыщенный серовато-жёлтый.
Середина — тёплый с заметным серым.
Край — кремовый.

C4: Шейка — тёмный серовато-коричневый.
Середина — насыщенный серый с теплотой.
Край — кремовый.

D2: Шейка — светлый кремово-розоватый.
Середина — нейтральный кремовый.
Край — почти прозрачный.

D3: Шейка — кремово-розовый тёплый.
Середина — нейтральный кремовый.
Край — светлый.

D4: Шейка — насыщенный розовато-коричневый.
Середина — тёплый кремово-розовый.
Край — светлый кремовый.

ПРАВИЛА ОПРЕДЕЛЕНИЯ:

1. ГЛАВНОЕ: shade = zone_cervical всегда!
   Шейка определяет основной оттенок.
   Никогда не ставь основной светлее шейки.

2. ЗОНЫ всегда от тёмного к светлому:
   Шейка → темнее всего
   Середина → на 1 тон светлее шейки
   Край → самый светлый, у живых зубов прозрачный

3. ПРИЗНАК ГРУППЫ B:
   Если край прозрачный — это НЕ группа B!
   B всегда яркая и непрозрачная до края.

4. shade_alternative заполняй ТОЛЬКО если есть 
   явное влияние другой группы:
   - Серость в тёплом зубе → C того же уровня
     Пример: "A3 с серостью → C2"
   - Розоватость → D того уровня
   - Зуб чистый представитель группы → "" пусто
   - Уверенность средняя/низкая → следующий тон
     той же группы: A2→A3, A3→A3.5 и т.д.

5. ОСВЕЩЕНИЕ:
   Тёплый искусственный свет — сдвигай холоднее.
   Тёмное фото — зуб реально темнее.
   Пересвет — зуб реально светлее.

6. BLEACH: ярко белый холодный = BL не A1.

7. ЛАЙФХАК: освещение утром и вечером даёт 
   разный результат. Учитывай качество фото.

8. ЗОНЫ: ТОЛЬКО код без описания.
   "A3" а не "A3 тёплый коричневый".

Ответь СТРОГО в JSON без лишнего текста:
{
  "shade": "A3",
  "shade_alternative": "A3.5 или C2 — только если есть основание",
  "confidence": "высокая/средняя/низкая",
  "photo_quality": "отличное/хорошее/среднее/плохое",
  "photo_quality_reason": "причина если не отличное",
  "description": "1-2 предложения с характером цвета и группы",
  "zone_cervical": "A3",
  "zone_middle": "A2",
  "zone_incisal": "A1"
}`;

interface VitaAnalysis {
  shade: string;
  shade_alternative: string;
  confidence: string;
  photo_quality: string;
  photo_quality_reason: string;
  description: string;
  zone_cervical: string;
  zone_middle: string;
  zone_incisal: string;
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
  const raw = result.zone_cervical || result.shade || '';
  return raw.split('(')[0].split('—')[0].split('-')[0]
            .split('/')[0].trim();
};



const PHOTO_TIPS_STEPS = [
  '📍 Расстояние 15–20 см от зуба',
  '💡 Естественный дневной свет',
  '🚫 Без вспышки — искажает цвет',
  '🦷 Зуб чистый и слегка влажный',
  '📐 Снимай прямо, без угла',
  '📷 Основная камера, не фронтальная',
  '✂️ При кадрировании оставь только зуб',
];

function parseVitaJson(raw: string): VitaAnalysis | null {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(jsonStr) as Partial<VitaAnalysis>;
    if (
      typeof parsed.shade === 'string' &&
      typeof parsed.confidence === 'string' &&
      typeof parsed.photo_quality === 'string' &&
      typeof parsed.description === 'string' &&
      typeof parsed.zone_cervical === 'string' &&
      typeof parsed.zone_middle === 'string' &&
      typeof parsed.zone_incisal === 'string'
    ) {
      const photo_quality_reason =
        typeof parsed.photo_quality_reason === 'string' ? parsed.photo_quality_reason : '';
      
      return {
        shade: parsed.shade,
        shade_alternative: parsed.shade_alternative || '',
        confidence: parsed.confidence,
        photo_quality: parsed.photo_quality,
        photo_quality_reason,
        description: parsed.description,
        zone_cervical: parsed.zone_cervical,
        zone_middle: parsed.zone_middle,
        zone_incisal: parsed.zone_incisal,
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function analyzeWithClaude(base64: string, mediaType: 'image/jpeg' | 'image/png'): Promise<VitaAnalysis> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
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
              text: VITA_PROMPT,
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
  const parsed = parseVitaJson(text);
  if (!parsed) {
    throw new Error('Не удалось разобрать ответ модели. Попробуйте другое фото.');
  }
  return parsed;
}

export default function ColorAnalyzerScreen() {
  const insets = useSafeAreaInsets();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<{
    base64: string;
    mime: 'image/jpeg' | 'image/png';
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VitaAnalysis | null>(null);
  const [tipsModalVisible, setTipsModalVisible] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSelectedImage(null);
        setResult(null);
        setLoading(false);
      };
    }, [])
  );

  const reset = useCallback(() => {
    setSelectedImage(null);
    setPendingPayload(null);
    setResult(null);
    setError(null);
    setLoading(false);
    setTipsModalVisible(false);
  }, []);

  const runAnalysis = useCallback(async (base64: string, mime: 'image/jpeg' | 'image/png') => {
    if (!ANTHROPIC_API_KEY?.trim()) {
      setError('Добавьте ANTHROPIC_API_KEY в constants/config.ts');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const analysis = await analyzeWithClaude(base64, mime);
      setResult(analysis);
      await AsyncStorage.setItem(
        'pendingVitaResult', 
        JSON.stringify(analysis)
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ошибка запроса';
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAnalyze = useCallback(() => {
    if (!pendingPayload) return;
    void runAnalysis(pendingPayload.base64, pendingPayload.mime);
  }, [pendingPayload, runAnalysis]);

  const pickAsset = useCallback(async (asset: ImagePicker.ImagePickerAsset | undefined) => {
    if (!asset?.uri) return;
    setError(null);
    setResult(null);
    setLoading(false);
    setSelectedImage(asset.uri);
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

  const takePhoto = async () => {
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 1,
    base64: true,
  });
  if (result.canceled) return;
  setOriginalImage(null);
  await pickAsset(result.assets[0]);
};

  const pickFromGallery = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 1,
    base64: true,
  });
  if (result.canceled) return;
  setOriginalImage(null);
  await pickAsset(result.assets[0]);
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
            <TouchableOpacity onPress={() => router.back()}>
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
              <TouchableOpacity onPress={() => setShowImageModal(true)}>
                <Image 
                  source={{ uri: selectedImage || '' }} 
                  style={{
                    width: '100%',
                    height: undefined,
                    aspectRatio: 4/3,
                    resizeMode: 'contain',
                    borderRadius: 16,
                    backgroundColor: 'rgba(0,0,0,0.3)',
                  }}
                />
              </TouchableOpacity>
              {selectedImage && !loading && !result && (
                <TouchableOpacity
                  style={[styles.analyzeBtn, { marginTop: 16 }]}
                  onPress={handleAnalyze}
                >
                  <Text style={styles.analyzeBtnText}>
                    🔍 Анализировать
                  </Text>
                </TouchableOpacity>
              )}
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
                      fontSize: 72,
                      fontWeight: 'bold',
                      color: '#f2ca50',
                      letterSpacing: 2,
                      marginVertical: 8,
                      textAlign: 'center',
                    }}
                  >
                    {getMainShade(result)}
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
                    {result.photo_quality_reason.trim() ? (
                      <Text style={styles.photoQualityReason}>{result.photo_quality_reason}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.sectionTitle}>Описание</Text>
                  <Text style={styles.bodyText}>{result.description}</Text>
                  {result.shade_alternative && (
                    <Text style={{
                      fontSize: 14,
                      color: 'rgba(242,202,80,0.6)',
                      marginBottom: 8,
                    }}>
                      Возможно: {result.shade_alternative}
                    </Text>
                  )}
                  <Text style={styles.sectionTitle}>Зоны</Text>
                  <View style={styles.zoneRow}>
                    <Text style={styles.zoneKey}>Шейка</Text>
                    <Text 
                      style={styles.zoneVal}
                      numberOfLines={2}
                    >
                      {shadeOnly(result.zone_cervical)}
                    </Text>
                  </View>
                  <View style={styles.zoneRow}>
                    <Text style={styles.zoneKey}>Середина</Text>
                    <Text 
                      style={styles.zoneVal}
                      numberOfLines={2}
                    >
                      {shadeOnly(result.zone_middle)}
                    </Text>
                  </View>
                  <View style={styles.zoneRow}>
                    <Text style={styles.zoneKey}>Край</Text>
                    <Text 
                      style={styles.zoneVal}
                      numberOfLines={2}
                    >
                      {shadeOnly(result.zone_incisal)}
                    </Text>
                  </View>
                </View>
              ) : null}
              {result && !originalImage && (
                <TouchableOpacity
                  onPress={async () => {
                    const orig = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      allowsEditing: false,
                      quality: 1,
                    });
                    if (!orig.canceled) {
                      setOriginalImage(orig.assets[0].uri);
                    }
                  }}
                  style={{
                    borderWidth: 1,
                    borderColor: 'rgba(242,202,80,0.4)',
                    borderRadius: 14,
                    padding: 14,
                    alignItems: 'center',
                    marginTop: 8,
                  }}
                >
                  <Text style={{
                    color: '#f2ca50',
                    fontSize: 15,
                  }}>📸 Добавить фото улыбки</Text>
                </TouchableOpacity>
              )}
              {result && (
                <TouchableOpacity
                  onPress={async () => {
                    await AsyncStorage.setItem(
                      'pendingVitaResult',
                      JSON.stringify({
                        shade: getMainShade(result),
                        confidence: result.confidence,
                        photo_quality: result.photo_quality,
                        photo_quality_reason: result.photo_quality_reason,
                        description: result.description,
                        zone_cervical: shadeOnly(result.zone_cervical),
                        zone_middle: shadeOnly(result.zone_middle),
                        zone_incisal: shadeOnly(result.zone_incisal),
                        imageUri: selectedImage,
                        originalImageUri: originalImage,
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
                  <Text style={styles.againBtnText}>� Анализировать заново</Text>
                </TouchableOpacity>
              ) : null}

              {result && originalImage && (
                <TouchableOpacity
                  onPress={() => setOriginalImage(null)}
                  style={{ alignItems: 'center', marginTop: 8 }}
                >
                  <Text style={{
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 13,
                  }}>✕ Удалить фото улыбки</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>

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
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  zoneKey: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '400',
  },
  zoneVal: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    textAlign: 'right',
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
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
});
