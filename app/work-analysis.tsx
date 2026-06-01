import { ANTHROPIC_API_KEY } from '@/constants/config';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useState } from 'react';
import {
    Alert,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const VITA_SHADES = [
  "A1", "A2", "A3", "A3.5", "A4",
  "B1", "B2", "B3", "B4",
  "C1", "C2", "C3", "C4",
  "D2", "D3", "D4",
  "BL1", "BL2", "BL3", "BL4"
];

const WORK_STAGES = [
  "Не указан",
  "Бисквит после 1-го обжига",
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

const UPPER_TEETH = ["18","17","16","15","14","13","12","11",
                     "21","22","23","24","25","26","27","28"];
const LOWER_TEETH = ["48","47","46","45","44","43","42","41",
                     "31","32","33","34","35","36","37","38"];

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
  const prompt = `Ты — Сенсей, строгий и опытный зубной техник-наставник с 30-летним стажем. Ты циничен, беспристрастен и не прощаешь брака. Оцени керамическую работу на фото с профессиональной жесткостью.

ПАРАМЕТРЫ РАБОТЫ:
- Зубы: ${teeth}
- Заказанный оттенок VITA: ${vitaShade}
- Этап работы: ${workStage}
- Тип анализа: ${analysisType}
- Комментарий: ${comment}

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
  const { theme } = useTheme();
  const { t } = useLanguage();
  const backgroundColor = theme?.bg || '#0a0f1d';
  
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

  const toggleTooth = (tooth: string) => {
    setSelectedTeeth(prev =>
      prev.includes(tooth) ? prev.filter(t => t !== tooth) : [...prev, tooth]
    );
  };

  const setImageFromAsset = (asset: ImagePicker.ImagePickerAsset) => {
    setImage(asset.uri);
    setAnalysisResult(null);
    const b64 = asset.base64;
    if (!b64) {
      setImageBase64(null);
      Alert.alert('Ошибка', 'Не удалось получить данные изображения. Попробуйте выбрать фото снова.');
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

  const analyzeWork = async () => {
    if (!image || !imageBase64) {
      Alert.alert('Ошибка', 'Пожалуйста, загрузите фото работы');
      return;
    }

    if (!ANTHROPIC_API_KEY?.trim()) {
      Alert.alert('Ошибка', 'Добавьте ANTHROPIC_API_KEY в constants/config.ts');
      return;
    }

    setIsLoading(true);
    setAnalysisResult(null);

    try {
      const teeth = selectedTeeth.length > 0 ? selectedTeeth.join(', ') : 'не указаны';
      const result = await analyzeWithClaude(
        imageBase64,
        imageMime,
        selectedShade,
        workStage,
        analysisType,
        teeth,
        notes || 'нет',
      );
      setAnalysisResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось выполнить анализ';
      Alert.alert('Ошибка', message);
      console.error(error);
    } finally {
      setIsLoading(false);
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

  const renderAnalysisResult = () => {
    if (!analysisResult) return null;

    const parsed = parseAnalysisResult(analysisResult);

    if (!parsed) {
      return (
        <View style={styles.resultContainer}>
          <Text style={styles.errorText}>Не удалось распарсить результат анализа</Text>
        </View>
      );
    }

    const getStatusColor = (status: string) => {
      if (status === 'КРИТИЧНО') return '#d32f2f';
      if (status === 'ВАЖНО') return '#f2ca50';
      if (status === 'НОРМА') return '#4caf50';
      if (status === 'НЕ ПРИМЕНИМО') return '#757575';
      return '#f2ca50';
    };

    const getLevelColor = (level: string) => {
      if (level === 'КРИТИЧЕСКИЙ') return '#d32f2f';
      if (level === 'ЖЕСТКИЙ') return '#ff9800';
      if (level === 'РЕКОМЕНДАЦИЯ') return '#f2ca50';
      if (level === 'НЕ ОБЯЗАТЕЛЬНО') return '#757575';
      return '#f2ca50';
    };

    return (
      <View style={styles.resultContainer}>
        {/* Order Match */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 СООТВЕТСТВИЕ ЗАКАЗУ</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(parsed.orderMatch?.status || '') }]}>
            <Text style={styles.statusBadgeText}>{parsed.orderMatch?.status || ''}</Text>
          </View>
          <Text style={styles.cardText}>{parsed.orderMatch?.text || ''}</Text>
        </View>

        {/* Anatomy */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🦷 АНАТОМИЯ</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(parsed.anatomy?.status || '') }]}>
            <Text style={styles.statusBadgeText}>{parsed.anatomy?.status || ''}</Text>
          </View>
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Пришеечная треть</Text>
            <Text style={styles.cardText}>{parsed.anatomy?.neck || ''}</Text>
          </View>
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Экватор и средняя треть</Text>
            <Text style={styles.cardText}>{parsed.anatomy?.body || ''}</Text>
          </View>
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Режущий край</Text>
            <Text style={styles.cardText}>{parsed.anatomy?.edge || ''}</Text>
          </View>
        </View>

        {/* Optics */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>✨ ОПТИКА</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(parsed.optics?.status || '') }]}>
            <Text style={styles.statusBadgeText}>{parsed.optics?.status || ''}</Text>
          </View>
          <Text style={styles.cardText}>{parsed.optics?.text || ''}</Text>
        </View>

        {/* Gum Analysis */}
        {parsed.gumAnalysis?.status !== 'НЕ ПРИМЕНИМО' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🌹 РОЗОВАЯ ЭСТЕТИКА</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(parsed.gumAnalysis?.status || '') }]}>
              <Text style={styles.statusBadgeText}>{parsed.gumAnalysis?.status || ''}</Text>
            </View>
            <Text style={styles.cardText}>{parsed.gumAnalysis?.text || ''}</Text>
          </View>
        )}

        {/* Technical Checklist */}
        {parsed.technicalChecklist && parsed.technicalChecklist.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔧 ТЕХНИЧЕСКИЙ ЧЕК-ЛИСТ</Text>
            {parsed.technicalChecklist.map((item: any, index: number) => (
              <View key={index} style={styles.checklistItem}>
                <View style={[styles.checklistBadge, { backgroundColor: getLevelColor(item.level || '') }]}>
                  <Text style={styles.checklistBadgeText}>{item.level || ''}</Text>
                </View>
                <Text style={styles.checklistText}>{item.criterion || ''}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Final Verdict */}
        <View style={styles.verdictCard}>
          <Text style={styles.verdictTitle}>🎓 ВЕРДИКТ СЕНСЕЯ</Text>
          <Text style={styles.verdictText}>{parsed.finalVerdict || ''}</Text>
        </View>

        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => {
            setAnalysisResult(null);
            setImage(null);
            setImageBase64(null);
            setSelectedTeeth([]);
            setNotes('');
          }}
        >
          <Text style={styles.clearButtonText}>Очистить и начать заново</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {/* DiLabs Header */}
      <View style={styles.dilabsHeader}>
        <TouchableOpacity style={styles.headerIconBtn}>
          <Ionicons name="menu-outline" size={28} color="#f2ca50" />
        </TouchableOpacity>
        <Image
          source={require('@/assets/images/header-logo.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="notifications-outline" size={24} color="#f2ca50" />
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

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 1-й БЛОК: Фото работы */}
        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>📷 Фото работы</Text>
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
            <Image source={{ uri: image }} style={styles.previewImageCompact} />
          )}
        </View>

        {/* 2-й БЛОК: Зубная формула */}
        <View style={styles.cardBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>🦷 Зубная формула</Text>
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
          <Text style={styles.cardTitle}>⚙️ Параметры анализа</Text>
          
          <View style={styles.parameterRow}>
            <Text style={styles.parameterLabel}>Оттенок VITA</Text>
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

          <View style={styles.parameterRow}>
            <Text style={styles.parameterLabel}>Этап работы</Text>
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

          <View style={styles.parameterRow}>
            <Text style={styles.parameterLabel}>Тип анализа</Text>
            <View style={styles.pickerContainer}>
              {ANALYSIS_TYPES.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.pickerItemCompact,
                    analysisType === type && styles.pickerItemSelected
                  ]}
                  onPress={() => setAnalysisType(type)}
                >
                  <Text style={[
                    styles.pickerTextCompact,
                    analysisType === type && styles.pickerTextSelected
                  ]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Комментарий */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Комментарий</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Например: 2 центральных резца, пациент 35 лет..."
            placeholderTextColor="#f2ca5050"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

        {/* Кнопка запуска */}
        <TouchableOpacity
          style={[styles.analyzeButton, isLoading && styles.analyzeButtonDisabled]}
          onPress={analyzeWork}
          disabled={isLoading}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <LottieView
                source={require('@/assets/images/cyber_head.json')}
                autoPlay
                loop
                style={styles.lottieAnimation}
              />
            </View>
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons name="sparkles" size={20} color="#0a0f1d" />
              <Text style={styles.analyzeButtonText}>Запустить анализ Сенсея</Text>
            </View>
          )}
        </TouchableOpacity>

        {renderAnalysisResult()}
      </ScrollView>
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
  headerIconBtn: {
    padding: 4,
  },
  headerLogo: {
    width: 180,
    height: 56,
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
    marginBottom: 8,
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
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0a0f1d',
    marginLeft: 8,
  },
  loadingContainer: {
    width: 60,
    height: 60,
  },
  lottieAnimation: {
    width: 60,
    height: 60,
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
});
