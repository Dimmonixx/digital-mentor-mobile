import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert,
  Image, ScrollView,
  StyleSheet, Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ANATOMY_LINES = [
  // Вертикальные валики
  { id: 'medial',   label: 'Медиальный валик',   x: 22, color: '#00c853', type: 'vertical' },
  { id: 'central',  label: 'Центральный валик',   x: 50, color: '#69f0ae', type: 'vertical' },
  { id: 'distal',   label: 'Дистальный валик',    x: 78, color: '#00c853', type: 'vertical' },
  // Горизонтальные перикиматы
  { id: 'peri1',    label: 'Перикиматы',          y: 30, color: '#ff9100', type: 'horizontal' },
  { id: 'peri2',    label: '',                    y: 50, color: '#ff9100', type: 'horizontal' },
  { id: 'peri3',    label: '',                    y: 68, color: '#ff9100', type: 'horizontal' },
  // Режущий край
  { id: 'incisal',  label: 'Линия режущего края', y: 85, color: '#ffff00', type: 'horizontal' },
];



const renderAnnotations = (
  imageLayout: {width: number, height: number} | null,
  visibility: Record<string, 'norm' | 'attention' | 'fix' | 'hidden'>
) => {
  if (!imageLayout) return null;
  const { width, height } = imageLayout;

  const getColor = (id: string, defaultColor: string) => {
    const status = visibility[id];
    if (status === 'fix') return '#ff1744';
    if (status === 'attention') return '#f2ca50';
    if (status === 'hidden') return 'transparent';
    return defaultColor;
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {ANATOMY_LINES.map((line) => {
        const color = getColor(line.id, line.color);
        if (color === 'transparent') return null;

        if (line.type === 'vertical') {
          const x = (line.x / 100) * width;
          return (
            <View key={line.id}>
              <View style={{
                position: 'absolute',
                left: x,
                top: 0,
                width: 2,
                height: height,
                backgroundColor: color,
                opacity: 0.85,
              }} />
                          </View>
          );
        }

        if (line.type === 'horizontal') {
          const y = (line.y / 100) * height;
          return (
            <View key={line.id}>
              <View style={{
                position: 'absolute',
                left: 0,
                top: y,
                width: width,
                height: 1.5,
                backgroundColor: color,
                opacity: 0.75,
              }} />
                          </View>
          );
        }
        return null;
      })}

          </View>
  );
};

export default function MorphologyScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [selectedPoint, setSelectedPoint] = useState<{x: number, y: number} | null>(null);
  const [imageLayout, setImageLayout] = useState<{width: number, height: number} | null>(null);
  const [pendingPayload, setPendingPayload] = useState<{
    base64: string;
    mime: 'image/jpeg' | 'image/png';
  } | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<{width: number, height: number} | null>(null);
  const [visibility, setVisibility] = useState<Record<string, 'norm' | 'attention' | 'fix' | 'hidden'>>({});
  const [editMode, setEditMode] = useState(false);
  const [rotation, setRotation] = useState(0);
  const insets = useSafeAreaInsets();

  const applyEdits = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const actions: ImageManipulator.Action[] = [];
      if (rotation !== 0) {
        actions.push({ rotate: rotation });
      }
      const edited = await ImageManipulator.manipulateAsync(
        image,
        actions,
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.9 }
      );
      setImage(edited.uri);
      setEditMode(false);
      setRotation(0);
    } catch(e) {
      Alert.alert('Ошибка', 'Не удалось применить изменения');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Нет доступа', 'Разрешите доступ к камере/галерее');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8, allowsEditing: true });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImage(asset.uri);
      setOriginalSize({ width: asset.width || 1000, height: asset.height || 1000 });
      setResult(null);
      setSelectedPoint(null);
      setEditMode(true);
      setRotation(0);
      
      const b64 = asset.base64;
      if (!b64) {
        Alert.alert('Ошибка', 'Не удалось получить данные изображения');
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
    }
  };

  const analyzeImage = async (imageUri: string) => {
    if (!OPENAI_API_KEY) {
      Alert.alert('Ошибка', 'OpenAI API ключ не настроен');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get image dimensions for cropping
      const imageInfo = await ImageManipulator.manipulateAsync(
        imageUri, [], { format: ImageManipulator.SaveFormat.JPEG }
      );
      const { width: imgWidth, height: imgHeight } = imageInfo;

      // Calculate crop coordinates for tooth area
      const cropWidth = Math.round(imgWidth * 0.4);
      const cropHeight = Math.round(imgHeight * 0.4);
      const cropX = Math.round(imgWidth * 0.3);
      const cropY = Math.round(imgHeight * 0.25);

      // Crop the tooth area
      const cropped = await ImageManipulator.manipulateAsync(
        imageUri,
        [{
          crop: {
            originX: cropX,
            originY: cropY,
            width: cropWidth,
            height: cropHeight,
          }
        }],
        { format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      const base64 = cropped.base64;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 3000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${base64}` }
              },
              {
                type: 'text',
                text: `You are a dental laboratory computer vision system analyzing tooth surface geometry.
This is a technical analysis for dental prosthetics manufacturing, not medical diagnosis.
Analyze the geometric surface structure of the tooth in the image.

Return ONLY a valid JSON object, no other text:
{
  "summary": "brief technical description of surface geometry",
  "elements": [
    {
      "name": "element name in Russian",
      "status": "norm or attention or fix",
      "description": "technical description in Russian"
    }
  ],
  "recommendations": ["recommendation in Russian"]
}

Analyze these geometric elements:
- Медиальный валик (medial ridge)
- Центральный валик (central ridge)  
- Дистальный валик (distal ridge)
- Перикиматы (perikymata lines)
- Контур зуба (tooth contour)
- Линия режущего края (incisal edge)
- Медиальный угол (medial angle)
- Дистальный угол (distal angle)

Return ONLY JSON.`
              }
            ]
          }]
        })
      });

      const data = await response.json();
      const text = data.choices[0].message.content;
      console.log('GPT response:', text);

      // Убираем markdown блоки если есть
      let clean = text.trim();
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        clean = jsonMatch[0];
      }

      try {
        const parsed = JSON.parse(clean);
        setResult(parsed);
      } catch (e) {
        // Если JSON не парсится - показываем текст как есть
        setResult({ 
          summary: text,
          elements: [],
          recommendations: []
        });
      }
    } catch (error: any) {
      console.log('Ошибка анализа:', JSON.stringify(error));
      Alert.alert('Ошибка', error.message || JSON.stringify(error));
    } finally {
      setLoading(false);
    }
  };

  const analyzeSelectedTooth = async () => {
  if (!image || !selectedPoint || !imageLayout) return;
  setLoading(true);
  try {
    const imageInfo = await ImageManipulator.manipulateAsync(
      image, [], { format: ImageManipulator.SaveFormat.JPEG, base64: true, compress: 0.6 }
    );
    
    const { width: imgWidth, height: imgHeight } = imageInfo;
    const scaleX = imgWidth / imageLayout.width;
    const scaleY = imgHeight / imageLayout.height;
    
    // Координаты выбранной области в процентах от оригинала
    const centerX = Math.round(selectedPoint.x * scaleX * 100 / imgWidth);
    const centerY = Math.round(selectedPoint.y * scaleY * 100 / imgHeight);
    const cropSize = 25; // 25% от размера изображения
    
    const x1 = Math.max(0, centerX - cropSize/2);
    const y1 = Math.max(0, centerY - cropSize/2);
    const x2 = Math.min(100, centerX + cropSize/2);
    const y2 = Math.min(100, centerY + cropSize/2);

    // Сохрани обрезанное фото только для показа
    const cropped = await ImageManipulator.manipulateAsync(
      image,
      [{
        crop: {
          originX: Math.round(x1 * imgWidth / 100),
          originY: Math.round(y1 * imgHeight / 100),
          width: Math.round((x2-x1) * imgWidth / 100),
          height: Math.round((y2-y1) * imgHeight / 100),
        }
      }],
      { format: ImageManipulator.SaveFormat.JPEG }
    );
    setCroppedImage(cropped.uri);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageInfo.base64}` }
            },
            {
              type: 'text',
              text: `You are a computer vision system for dental prosthetics CAD/CAM software.
Analyze the tooth located in region x:${x1}-${x2}%, y:${y1}-${y2}% of this image.
Focus ONLY on the tooth in that region.

Return ONLY valid JSON:
{
  "summary": "описание геометрии зуба на русском 3-4 предложения",
  "elements": [
    {
      "name": "название элемента на русском",
      "status": "norm или attention или fix",
      "description": "описание 2-3 предложения на русском",
      "type": "line или point",
      "points": [[x1,y1],[x2,y2]],
      "color": "#цвет hex"
    }
  ],
  "recommendations": ["рекомендация на русском"]
}

Coordinates are percentages within the SELECTED REGION (${x1}-${x2}% x, ${y1}-${y2}% y).
So x=0 means left edge of selected tooth, x=100 means right edge.
y=0 means top of selected tooth, y=100 means bottom.

Analyze:
- Медиальный валик: type line, color #00b400
- Центральный валик: type line, color #64dc64
- Дистальный валик: type line, color #007800
- Перикиматы: type line, color #ff8c00
- Контур зуба: type line, color #c8c8c8
- Линия режущего края: type line, color #ffff64
- Медиальный угол: type point, color #00ffc8
- Дистальный угол: type point, color #00c8ff
- Поверхностный блик: type point, color #c8c8ff

Return ONLY JSON.`
            }
          ]
        }]
      })
    });

    const responseText = await response.text();
    const data = JSON.parse(responseText);
    
    if (!data.choices?.[0]) {
      Alert.alert('Ошибка', JSON.stringify(data));
      return;
    }

    const text = data.choices[0].message.content;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const clean = jsonMatch ? jsonMatch[0] : text;
    
    try {
      setResult(JSON.parse(clean));
    } catch(e) {
      setResult({ summary: text, elements: [], recommendations: [] });
    }
  } catch (error: any) {
    Alert.alert('Ошибка', error.message || 'Неизвестная ошибка');
  } finally {
    setLoading(false);
  }
};

  const statusColor = (status: string) => {
    if (status === 'fix') return '#ff4444';
    if (status === 'attention') return '#f2ca50';
    return '#4caf50';
  };

  const statusIcon = (status: string) => {
    if (status === 'fix') return '🔴';
    if (status === 'attention') return '🟡';
    return '🟢';
  };

  if (editMode) {
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          setEditMode(false);
          setImage(null);
        }}>
          <Ionicons name="arrow-back" size={24} color="#f2ca50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Редактор фото</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={{ flex: 1 }}>
        {/* Превью с трансформацией */}
        <View style={{ 
          flex: 1, 
          justifyContent: 'center', 
          alignItems: 'center',
          backgroundColor: '#000',
        }}>
          <Image
            source={{ uri: image }}
            style={{
              width: '90%',
              height: 300,
              resizeMode: 'contain',
              transform: [{ rotate: `${rotation}deg` }],
            }}
          />
        </View>

        {/* Слайдер поворота */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
          <Text style={{ 
            color: '#f2ca50', 
            textAlign: 'center', 
            marginBottom: 8,
            fontSize: 14,
          }}>
            Поворот: {rotation}°
          </Text>
          
          {/* Кнопки поворота */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'center', 
            gap: 12,
            marginBottom: 16,
          }}>
            <TouchableOpacity
              style={{
                backgroundColor: 'rgba(242,202,80,0.15)',
                borderWidth: 1,
                borderColor: '#f2ca50',
                borderRadius: 12,
                padding: 12,
                alignItems: 'center',
                flex: 1,
              }}
              onPress={() => setRotation(r => r - 90)}
            >
              <Text style={{ color: '#f2ca50', fontSize: 24 }}>↺</Text>
              <Text style={{ color: '#f2ca50', fontSize: 12 }}>-90°</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: 'rgba(242,202,80,0.15)',
                borderWidth: 1,
                borderColor: '#f2ca50',
                borderRadius: 12,
                padding: 12,
                alignItems: 'center',
                flex: 1,
              }}
              onPress={() => setRotation(r => r - 1)}
            >
              <Text style={{ color: '#f2ca50', fontSize: 24 }}>←</Text>
              <Text style={{ color: '#f2ca50', fontSize: 12 }}>-1°</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: 'rgba(242,202,80,0.15)',
                borderWidth: 1,
                borderColor: '#f2ca50',
                borderRadius: 12,
                padding: 12,
                alignItems: 'center',
                flex: 1,
              }}
              onPress={() => setRotation(0)}
            >
              <Text style={{ color: '#f2ca50', fontSize: 18 }}>⊙</Text>
              <Text style={{ color: '#f2ca50', fontSize: 12 }}>Сброс</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: 'rgba(242,202,80,0.15)',
                borderWidth: 1,
                borderColor: '#f2ca50',
                borderRadius: 12,
                padding: 12,
                alignItems: 'center',
                flex: 1,
              }}
              onPress={() => setRotation(r => r + 1)}
            >
              <Text style={{ color: '#f2ca50', fontSize: 24 }}>→</Text>
              <Text style={{ color: '#f2ca50', fontSize: 12 }}>+1°</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: 'rgba(242,202,80,0.15)',
                borderWidth: 1,
                borderColor: '#f2ca50',
                borderRadius: 12,
                padding: 12,
                alignItems: 'center',
                flex: 1,
              }}
              onPress={() => setRotation(r => r + 90)}
            >
              <Text style={{ color: '#f2ca50', fontSize: 24 }}>↻</Text>
              <Text style={{ color: '#f2ca50', fontSize: 12 }}>+90°</Text>
            </TouchableOpacity>
          </View>

          {/* Применить */}
          <TouchableOpacity
            style={{
              backgroundColor: '#f2ca50',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
            }}
            onPress={applyEdits}
          >
            <Text style={{ 
              color: '#031427', 
              fontSize: 16, 
              fontWeight: '700' 
            }}>
              ✓ Применить и продолжить
            </Text>
          </TouchableOpacity>

          {/* Отмена */}
          <TouchableOpacity
            style={{ alignItems: 'center', marginTop: 12, paddingVertical: 8 }}
            onPress={() => {
              setImage(null);
              setEditMode(false);
              setRotation(0);
            }}
          >
            <Text style={{ color: 'rgba(242,202,80,0.5)', fontSize: 14 }}>
              Выбрать другое фото
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#f2ca50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Морфология зуба</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
        {image && (
          <View style={{ width: '100%', paddingHorizontal: 16, marginBottom: 16 }}>
            <View style={{ width: '100%', height: 300, overflow: 'hidden' }}>
              <Image 
                source={{ uri: croppedImage || image }} 
                style={{ width: '100%', height: 300, borderRadius: 12 }}
                resizeMode="contain"
                onLayout={(e) => setImageLayout({
                  width: e.nativeEvent.layout.width,
                  height: e.nativeEvent.layout.height,
                })}
              />
              {renderAnnotations(imageLayout, visibility)}
            </View>

            
            {image && !loading && (
              <TouchableOpacity 
                style={[styles.btn, { marginTop: 16 }]}
                onPress={() => analyzeSelectedTooth()}
              >
                <Text style={styles.btnText}>Анализировать морфологию</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={{ marginTop: 12, alignItems: 'center' }}
              onPress={() => { setImage(null); setResult(null); setSelectedPoint(null); setPendingPayload(null); setCroppedImage(null); }}
            >
              <Text style={{ color: '#f2ca5080', fontSize: 14 }}>Выбрать другое фото</Text>
            </TouchableOpacity>
          </View>
        )}

        {!image && (
          <View style={styles.buttonsContainer}>
            <TouchableOpacity style={styles.btn} onPress={() => pickImage(true)}>
              <Ionicons name="camera" size={24} color="#031427" />
              <Text style={styles.btnText}>Сфотографировать</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={() => pickImage(false)}>
              <Ionicons name="images" size={24} color="#f2ca50" />
              <Text style={[styles.btnText, { color: '#f2ca50' }]}>Из галереи</Text>
            </TouchableOpacity>
          </View>
        )}

        
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f2ca50" />
            <Text style={styles.loadingText}>GPT-4o анализирует морфологию...</Text>
          </View>
        )}

        {result && (
          <View style={styles.resultContainer}>
            <TouchableOpacity
              onLongPress={() => {
                // Use a simple approach - the text is selectable anyway
                Alert.alert('Копирование', 'Текст доступен для выбора и копирования');
              }}
            >
              <Text 
                selectable={true}
                style={styles.summaryText}
              >
                {result.summary}
              </Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Элементы</Text>
            {result.elements?.map((el: any, i: number) => (
              <View key={i} style={[styles.elementCard, { borderColor: statusColor(el.status) }]}>
                <Text style={styles.elementName}>{statusIcon(el.status)} {el.name}</Text>
                <TouchableOpacity
                  onLongPress={() => {
                    Alert.alert('Копирование', 'Текст доступен для выбора и копирования');
                  }}
                >
                  <Text 
                    selectable={true}
                    style={styles.elementDesc}
                  >
                    {el.description}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}

            {result.recommendations?.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Рекомендации</Text>
                {result.recommendations.map((rec: string, i: number) => (
                  <Text key={i} style={styles.recommendation}>• {rec}</Text>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#031427' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f2ca50',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f2ca50',
  },
  scroll: { flex: 1 },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginTop: 40,
  },
  btn: {
    backgroundColor: '#f2ca50',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 140,
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#f2ca50',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#031427',
    marginTop: 8,
  },
  imageContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  image: { 
    width: '100%', 
    height: 300, 
    borderRadius: 12,
    backgroundColor: '#ffffff10',
  },
  retakeBtn: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(242, 202, 80, 0.2)',
    borderRadius: 8,
  },
  retakeText: {
    color: '#f2ca50',
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 16,
  },
  resultContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  summaryText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#f2ca50',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  elementCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  elementName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  elementDesc: {
    color: '#ffffff80',
    fontSize: 14,
    lineHeight: 20,
  },
  recommendation: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
});
