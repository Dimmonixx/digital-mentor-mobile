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
import { OPENAI_API_KEY } from '../constants/config';

const renderAnnotations = (result: any, imageLayout: {width: number, height: number} | null) => {
  if (!result || !result.elements || !imageLayout) return null;
  const { width, height } = imageLayout;
  
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {result.elements.map((el: any, i: number) => {
        const color = el.color || '#f2ca50';
        const points = el.points || [];
        
        if (el.type === 'point' && points.length >= 1) {
          return (
            <View key={i} style={{
              position: 'absolute',
              left: points[0][0] * width / 100 - 6,
              top: points[0][1] * height / 100 - 6,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: color,
            }} />
          );
        }

        if (el.type === 'line' && points.length >= 2) {
          return (
            <View key={i} style={{
              position: 'absolute',
              left: points[0][0] * width / 100,
              top: points[0][1] * height / 100,
              width: 2,
              height: Math.abs((points[1][1] - points[0][1]) * height / 100),
              backgroundColor: color,
              transform: [{
                rotate: `${Math.atan2(
                  (points[1][1] - points[0][1]) * height,
                  (points[1][0] - points[0][0]) * width
                ) * 180 / Math.PI}deg`
              }],
              transformOrigin: 'top left',
            }} />
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
  const insets = useSafeAreaInsets();

  const pickImage = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Нет доступа', 'Разрешите доступ к камере/галерее');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8, allowsEditing: false });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImage(asset.uri);
      setResult(null);
      setSelectedPoint(null);
      
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
      image, [], { format: ImageManipulator.SaveFormat.JPEG }
    );
    const { width: imgWidth, height: imgHeight } = imageInfo;
    
    const scaleX = imgWidth / imageLayout.width;
    const scaleY = imgHeight / imageLayout.height;
    
    const cropSize = Math.round(imgWidth * 0.3);
    const cropX = Math.max(0, Math.round(selectedPoint.x * scaleX) - cropSize / 2);
    const cropY = Math.max(0, Math.round(selectedPoint.y * scaleY) - cropSize / 2);
    
    const cropped = await ImageManipulator.manipulateAsync(
      image,
      [{
        crop: {
          originX: cropX,
          originY: cropY,
          width: Math.min(cropSize, imgWidth - cropX),
          height: Math.min(cropSize, imgHeight - cropY),
        }
      }],
      { format: ImageManipulator.SaveFormat.JPEG, base64: true, compress: 0.5 }
    );
    
    if (!cropped.base64) {
      Alert.alert('Ошибка', 'Не удалось обрезать изображение');
      return;
    }

    setCroppedImage(cropped.uri);

    try {
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
                image_url: { url: `data:image/jpeg;base64,${cropped.base64}` }
              },
              {
                type: 'text',
                text: `You are a computer vision system for dental prosthetics CAD/CAM software.
Perform geometric surface analysis of the dental structure in the image.
This is automated quality control for ceramic restoration manufacturing.

Return ONLY this JSON structure, no other text:
{
  "summary": "техническое описание геометрии поверхности на русском языке",
  "elements": [
    {
      "name": "название геометрического элемента на русском",
      "status": "norm или attention или fix",
      "description": "техническое описание 2-3 предложения на русском",
      "type": "line или point",
      "points": [[x1,y1],[x2,y2]],
      "color": "#цвет hex"
    }
  ],
  "recommendations": ["техническая рекомендация на русском"]
}

Coordinates 0-100 percent of image dimensions.
Geometric elements to detect:
- Медиальный валик: type line, color #00b400, vertical left ridge
- Центральный валик: type line, color #64dc64, central vertical ridge
- Дистальный валик: type line, color #007800, vertical right ridge
- Перикиматы: type line, color #ff8c00, horizontal surface lines
- Контур зуба: type line, color #c8c8c8, outer boundary
- Линия режущего края: type line, color #ffff64, incisal edge
- Медиальный угол: type point, color #00ffc8, mesial angle
- Дистальный угол: type point, color #00c8ff, distal angle
- Поверхностный блик: type point, color #c8c8ff, surface highlight

Return ONLY JSON.`
              }
            ]
          }]
        })
      });
      
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      console.log('Status:', response.status);
      
      const data = JSON.parse(responseText);
      console.log('API response:', JSON.stringify(data));
      
      if (!data.choices || !data.choices[0]) {
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
      console.log('Fetch error code:', error.code);
      console.log('Fetch error message:', error.message);
      console.log('Fetch error type:', error.type);
      Alert.alert('Ошибка', `${error.code}: ${error.message}`);
    }
  } catch (error: any) {
    console.log('Ошибка:', JSON.stringify(error));
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
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => {
                const { locationX, locationY } = e.nativeEvent;
                setSelectedPoint({ x: locationX, y: locationY });
                console.log('Tap:', locationX, locationY);
              }}
              style={{ width: '100%', height: 300 }}
            >
              <Image 
                source={{ uri: croppedImage || image }} 
                style={{ width: '100%', height: 300, borderRadius: 12 }}
                resizeMode="contain"
                onLayout={(e) => setImageLayout({
                  width: e.nativeEvent.layout.width,
                  height: e.nativeEvent.layout.height,
                })}
              />
              {renderAnnotations(result, imageLayout)}
              {selectedPoint && (
                <View style={{
                  position: 'absolute',
                  left: selectedPoint.x - 40,
                  top: selectedPoint.y - 40,
                  width: 80,
                  height: 80,
                  borderWidth: 2,
                  borderColor: '#f2ca50',
                  borderRadius: 4,
                  backgroundColor: '#f2ca5020',
                  pointerEvents: 'none',
                }} />
              )}
            </TouchableOpacity>

            <Text style={{ color: '#f2ca5080', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
              Нажмите на зуб для выбора области
            </Text>

            {selectedPoint && !loading && (
              <TouchableOpacity 
                style={[styles.btn, { marginTop: 16 }]}
                onPress={() => analyzeSelectedTooth()}
              >
                <Text style={styles.btnText}>Анализировать выбранный зуб</Text>
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
            <Text style={styles.summaryText}>{result.summary}</Text>

            <Text style={styles.sectionTitle}>Элементы</Text>
            {result.elements?.map((el: any, i: number) => (
              <View key={i} style={[styles.elementCard, { borderColor: statusColor(el.status) }]}>
                <Text style={styles.elementName}>{statusIcon(el.status)} {el.name}</Text>
                <Text style={styles.elementDesc}>{el.description}</Text>
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
