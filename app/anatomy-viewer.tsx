import { Ionicons } from '@expo/vector-icons';
import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Asset } from 'expo-asset';
import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';


// Компонент для отображения 3D модели
function JawModel({ model }: { model: any }) {
  if (!model) return null;
  
  return (
    <primitive 
      object={model} 
      scale={0.5}
      position={[0, 0.5, 0]} // Поднимаем модель после поворота для выравнивания с маркером
      rotation={[0, 0.3, 0]} // Небольшой поворот для лучшего обзора передних зубов
    />
  );
}

export default function AnatomyViewerScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [model, setModel] = useState<any>(null);

  useEffect(() => {
    async function loadModel() {
      try {
        // Загружаем OBJ модель
        const objAsset = Asset.fromModule(require('../assets/models/jaw_upper.obj'));
        await objAsset.downloadAsync(); // Скачиваем/кэшируем локально
        
        const loader = new OBJLoader();
        loader.load(
          objAsset.localUri || objAsset.uri,
          (obj) => {
            // Применяем единый стоматологический материал
            obj.traverse((child: any) => {
              if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                  color: '#F5F5F7', // Чистый цвет слоновой кости/эмали
                  roughness: 0.3,
                  metalness: 0.1,
                });
              }
            });
            
            // Поворачиваем модель "лицом" к пользователю
            obj.rotation.x = Math.PI / 2; // Поворот на 90 градусов по оси X
            
            setModel(obj);
            setIsLoading(false);
          },
          undefined,
          (error) => {
            console.error("Loader error:", error);
            setIsLoading(false);
          }
        );
      } catch (e) {
        console.error("Asset resolve error:", e);
        setIsLoading(false);
      }
    }
    loadModel();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" translucent />
      
      {/* Заголовок */}
      <View style={styles.header}>
        <Text style={styles.title}>3D АНАТОМИЯ</Text>
        <Text style={styles.subtitle}>Верхняя челюсть</Text>
      </View>

      {/* 3D Viewer */}
      <View style={styles.viewerContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Ionicons name="cube-outline" size={48} color="#f2ca50" />
            <Text style={styles.loadingText}>Загрузка 3D-модели...</Text>
            <Text style={styles.loadingSubtext}>Анализ разметки зубов</Text>
          </View>
        ) : (
          <View style={{ flex: 1, position: 'relative' }}>
            <Canvas
              camera={{ position: [0, 0, 5], fov: 50 }}
              style={styles.canvas}
            >
              {/* Освещение - акцент на передних резцах */}
              <ambientLight intensity={0.3} />
              <directionalLight 
                position={[0, 2, 5]} 
                intensity={1.2} 
              />
              <directionalLight position={[5, 5, 2]} intensity={0.6} />
              <directionalLight position={[-5, -5, 2]} intensity={0.4} />
              
              {/* Модель */}
              {model && (
                <>
                  <JawModel model={model} />
                  <OrbitControls 
                    enablePan={false}
                    enableZoom={true}
                    enableRotate={true}
                    minDistance={3}
                    maxDistance={10}
                    autoRotate={false}
                    autoRotateSpeed={2}
                  />
                </>
              )}
            </Canvas>
            
            {/* Маркер центрального резца */}
            <View style={styles.markerContainer}>
              <View style={styles.markerDot} />
              <View style={styles.markerRing} />
            </View>
          </View>
        )}
      </View>

      {/* Текстовая подсказка */}
      <View style={styles.hintContainer}>
        <Ionicons name="information-circle-outline" size={16} color="#00CED1" />
        <Text style={styles.hintText}>Центральный резец выделен маркером. Используйте жесты для детального осмотра</Text>
      </View>

      {/* Информационная панель */}
      <View style={styles.infoPanel}>
        <View style={styles.infoItem}>
          <Ionicons name="finger-print" size={20} color="#f2ca50" />
          <Text style={styles.infoText}>Поворот: палец</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="resize" size={20} color="#f2ca50" />
          <Text style={styles.infoText}>Масштаб: pinch</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="cube-outline" size={20} color="#f2ca50" />
          <Text style={styles.infoText}>Модель: 15.7 МБ</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(242, 202, 80, 0.1)',
  },
  title: {
    color: '#f2ca50',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '400',
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#050505',
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.2)',
    shadowColor: '#f2ca50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#050505',
  },
  loadingText: {
    color: '#f2ca50',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingSubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '400',
  },
  markerContainer: {
    position: 'absolute',
    top: '65%',
    left: '46%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDot: {
    width: 12,
    height: 12,
    backgroundColor: '#00CED1',
    borderRadius: 6,
    shadowColor: '#00CED1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 10,
  },
  markerRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: 'rgba(0, 206, 209, 0.6)',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 206, 209, 0.1)',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 206, 209, 0.3)',
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
    textAlign: 'center',
  },
  infoPanel: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(242, 202, 80, 0.1)',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
});
