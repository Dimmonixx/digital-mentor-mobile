import GlobalHeader from '@/components/global-header';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    ImageBackground,
    Modal,
    PanResponder,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── TYPES ──────────────────────────────────────────
type ViewMode = 'normal' | 'mono' | 'clay' | 'relief' | 'contour';
type Preset = {
  name: string;
  description: string;
  color: string;
  icon: string;
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
};

// ─── PRESETS ────────────────────────────────────────
const PRESETS: Preset[] = [
  {
    name: 'Сброс',
    description: 'Все параметры по умолчанию',
    color: '#888',
    icon: 'refresh-outline',
    brightness: 1, contrast: 1, saturation: 1, sharpness: 0,
  },
  {
    name: 'Анализ трещин',
    description: 'Контраст ×2.5 · Детализация макс · Без цвета',
    color: '#e74c3c',
    icon: 'analytics-outline',
    brightness: 1.1, contrast: 2.5, saturation: 0.1, sharpness: 1,
  },
  {
    name: 'Мамелоны',
    description: 'Контраст ×1.8 · Детализация высокая · Цвет приглушён',
    color: '#3498db',
    icon: 'ellipse-outline',
    brightness: 1.05, contrast: 1.8, saturation: 0.4, sharpness: 0.85,
  },
  {
    name: 'Цвет дентина',
    description: 'Насыщенность ×2.5 · Яркость +10% · Контраст мягкий',
    color: '#f2ca50',
    icon: 'color-palette-outline',
    brightness: 1.1, contrast: 1.1, saturation: 2.5, sharpness: 0.1,
  },
  {
    name: 'Рельеф',
    description: 'Монохром · Контраст ×3 · Максимальная детализация',
    color: '#9b59b6',
    icon: 'layers-outline',
    brightness: 1.2, contrast: 3, saturation: 0, sharpness: 1,
  },
];

// ─── CSS FILTER BUILDER ─────────────────────────────
const buildFilter = (
  brightness: number,
  contrast: number,
  saturation: number,
  sharpness: number,
  viewMode: ViewMode,
): string => {
  let grayscale = 0;
  let sepia = 0;
  let extraContrast = contrast;
  let extraBrightness = brightness;

  switch (viewMode) {
    case 'mono':
      grayscale = 1;
      break;
    case 'clay':
      grayscale = 1;
      sepia = 0.3;
      extraBrightness *= 0.95;
      break;
    case 'relief':
      grayscale = 1;
      extraContrast *= 2;
      extraBrightness *= 1.1;
      break;
    case 'contour':
      grayscale = 1;
      extraContrast *= 3;
      extraBrightness *= 0.8;
      break;
  }

  return [
    `brightness(${extraBrightness})`,
    `contrast(${extraContrast})`,
    `saturate(${viewMode === 'normal' ? saturation : 0})`,
    `grayscale(${grayscale})`,
    `sepia(${sepia})`,
    sharpness > 0 ? `blur(${(1 - sharpness) * 0.5}px)` : '',
  ].filter(Boolean).join(' ');
};

// ─── SLIDER ─────────────────────────────────────────
const Slider = ({
  label, value, min, max, step = 0.05, onChange, description, resetValue,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; onChange: (v: number) => void; description: string; resetValue: number;
}) => {
  const range = max - min;
  const percent = ((value - min) / range) * 100;
  const trackX = useRef(0);
  const trackW = useRef(SCREEN_WIDTH - 48);

  const clamp = (v: number) =>
    Math.min(Math.max(Math.round(v / step) * step, min), max);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const p = Math.min(Math.max((e.nativeEvent.pageX - trackX.current) / trackW.current, 0), 1);
      onChange(clamp(min + p * range));
    },
    onPanResponderMove: (e) => {
      const p = Math.min(Math.max((e.nativeEvent.pageX - trackX.current) / trackW.current, 0), 1);
      onChange(clamp(min + p * range));
    },
  })).current;

  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.header}>
        <Text style={sliderStyles.label}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={() => onChange(resetValue)} style={{ padding: 2 }}>
            <Ionicons name="refresh-outline" size={14} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onChange(Math.max(min, parseFloat((value - step).toFixed(4))))}
            style={sliderStyles.stepBtn}>
            <Ionicons name="remove" size={14} color="#f2ca50" />
          </TouchableOpacity>
          <Text style={sliderStyles.value}>{value.toFixed(2)}</Text>
          <TouchableOpacity
            onPress={() => onChange(Math.min(max, parseFloat((value + step).toFixed(4))))}
            style={sliderStyles.stepBtn}>
            <Ionicons name="add" size={14} color="#f2ca50" />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={sliderStyles.description}>{description}</Text>
      <View
        style={sliderStyles.track}
        onLayout={(e) => {
          e.target.measure((_x, _y, width, _h, pageX) => {
            trackX.current = pageX;
            trackW.current = width;
          });
        }}
        {...panResponder.panHandlers}
      >
        <View style={[sliderStyles.fill, { width: `${percent}%` as any }]} />
        <View style={[sliderStyles.thumb, { left: `${percent}%` as any }]} />
      </View>
    </View>
  );
};

const sliderStyles = StyleSheet.create({
  container:   { marginBottom: 20 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  label:       { color: '#f2ca50', fontSize: 14, fontWeight: '600' },
  value:       { color: '#f2ca50', fontSize: 13 },
  stepBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#1a1208', borderWidth: 1, borderColor: 'rgba(242,202,80,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  description: { color: '#666', fontSize: 11, marginBottom: 10 },
  track: {
    height: 4, backgroundColor: '#222', borderRadius: 2,
    position: 'relative', justifyContent: 'center',
  },
  fill: {
    height: 4, backgroundColor: '#f2ca50', borderRadius: 2,
    position: 'absolute', left: 0,
  },
  thumb: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#f2ca50', position: 'absolute',
    marginLeft: -9, top: -7,
    shadowColor: '#f2ca50', shadowOpacity: 0.6, shadowRadius: 4, elevation: 4,
  },
});

// ─── MAIN SCREEN ────────────────────────────────────
export default function DetalizationScreen() {
  const { uri: paramUri } = useLocalSearchParams<{ uri: string }>();
  const insets = useSafeAreaInsets();

  const [photoUri, setPhotoUri] = useState<string | null>(paramUri ?? null);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [diamonds, setDiamonds] = useState<number>(() => (globalThis as any).getDiamondBalance?.() ?? 0);

  const [brightness,  setBrightness]  = useState(1);
  const [contrast,    setContrast]    = useState(1);
  const [saturation,  setSaturation]  = useState(1);
  const [sharpness,   setSharpness]   = useState(0);
  const [viewMode,    setViewMode]    = useState<ViewMode>('normal');
  const [showBefore,  setShowBefore]  = useState(false);
  const [showMarkers, setShowMarkers] = useState(false);
  const [markers, setMarkers] = useState<{ x: number; y: number; label: string; id: string }[]>([]);
  const [pendingMarker, setPendingMarker] = useState<{ x: number; y: number } | null>(null);
  const [markerLabel,   setMarkerLabel]   = useState('');
  const [magnifier, setMagnifier] = useState<{ x: number; y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'sliders' | 'modes' | 'presets' | 'analysis'>('sliders');
  const [opticalResult, setOpticalResult] = useState<any>(null);
  const [opticalLoading, setOpticalLoading] = useState(false);

  const filterString = buildFilter(brightness, contrast, saturation, sharpness, viewMode);
  const imageHeight  = SCREEN_WIDTH * 0.75;

  const pickPhoto = async () => {
    setPickingPhoto(true);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    setPickingPhoto(false);
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    } else if (!photoUri) {
      router.back();
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const applyPreset = (preset: Preset) => {
    setBrightness(preset.brightness);
    setContrast(preset.contrast);
    setSaturation(preset.saturation);
    setSharpness(preset.sharpness);
  };

  const savePhoto = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Нет доступа', 'Разрешите доступ к галерее в настройках');
        return;
      }
      const result = await ImageManipulator.manipulateAsync(
        photoUri!,
        [{ resize: { width: 1080 } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      await MediaLibrary.saveToLibraryAsync(result.uri);
      Alert.alert('Сохранено', 'Фото сохранено в галерею');
    } catch (e) {
      console.error(e);
      Alert.alert('Ошибка', String(e));
    }
  };

  const runOpticalAnalysis = async () => {
    if (!photoUri) {
      Alert.alert('Ошибка', 'Сначала загрузите фото');
      return;
    }
    setOpticalLoading(true);
    setOpticalResult(null);
    try {
      const imageUrl = await uploadMediaToServer(photoUri);
      if (!imageUrl) {
        Alert.alert('Ошибка', 'Не удалось загрузить фото');
        return;
      }
      const rawUser = await AsyncStorage.getItem('user');
      const user = rawUser ? JSON.parse(rawUser) : null;
      const userId = user?.id || user?.email || 'unknown';
      const response = await fetch('http://62.238.13.160:8000/analysis/optical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          image_url: imageUrl,
          parameters: {
            texture: 'natural',
            transparency: 'high',
            macro_relief: 'pronounced',
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        Alert.alert('Ошибка', data.detail || 'Не удалось выполнить анализ');
        return;
      }
      setOpticalResult(data);
    } catch (e) {
      console.error(e);
      Alert.alert('Ошибка', 'Не удалось связаться с сервером');
    } finally {
      setOpticalLoading(false);
    }
  };

  const imagePanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant:  (e) => setMagnifier({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }),
    onPanResponderMove:   (e) => setMagnifier({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }),
    onPanResponderRelease: () => setTimeout(() => setMagnifier(null), 300),
  })).current;

  const handleImageTap = (e: any) => {
    if (!showMarkers) return;
    setPendingMarker({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY });
    setMarkerLabel('');
  };

  const confirmMarker = () => {
    if (!pendingMarker) return;
    setMarkers(prev => [...prev, { ...pendingMarker, label: markerLabel || 'Метка', id: Date.now().toString() }]);
    setPendingMarker(null);
  };

  const VIEW_MODES: { key: ViewMode; label: string; icon: string; hint: string }[] = [
    { key: 'normal',  label: 'Нормальный', icon: 'eye-outline',      hint: 'Оригинал без изменений'                        },
    { key: 'mono',    label: 'Монохром',   icon: 'contrast-outline',  hint: 'Убирает цвет — только форма и рельеф'          },
    { key: 'clay',    label: 'Глиняный',   icon: 'ellipse-outline',   hint: 'Имитация воска — тёплый серо-коричневый'       },
    { key: 'relief',  label: 'Рельеф',     icon: 'layers-outline',    hint: 'Максимальный рельеф — все выпуклости видны'    },
    { key: 'contour', label: 'Контурный',  icon: 'scan-outline',      hint: 'Только границы форм — как на чертеже'         },
  ];

  if (!photoUri) {
    return (
      <ImageBackground
        source={require('@/assets/images/background.png')}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="light" backgroundColor="#0a0a1a" />

        {/* ── ГЛОБАЛЬНЫЙ ХЕДЕР ── */}
        <GlobalHeader diamonds={diamonds} />

        {/* ── СТРОКА НАЗАД + ЗАГОЛОВОК ── */}
        <View style={styles.subHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#f2ca50" />
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>Оптическая диагностика</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* ── КНОПКИ ── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.startActions}>
            <TouchableOpacity style={styles.startPrimaryBtn} onPress={takePhoto} activeOpacity={0.85}>
              <Ionicons name="camera-outline" size={22} color="#031427" />
              <Text style={styles.startPrimaryBtnText}>Сфотографировать</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.startSecondaryBtn} onPress={pickPhoto} activeOpacity={0.85}>
              <Ionicons name="images-outline" size={22} color="#f2ca50" />
              <Text style={styles.startSecondaryBtnText}>Из галереи</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.startRecommendationsBtn}
            onPress={() => {
              Alert.alert(
                'Рекомендации для точного результата',
                'Фотографируйте работу при естественном освещении.\n\nИзбегайте бликов и теней.\n\nРасполагайте камеру перпендикулярно поверхности работы.'
              );
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.startRecommendationsBtnText}>
              💡 Рекомендации для точного результата
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </ImageBackground>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#05080f' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#f2ca50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Оптическая диагностика</Text>
        <TouchableOpacity
          onPress={() => setShowMarkers(!showMarkers)}
          style={[styles.headerBtn, showMarkers && styles.headerBtnActive]}
        >
          <Ionicons name="pin-outline" size={22} color={showMarkers ? '#f2ca50' : '#555'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/detalization-info' as any)} style={styles.headerBtn}>
          <Ionicons name="information-circle-outline" size={22} color="#f2ca50" />
        </TouchableOpacity>
        <TouchableOpacity onPress={savePhoto} style={styles.headerBtn}>
          <Ionicons name="download-outline" size={22} color="#f2ca50" />
        </TouchableOpacity>
      </View>

      {/* ── IMAGE AREA ── */}
      <View
        style={{ width: SCREEN_WIDTH, height: imageHeight }}
        {...imagePanResponder.panHandlers}
        onTouchEnd={handleImageTap}
      >
        <Image
          source={{ uri: photoUri }}
          style={[
            { width: SCREEN_WIDTH, height: imageHeight, resizeMode: 'cover' },
            showBefore ? {} : { filter: filterString } as any,
          ]}
        />

        {/* Before/After */}
        <TouchableOpacity
          onPressIn={() => setShowBefore(true)}
          onPressOut={() => setShowBefore(false)}
          style={styles.beforeBtn}
        >
          <Text style={styles.beforeBtnText}>{showBefore ? 'ОРИГИНАЛ' : 'УДЕРЖИ — ДО'}</Text>
        </TouchableOpacity>

        {/* Mode badge */}
        {viewMode !== 'normal' && (
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>
              {VIEW_MODES.find(m => m.key === viewMode)?.label}
            </Text>
          </View>
        )}

        {/* Markers */}
        {markers.map(marker => (
          <TouchableOpacity
            key={marker.id}
            onLongPress={() => setMarkers(prev => prev.filter(m => m.id !== marker.id))}
            style={{ position: 'absolute', left: marker.x - 12, top: marker.y - 12 }}
          >
            <View style={styles.markerDot}>
              <Ionicons name="location" size={14} color="#1a0d00" />
            </View>
            <View style={styles.markerLabel}>
              <Text style={styles.markerLabelText}>{marker.label}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Magnifier */}
        {magnifier && (
          <View style={[styles.magnifier, { left: magnifier.x - 90, top: magnifier.y - 200 }]}>
            <Image
              source={{ uri: photoUri }}
              style={{
                width: SCREEN_WIDTH * 2.5,
                height: imageHeight * 2.5,
                position: 'absolute',
                left: -(magnifier.x * 2.5 - 90),
                top: -(magnifier.y * 2.5 - 90),
                filter: filterString,
              } as any}
            />
          </View>
        )}
      </View>

      {/* ── TABS ── */}
      <View style={styles.tabBar}>
        {([
          { key: 'sliders', label: 'Коррекция' },
          { key: 'modes',   label: 'Режимы'    },
          { key: 'presets', label: 'Пресеты'   },
          { key: 'analysis', label: 'Анализ'   },
        ] as const).map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── TAB CONTENT ── */}
      <ScrollView style={{ flex: 1, backgroundColor: '#0a0d14' }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>

        {activeTab === 'sliders' && (
          <>
            <TouchableOpacity
              onPress={() => { setBrightness(1); setContrast(1); setSaturation(1); setSharpness(0); }}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#1a1208', borderRadius: 10,
                borderWidth: 1, borderColor: 'rgba(242,202,80,0.4)',
                padding: 10, marginBottom: 16,
              }}>
              <Ionicons name="refresh" size={16} color="#f2ca50" style={{ marginRight: 6 }} />
              <Text style={{ color: '#f2ca50', fontSize: 13, fontWeight: '600' }}>Сбросить все</Text>
            </TouchableOpacity>
            <Slider label="Яркость" value={brightness} min={0.3} max={2} resetValue={1} onChange={setBrightness}
              description="Общая освещённость — для пришеечной области и теневых зон" />
            <Slider label="Контраст" value={contrast} min={0.5} max={3} resetValue={1} onChange={setContrast}
              description="Различие светлых и тёмных участков — для макро и микрорельефа" />
            <Slider label="Насыщенность" value={saturation} min={0} max={3} resetValue={1} onChange={setSaturation}
              description="Интенсивность цвета — для хроматичности и оттенков дентина" />
            <Slider label="Детализация" value={sharpness} min={0} max={1} resetValue={0} onChange={setSharpness}
              description="Локальные переходы — для мамелонов, трещин и границ масс" />
          </>
        )}

        {activeTab === 'modes' && (
          <View style={{ gap: 10 }}>
            {VIEW_MODES.map(mode => (
              <TouchableOpacity
                key={mode.key}
                onPress={() => setViewMode(mode.key)}
                style={[styles.modeRow, viewMode === mode.key && styles.modeRowActive]}
              >
                <Ionicons
                  name={mode.icon as any} size={22}
                  color={viewMode === mode.key ? '#f2ca50' : '#555'}
                  style={{ marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modeLabel, viewMode === mode.key && styles.modeLabelActive]}>
                    {mode.label}
                  </Text>
                  <Text style={styles.modeHint}>{mode.hint}</Text>
                </View>
                {viewMode === mode.key && (
                  <Ionicons name="checkmark-circle" size={20} color="#f2ca50" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'presets' && (
          <View style={{ gap: 10 }}>
            {PRESETS.map(preset => (
              <TouchableOpacity
                key={preset.name}
                onPress={() => applyPreset(preset)}
                style={[
                  styles.presetRow,
                  { borderColor: preset.color + '80', borderWidth: 1.5 },
                ]}
              >
                <View style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: preset.color + '20',
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons name={preset.icon as any} size={20} color={preset.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.presetName, { color: preset.color }]}>{preset.name}</Text>
                  <Text style={styles.presetMeta}>{preset.description}</Text>
                </View>
                <Ionicons name="flash-outline" size={16} color={preset.color + '80'} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'analysis' && (
          <View style={{ gap: 16 }}>
            <TouchableOpacity
              onPress={runOpticalAnalysis}
              disabled={opticalLoading || !photoUri}
              style={[
                styles.analyzeBtn,
                (!photoUri || opticalLoading) && styles.analyzeBtnDisabled,
              ]}
            >
              <Ionicons name="scan-outline" size={22} color="#031427" />
              <Text style={styles.analyzeBtnText}>
                {opticalLoading ? 'Анализ...' : 'Отправить на оптический анализ'}
              </Text>
            </TouchableOpacity>

            {opticalResult?.results && (
              <View style={styles.opticalResultCard}>
                <View style={styles.opticalResultHeader}>
                  <Ionicons name="eye-outline" size={22} color="#f2ca50" />
                  <Text style={styles.opticalResultTitle}>РЕЗУЛЬТАТЫ ОПТИКИ</Text>
                </View>
                <Text style={styles.opticalResultSummary}>{opticalResult.summary}</Text>
                {Object.entries(opticalResult.results as Record<string, any>).map(([key, value]) => (
                  <View key={key} style={styles.opticalMetricBlock}>
                    <Text style={styles.opticalMetricName}>{value.verdict}</Text>
                    <Text style={styles.opticalMetricValue}>Балл: {value.score}/10</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* ── MARKER MODAL ── */}
      <Modal visible={!!pendingMarker} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Название метки</Text>
            <TextInput
              value={markerLabel}
              onChangeText={setMarkerLabel}
              placeholder="Мамелон, трещина, граница..."
              placeholderTextColor="#555"
              style={styles.modalInput}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setPendingMarker(null)}
                style={styles.modalBtnCancel}
              >
                <Text style={{ color: '#888' }}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmMarker} style={styles.modalBtnConfirm}>
                <Text style={{ color: '#1a0d00', fontWeight: '700' }}>Добавить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
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
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(242,202,80,0.18)',
    backgroundColor: '#05080f',
  },
  headerBtn:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerBtnActive: { backgroundColor: 'rgba(242,202,80,0.12)', borderRadius: 20 },
  headerTitle:     { flex: 1, color: '#f2ca50', fontSize: 18, fontWeight: '700', marginLeft: 4 },

  beforeBtn: {
    position: 'absolute', bottom: 10, left: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#f2ca50',
  },
  beforeBtnText: { color: '#f2ca50', fontSize: 11, fontWeight: '700' },

  modeBadge: {
    position: 'absolute', bottom: 10, right: 12,
    backgroundColor: 'rgba(242,202,80,0.18)',
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#f2ca50',
  },
  modeBadgeText: { color: '#f2ca50', fontSize: 11 },

  markerDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#f2ca50', alignItems: 'center', justifyContent: 'center',
  },
  markerLabel: {
    position: 'absolute', top: -22, left: -20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(242,202,80,0.4)',
  },
  markerLabelText: { color: '#f2ca50', fontSize: 10 },

  magnifier: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 2, borderColor: '#f2ca50',
    overflow: 'hidden', backgroundColor: '#000',
  },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: 'rgba(242,202,80,0.18)',
    backgroundColor: '#0a0d14',
  },
  tabItem: {
    flex: 1, paddingVertical: 11, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: '#f2ca50' },
  tabText:       { color: '#555', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#f2ca50' },

  modeRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 12,
    backgroundColor: '#111318',
    borderWidth: 1, borderColor: '#222',
  },
  modeRowActive:   { backgroundColor: '#1e1400', borderColor: '#f2ca50' },
  modeLabel:       { color: '#888', fontSize: 15, fontWeight: '600' },
  modeLabelActive: { color: '#f2ca50' },
  modeHint:        { color: '#444', fontSize: 11, marginTop: 2 },

  presetRow: {
    padding: 14, borderRadius: 12,
    backgroundColor: '#111318',
    borderWidth: 1, borderColor: '#222',
    flexDirection: 'row', alignItems: 'center',
  },
  presetName: { color: '#f2ca50', fontSize: 15, fontWeight: '600' },
  presetMeta: { color: '#555', fontSize: 11, marginTop: 2 },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#1a1208', borderRadius: 16,
    padding: 20, width: SCREEN_WIDTH - 48,
    borderWidth: 1, borderColor: '#f2ca50',
  },
  modalTitle: { color: '#f2ca50', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  modalInput: {
    backgroundColor: '#0a0d14', borderRadius: 8,
    borderWidth: 1, borderColor: '#2a2a2a',
    color: '#fff', padding: 12, fontSize: 14, marginBottom: 16,
  },
  modalBtnCancel: {
    flex: 1, padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center',
  },
  modalBtnConfirm: {
    flex: 1, padding: 12, borderRadius: 8,
    backgroundColor: '#f2ca50', alignItems: 'center',
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  subHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#f2ca50',
    fontSize: 18,
    fontWeight: '700',
  },
  startActions: {
    gap: 12,
  },
  startPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f2ca50',
    paddingVertical: 16,
    borderRadius: 14,
  },
  startPrimaryBtnText: {
    color: '#031427',
    fontSize: 16,
    fontWeight: '700',
  },
  startSecondaryBtn: {
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
  startSecondaryBtnText: {
    color: '#f2ca50',
    fontSize: 16,
    fontWeight: '700',
  },
  startRecommendationsBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#f2ca5060',
    borderRadius: 20,
    backgroundColor: 'transparent',
    marginTop: 40,
  },
  startRecommendationsBtnText: {
    color: '#f2ca50',
    fontSize: 13,
    opacity: 0.7,
    textAlign: 'center',
  },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f2ca50',
    paddingVertical: 16,
    borderRadius: 14,
  },
  analyzeBtnDisabled: {
    opacity: 0.5,
  },
  analyzeBtnText: {
    color: '#031427',
    fontSize: 15,
    fontWeight: '700',
  },
  opticalResultCard: {
    backgroundColor: 'rgba(10, 16, 30, 0.92)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.45)',
    gap: 12,
  },
  opticalResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  opticalResultTitle: {
    color: '#f2ca50',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  opticalResultSummary: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 18,
  },
  opticalMetricBlock: {
    backgroundColor: 'rgba(242, 202, 80, 0.1)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.25)',
  },
  opticalMetricName: {
    color: '#f2ca50',
    fontSize: 14,
    fontWeight: '700',
  },
  opticalMetricValue: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 4,
  },
});
