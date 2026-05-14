import { ANTHROPIC_API_KEY } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
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

const CLAUDE_MODEL = 'claude-opus-4-5';

const VITA_PROMPT = `Ты эксперт по цвету зубов. Проанализируй фото зуба и определи его оттенок по шкале VITA Classic. 
Шкала VITA: BL1, BL2, BL3, BL4, A1, A2, A3, A3.5, A4, B1, B2, B3, B4, C1, C2, C3, C4, D2, D3, D4.
Ответь строго в формате JSON:
{
  "shade": "A2",
  "confidence": "высокая/средняя/низкая",
  "photo_quality": "отличное/хорошее/среднее/плохое",
  "photo_quality_reason": "причина если качество плохое",
  "description": "краткое описание цвета",
  "zone_cervical": "оттенок шейки",
  "zone_middle": "оттенок середины",
  "zone_incisal": "оттенок края"
}`;

interface VitaAnalysis {
  shade: string;
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

  const mainShade = result ? result.zone_cervical || result.shade : '';

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

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Нужен доступ к камере');
      return;
    }

    await launchCamera();
  }, [launchCamera]);

  const pickFromGallery = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Нужен доступ к галерее');
      return;
    }

    await launchGallery();
  }, [launchGallery]);

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar style="light" backgroundColor="#0a0a1a" />
      <View style={[styles.safe, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#f2ca50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Анализ цвета VITA
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
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
              <Text style={styles.croppingHint}>
                После выбора нажмите ✓ чтобы сохранить область
              </Text>
              <TouchableOpacity
                style={styles.recommendationsBtn}
                onPress={() => setTipsModalVisible(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.recommendationsBtnText}>
                  💡 Рекомендации для точного результата
                </Text>
              </TouchableOpacity>
              <Text style={styles.importantHint}>
                ⚠️ Важно: фотографируйте ТОЛЬКО зуб
                {'\n'}При кадрировании оставь только зуб
              </Text>
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
              {pendingPayload && !result && !loading ? (
                <TouchableOpacity
                  style={styles.analyzeBtn}
                  onPress={handleAnalyze}
                  activeOpacity={0.85}
                >
                  <Text style={styles.analyzeBtnText}>🔍 Анализировать</Text>
                </TouchableOpacity>
              ) : null}
              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#f2ca50" />
                  <Text style={styles.loadingText}>Анализирую...</Text>
                </View>
              ) : null}
              {result ? (
                <View style={styles.resultCard}>
                  <Text style={styles.resultLabel}>Оттенок VITA</Text>
                  <Text style={styles.shade}>{mainShade}</Text>
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
                  <Text style={styles.sectionTitle}>Зоны</Text>
                  <View style={styles.zoneRow}>
                    <Text style={styles.zoneKey}>Шейка</Text>
                    <Text style={styles.zoneVal}>{result.zone_cervical}</Text>
                  </View>
                  <View style={styles.zoneRow}>
                    <Text style={styles.zoneKey}>Середина</Text>
                    <Text style={styles.zoneVal}>{result.zone_middle}</Text>
                  </View>
                  <View style={styles.zoneRow}>
                    <Text style={styles.zoneKey}>Край</Text>
                    <Text style={styles.zoneVal}>{result.zone_incisal}</Text>
                  </View>
                </View>
              ) : null}
              {result ? (
                <TouchableOpacity style={styles.againBtn} onPress={reset} activeOpacity={0.85}>
                  <Text style={styles.againBtnText}>Анализировать заново</Text>
                </TouchableOpacity>
              ) : null}
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#f2ca50',
    fontSize: 18,
    fontWeight: '700',
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
    color: '#ffffff99',
    fontSize: 13,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  shade: {
    color: '#f2ca50',
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff18',
  },
  metaLabel: {
    color: '#ffffff80',
    fontSize: 14,
  },
  metaValue: {
    color: '#f2ca50',
    fontSize: 15,
    fontWeight: '600',
  },
  qualityBlock: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff18',
  },
  rowFlat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoQualityReason: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  sectionTitle: {
    color: '#f2ca50',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
  },
  bodyText: {
    color: '#ffffffdd',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffffff20',
  },
  zoneKey: {
    color: '#ffffff90',
    fontSize: 14,
    flex: 1,
  },
  zoneVal: {
    color: '#ffffff',
    fontSize: 14,
    flex: 1.2,
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
