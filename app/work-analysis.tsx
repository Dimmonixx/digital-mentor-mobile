import BottomTabBar from '@/components/BottomTabBar';
import CustomAlert from '@/components/CustomAlert';
import GlobalHeader from '@/components/global-header';
import { executeWithAiLimit } from '@/services/aiRequestService';
import { uploadMediaToServer } from '@/utils/saveToArchive';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Image,
  ImageBackground,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useNewOrdersCount } from '../hooks/useNewOrdersCount';

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
  { label: "Общий анализ работы", cost: 2 },
  { label: "Проверить цвет и оттенок", cost: 1 },
  { label: "Проверить форму и морфологию", cost: 1 },
  { label: "Оценить симметрию", cost: 1 },
  { label: "Просто похвастаться 😎", cost: 1 },
  { label: "Найти косяки", cost: 3 },
  { label: "Финальная проверка перед сдачей", cost: 3 },
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



const FLOATING_WORDS = [
  "форму", "цвет", "десну", "симметрию", "края", "полировку", "анатомию", "прозрачность"
];

const FLOATING_POSITIONS = [
  { top: 155, left: 220 },
  { top: 260, left: 185 },
  { top: 300, left: 100 },
  { top: 260, left: 15 },
  { top: 155, left: -20 },
  { top: 50, left: 15 },
  { top: 10, left: 100 },
  { top: 50, left: 185 },
];



const FloatingWord = ({ style, delay }: { style: any; delay: number }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const [wordIndex, setWordIndex] = useState(() => Math.floor(Math.random() * FLOATING_WORDS.length));

  useEffect(() => {
    let isMounted = true;
    const runCycle = () => {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.delay(400),
      ]).start(() => {
        if (isMounted) {
          setWordIndex(prev => (prev + 1) % FLOATING_WORDS.length);
          runCycle();
        }
      });
    };
    const timeout = setTimeout(runCycle, delay);
    return () => { isMounted = false; clearTimeout(timeout); };
  }, [delay, opacity]);

  return (
    <Animated.View style={[{ position: 'absolute', width: 110, alignItems: 'center' }, style, { opacity }]}>
      <View style={{
        backgroundColor: 'rgba(242,202,80,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(242,202,80,0.4)',
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}>
        <Text style={{ color: '#f2ca50', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
          {FLOATING_WORDS[wordIndex]}
        </Text>
      </View>
    </Animated.View>
  );
};

export default function WorkAnalysisScreen() {
  const scrollViewRef = useRef<ScrollView>(null);
  const resultSectionY = useRef(0);
  const newOrdersCount = useNewOrdersCount();
  
  const [selectedTeeth, setSelectedTeeth] = useState<string[]>([]);
  const [selectedShade, setSelectedShade] = useState<string>("Не указан");
  const [workStage, setWorkStage] = useState<string>("Не указан");
  const [analysisType, setAnalysisType] = useState<string>("Общий анализ работы");
  const [image, setImage] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isImageModalVisible, setIsImageModalVisible] = useState<boolean>(false);
  const [alertVisible, setAlertVisible] = useState<boolean>(false);
  const [alertTitle, setAlertTitle] = useState<string>('');
  const [alertMessage, setAlertMessage] = useState<string>('');
  const [exitConfirmVisible, setExitConfirmVisible] = useState<boolean>(false);
  const [diamondBalance, setDiamondBalance] = useState<number>((globalThis as any).getDiamondBalance?.() ?? 0);
  const [constructionType, setConstructionType] = useState<string>('Коронка');
  const [critiqueResult, setCritiqueResult] = useState<{ score: number; verdict: string; findings: string[]; summary: string } | null>(null);

  const resetAnalysisForm = () => {
    setImage(null);
    setSelectedTeeth([]);
    setSelectedShade("Не указан");
    setWorkStage("Не указан");
    setConstructionType('Коронка');
    setAnalysisType("Общий анализ работы");
    setCritiqueResult(null);
  };

  useEffect(() => {
    if (critiqueResult) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: resultSectionY.current - 20, animated: true });
      }, 150);
    }
  }, [critiqueResult]);

  useEffect(() => {
    const onBackPress = () => {
      setExitConfirmVisible(true);
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!image) return;
    Image.getSize(
      image,
      (w, h) => setImageAspectRatio(w / h),
      () => setImageAspectRatio(1)
    );
  }, [image]);

  useEffect(() => {
    setDiamondBalance((globalThis as any).getDiamondBalance?.() ?? 0);
    const prev = (globalThis as any).forceDiamondUpdate;
    (globalThis as any).forceDiamondUpdate = () => {
      setDiamondBalance((globalThis as any).getDiamondBalance?.() ?? 0);
      prev?.();
    };
    return () => { (globalThis as any).forceDiamondUpdate = prev; };
  }, []);


  const toggleTooth = (tooth: string) => {
    setSelectedTeeth(prev =>
      prev.includes(tooth) ? prev.filter(t => t !== tooth) : [...prev, tooth]
    );
  };



  const setImageFromAsset = (asset: ImagePicker.ImagePickerAsset) => {
    setImage(asset.uri);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
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
        setAlertMessage('Не удалось загрузить фото');
        setAlertVisible(true);
        setIsLoading(false);
        return;
      }

      const rawUser = await AsyncStorage.getItem('user');
      const userObj = rawUser ? JSON.parse(rawUser) : null;
      const technicianId = userObj?.id || userObj?.email || '';
      const userEmail = userObj?.email || '';
      const caseId = selectedTeeth.length > 0 ? selectedTeeth.join('-') : `work-${Date.now()}`;

      const selectedType = ANALYSIS_TYPES.find(t => t.label === analysisType);
      const cost = selectedType?.cost || 1;

      const result = await executeWithAiLimit(userEmail, async () => {
        const response = await fetch('http://62.238.13.160:8000/analysis/work/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            technician_id: technicianId,
            case_id: caseId,
            work_image_url: imageUrl,
            construction_type: constructionType,
            analysis_type: analysisType,
            ordered_shade: selectedShade !== 'Не указан' ? selectedShade : '',
            work_stage: workStage,
          }),
        });
        return response;
      }, cost);

      if (!result) {
        setIsLoading(false);
        return;
      }

      const response = result;
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setAlertTitle('Ошибка');
        setAlertMessage(data.detail || 'Не удалось выполнить анализ');
        setAlertVisible(true);
        setIsLoading(false);
        return;
      }

      setCritiqueResult(data.result);
    } catch (e) {
      console.error(e);
      setAlertTitle('Ошибка');
      setAlertMessage('Не удалось связаться с сервером');
      setAlertVisible(true);
    } finally {
      setIsLoading(false);
    }
  };



  const renderCritiqueResult = () => {
    if (!critiqueResult) return null;

    return (
      <View
        style={styles.resultContainer}
        onLayout={(e) => { resultSectionY.current = e.nativeEvent.layout.y; }}
      >
        <View style={styles.critiqueCard}>
          <View style={styles.critiqueHeader}>
            <Ionicons name="scan-outline" size={22} color="#f2ca50" />
            <Text style={styles.critiqueTitle}>РЕЗУЛЬТАТ АНАЛИЗА</Text>
          </View>

          <View style={styles.ratingBlock}>
            <Text style={styles.ratingValue}>{critiqueResult.score}/10</Text>
          </View>

          <Text style={{ color: '#f2ca50', fontSize: 15, fontWeight: '700', marginTop: 8, textAlign: 'center' }}>
            {critiqueResult.verdict}
          </Text>

          {critiqueResult.findings && critiqueResult.findings.length > 0 && (
            <View style={{ marginTop: 14, width: '100%' }}>
              {critiqueResult.findings.map((finding, idx) => (
                <View key={idx} style={{ flexDirection: 'row', marginBottom: 6, gap: 6 }}>
                  <Text style={{ color: '#f2ca50' }}>•</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, flex: 1 }}>{finding}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(242,202,80,0.2)', width: '100%' }}>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 19 }}>
              {critiqueResult.summary}
            </Text>
          </View>
        </View>
      </View>
    );
  };

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
          <View style={{ width: 340, height: 340, alignItems: 'center', justifyContent: 'center' }}>
            <LottieView
              source={require('@/assets/images/cyber_head.json')}
              autoPlay
              loop
              style={styles.loaderAnimation}
            />
            {FLOATING_POSITIONS.map((pos, idx) => (
              <FloatingWord key={idx} style={pos} delay={idx * 500} />
            ))}
          </View>
          <Text style={styles.loaderStatusText}>
            🧠 Сенсей анализирует...
          </Text>
        </View>
      ) : (
        <>
          {/* DiLabs Header */}
          <GlobalHeader diamonds={diamondBalance} />

      {/* Local Header */}
      <View style={styles.localHeader}>
        <TouchableOpacity onPress={() => setExitConfirmVisible(true)} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#f2ca50" />
        </TouchableOpacity>
        <Text style={styles.localTitle}>Анализ работы</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        ref={scrollViewRef}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        <>
            {/* Форма с параметрами */}
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
                  <Image
                    source={{ uri: image }}
                    style={[styles.previewImageCompact, { aspectRatio: imageAspectRatio, resizeMode: 'contain' }]}
                  />
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

              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                <TouchableOpacity
                  onPress={() => setSelectedTeeth([...UPPER_TEETH, ...LOWER_TEETH])}
                  style={styles.quickSelectBtn}
                >
                  <Text style={styles.quickSelectBtnText}>Тотал</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSelectedTeeth([...UPPER_TEETH])}
                  style={styles.quickSelectBtn}
                >
                  <Text style={styles.quickSelectBtnText}>Верхняя челюсть</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSelectedTeeth([...LOWER_TEETH])}
                  style={styles.quickSelectBtn}
                >
                  <Text style={styles.quickSelectBtnText}>Нижняя челюсть</Text>
                </TouchableOpacity>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 8 }}>
              <Ionicons name="color-palette-outline" size={13} color="#f2ca50" />
              <Text style={[styles.parameterBlockLabel, { marginBottom: 0 }]}>Заказанный цвет</Text>
            </View>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 8 }}>
              <Ionicons name="layers-outline" size={13} color="#f2ca50" />
              <Text style={[styles.parameterBlockLabel, { marginBottom: 0 }]}>Этап работы</Text>
            </View>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 8 }}>
              <Ionicons name="construct-outline" size={13} color="#f2ca50" />
              <Text style={[styles.parameterBlockLabel, { marginBottom: 0 }]}>Тип конструкции</Text>
            </View>
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

          {/* Блок: Тип анализа */}
          <View style={styles.parameterBlock}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 8 }}>
              <Ionicons name="analytics-outline" size={13} color="#f2ca50" />
              <Text style={[styles.parameterBlockLabel, { marginBottom: 0 }]}>Тип анализа</Text>
            </View>
            <View style={styles.pickerContainer}>
              {ANALYSIS_TYPES.map(item => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.pickerItemCompact,
                    analysisType === item.label && styles.pickerItemSelected
                  ]}
                  onPress={() => setAnalysisType(item.label)}
                >
                  <Text style={[
                    styles.pickerTextCompact,
                    analysisType === item.label && styles.pickerTextSelected
                  ]}>{item.label}</Text>
                  <View style={{
                    marginTop: 4,
                    alignSelf: 'center',
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: analysisType === item.label ? 'rgba(3,20,39,0.15)' : 'rgba(242,202,80,0.15)',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 8,
                    gap: 2,
                  }}>
                    <Ionicons name="flash" size={10} color={analysisType === item.label ? '#031427' : '#f2ca50'} />
                    <Text style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: analysisType === item.label ? '#031427' : '#f2ca50',
                    }}>{item.cost}</Text>
                  </View>
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
              <View style={styles.buttonContent}>
                <Ionicons name="cloud-upload-outline" size={20} color="#0a0f1d" />
                <Text style={styles.analyzeButtonText} numberOfLines={1} adjustsFontSizeToFit>
                  Отправить на экспертный разбор
                </Text>
              </View>
            </TouchableOpacity>

            {critiqueResult && (
              <TouchableOpacity
                onPress={resetAnalysisForm}
                style={{
                  marginTop: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(242,202,80,0.4)',
                }}
              >
                <Ionicons name="refresh-outline" size={16} color="#f2ca50" />
                <Text style={{ color: '#f2ca50', fontSize: 13, fontWeight: '600' }}>Повторить анализ</Text>
              </TouchableOpacity>
            )}

            {renderCritiqueResult()}
        </>
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


      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
      <CustomAlert
        visible={exitConfirmVisible}
        title="Выйти из анализа?"
        message="Все несохранённые данные будут потеряны."
        onClose={() => setExitConfirmVisible(false)}
        buttons={[
          { text: 'Остаться', onPress: () => setExitConfirmVisible(false), style: 'cancel' },
          { text: 'Выйти', onPress: () => { setExitConfirmVisible(false); router.back(); }, style: 'destructive' },
        ]}
      />
      <BottomTabBar />
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
    textAlign: 'center',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerTextCompact: {
    fontSize: 11,
    color: '#f2ca50',
    textAlign: 'center',
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
  quickSelectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.4)',
    backgroundColor: 'rgba(242,202,80,0.08)',
  },
  quickSelectBtnText: {
    fontSize: 11,
    color: '#f2ca50',
    fontWeight: '600',
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
    borderRadius: 6,
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
  ratingBlock: {
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingValue: {
    color: '#f2ca50',
    fontSize: 32,
    fontWeight: '800',
  },
});
