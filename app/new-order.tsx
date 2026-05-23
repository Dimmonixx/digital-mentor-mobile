import { database } from '@/constants/firebase';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { push, ref } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ImageBackground,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NewOrderScreen() {
  const insets = useSafeAreaInsets();
  
  // Основные
  const [doctorName, setDoctorName] = useState('');
  const [patientName, setPatientName] = useState('');
  const [techName, setTechName] = useState('');
  const [workDate, setWorkDate] = useState<Date>(new Date());
  const [deliveryDate, setDeliveryDate] = useState<Date>(new Date());
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
  const [workType, setWorkType] = useState('');
  const [workNote, setWorkNote] = useState('');
  const [showExtended, setShowExtended] = useState(false);
  const [loading, setLoading] = useState(false);

  // Расширенные (шторка)
  const [implantSystem, setImplantSystem] = useState('');
  const [fixationType, setFixationType] = useState<'screw'|'cement'|null>(null);
  const [anatomyType, setAnatomyType] = useState<'full'|'apply'|null>(null);
  const [structureType, setStructureType] = useState<'single'|'bridge'|'garland'|null>(null);

  // Цвет VITA (придёт из анализатора)
  const [vitaResult, setVitaResult] = useState<any>(null);
  const [showVitaDetails, setShowVitaDetails] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  // Календарь
  const [showWorkDatePicker, setShowWorkDatePicker] = useState(false);
  const [showDeliveryDatePicker, setShowDeliveryDatePicker] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [showWorkTypes, setShowWorkTypes] = useState(false);

  // Импланты
  const [implantsEnabled, setImplantsEnabled] = useState(false);
  const [toothTypes, setToothTypes] = useState<Record<number, 'crown' | 'implant'>>({});
  const [implantData, setImplantData] = useState<Record<number, {
    system: 'AnyOne' | 'AnyRidge' | 'Straumann BLX' | null;
    diameter: string | null;
  }>>({});
  const [selectedToothForImplant, setSelectedToothForImplant] = useState<number | null>(null);
  const [showImplantModal, setShowImplantModal] = useState(false);

  const IMPLANT_SYSTEMS = {
    'AnyOne': ['3.0', '3.5', '4.0', '4.5', '5.0'],
    'AnyRidge': ['3.5', '4.0', '4.5', '5.0', '5.5', '6.0'],
    'Straumann BLX': ['3.5', '3.75', '4.0', '4.5', '5.0', '5.5', '6.5'],
  };

  const [bridges, setBridges] = useState<Array<number[]>>([]);

  const isBridged = (t1: number, t2: number) => 
    bridges.some(b => b.includes(t1) && b.includes(t2));

  const toggleBridge = (t1: number, t2: number) => {
    const existing = bridges.findIndex(
      b => b.includes(t1) && b.includes(t2)
    );
    if (existing !== -1) {
      // Убрать связь
      setBridges(prev => {
        const updated = [...prev];
        const bridge = updated[existing].filter(
          t => t !== t1 && t !== t2
        );
        if (bridge.length < 2) {
          updated.splice(existing, 1);
        } else {
          updated[existing] = bridge;
        }
        return updated;
      });
    } else {
      // Добавить связь — найти существующий мост или создать новый
      const bridgeWithT1 = bridges.findIndex(b => b.includes(t1));
      const bridgeWithT2 = bridges.findIndex(b => b.includes(t2));
      
      if (bridgeWithT1 !== -1) {
        setBridges(prev => {
          const updated = [...prev];
          updated[bridgeWithT1] = [...updated[bridgeWithT1], t2];
          return updated;
        });
      } else if (bridgeWithT2 !== -1) {
        setBridges(prev => {
          const updated = [...prev];
          updated[bridgeWithT2] = [...updated[bridgeWithT2], t1];
          return updated;
        });
      } else {
        setBridges(prev => [...prev, [t1, t2]]);
      }
    }
  };

  // ЗАГРУЗКА VITA РЕЗУЛЬТАТА при старте
  useEffect(() => {
    const loadVitaResult = async () => {
      try {
        const stored = await AsyncStorage.getItem('pendingVitaResult');
        if (stored) {
          setVitaResult(JSON.parse(stored));
          console.log('=== VITA RESULT ===', stored);
          await AsyncStorage.removeItem('pendingVitaResult');
        }
      } catch (e) {
        console.error('Error loading vita result:', e);
      }
    };
    loadVitaResult();
  }, []);

  // ЗАГРУЗКА ЧЕРНОВИКА при монтировании
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await AsyncStorage.getItem('orderDraft');
        if (draft) {
          const d = JSON.parse(draft);
          if (d.doctorName) setDoctorName(d.doctorName);
          if (d.patientName) setPatientName(d.patientName);
          if (d.techName) setTechName(d.techName);
          if (d.workDate) setWorkDate(new Date(d.workDate));
          if (d.deliveryDate) setDeliveryDate(new Date(d.deliveryDate));
          if (d.selectedTeeth) setSelectedTeeth(d.selectedTeeth);
          if (d.workType) setWorkType(d.workType);
          if (d.workNote) setWorkNote(d.workNote);
          if (d.implantsEnabled) setImplantsEnabled(d.implantsEnabled);
          if (d.toothTypes) setToothTypes(d.toothTypes);
          if (d.implantData) setImplantData(d.implantData);
          if (d.bridges) setBridges(d.bridges);
        }
      } catch (e) {
        console.error('Error loading draft:', e);
      }
    };
    loadDraft();
  }, []);

  // При изменении doctorName — сохранять
  useEffect(() => {
    if (doctorName) AsyncStorage.setItem('doctorName', doctorName);
  }, [doctorName]);

  // При изменении techName — сохранять
  useEffect(() => {
    if (techName) AsyncStorage.setItem('techName', techName);
  }, [techName]);

  // СОХРАНЕНИЕ ЧЕРНОВИКА при изменении данных
  useEffect(() => {
    const saveDraft = async () => {
      const draft = {
        doctorName,
        patientName,
        techName,
        workDate: workDate.toISOString(),
        deliveryDate: deliveryDate.toISOString(),
        selectedTeeth,
        workType,
        workNote,
        implantsEnabled,
        toothTypes,
        implantData,
        bridges,
      };
      await AsyncStorage.setItem('orderDraft', JSON.stringify(draft));
    };
    saveDraft();
  }, [doctorName, patientName, techName, workDate, 
      deliveryDate, selectedTeeth, workType, workNote, 
      implantsEnabled, toothTypes, implantData, bridges]);

  // ФОРМУЛА ЗУБОВ
  const upperJaw = [18,17,16,15,14,13,12,11, 21,22,23,24,25,26,27,28];
  const lowerJaw = [48,47,46,45,44,43,42,41, 31,32,33,34,35,36,37,38];

  const toggleTooth = (num: number) => {
    setSelectedTeeth(prev =>
      prev.includes(num)
        ? prev.filter(t => t !== num)
        : [...prev, num]
    );
  };

  // Виды работ
  const WORK_TYPES = [
    { id: 'metal', label: 'Металл' },
    { id: 'inlay', label: 'Вкладка' },
    { id: 'metalceramic', label: 'Металлокерамика' },
    { id: 'zirconia', label: 'Диоксид циркона' },
    { id: 'emax', label: 'Дисиликат лития' },
  ];

  // Календарь функции
  const changeDate = (date: Date, type: 'day'|'month'|'year', increment: number) => {
    const newDate = new Date(date);
    if (type === 'day') {
      newDate.setDate(newDate.getDate() + increment);
    } else if (type === 'month') {
      newDate.setMonth(newDate.getMonth() + increment);
    } else if (type === 'year') {
      newDate.setFullYear(newDate.getFullYear() + increment);
    }
    
    if (showWorkDatePicker) {
      setWorkDate(newDate);
    } else if (showDeliveryDatePicker) {
      setDeliveryDate(newDate);
    }
  };

  // Отправка формы
  const handleSubmit = async () => {
    if (!patientName || !techName || !workType) {
      Alert.alert('Заполните обязательные поля',
        'ФИО пациента, техник и вид работы обязательны');
      return;
    }
    setLoading(true);
    const order = {
      doctorName,
      patientName,
      techName,
      workDate: workDate.toISOString(),
      deliveryDate: deliveryDate.toISOString(),
      selectedTeeth,
      workType,
      workNote,
      vitaResult,
      implantSystem,
      fixationType,
      anatomyType,
      structureType,
      status: 'new',
      createdAt: Date.now(),
    };
    await push(ref(database, 'orders'), order);
    await AsyncStorage.removeItem('orderDraft');
    setLoading(false);
    Alert.alert('Успешно!', 'Наряд отправлен технику', [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  // Рендер календаря
  const renderDatePicker = (title: string, date: Date, visible: boolean, setVisible: (val: boolean) => void, setDate: (val: Date) => void) => (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          
          <View style={styles.dateRow}>
            <TouchableOpacity onPress={() => changeDate(date, 'day', -1)} style={styles.dateBtn}>
              <Ionicons name="chevron-up" size={20} color="#f2ca50" />
            </TouchableOpacity>
            <Text style={styles.dateValue}>{date.getDate()}</Text>
            <TouchableOpacity onPress={() => changeDate(date, 'day', 1)} style={styles.dateBtn}>
              <Ionicons name="chevron-down" size={20} color="#f2ca50" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.dateRow}>
            <TouchableOpacity onPress={() => changeDate(date, 'month', -1)} style={styles.dateBtn}>
              <Ionicons name="chevron-up" size={20} color="#f2ca50" />
            </TouchableOpacity>
            <Text style={styles.dateValue}>{date.getMonth() + 1}</Text>
            <TouchableOpacity onPress={() => changeDate(date, 'month', 1)} style={styles.dateBtn}>
              <Ionicons name="chevron-down" size={20} color="#f2ca50" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.dateRow}>
            <TouchableOpacity onPress={() => changeDate(date, 'year', -1)} style={styles.dateBtn}>
              <Ionicons name="chevron-up" size={20} color="#f2ca50" />
            </TouchableOpacity>
            <Text style={styles.dateValue}>{date.getFullYear()}</Text>
            <TouchableOpacity onPress={() => changeDate(date, 'year', 1)} style={styles.dateBtn}>
              <Ionicons name="chevron-down" size={20} color="#f2ca50" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity onPress={() => setVisible(false)} style={styles.modalBtn}>
            <Text style={styles.modalBtnText}>Готово</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar style="light" backgroundColor="#0a0a1a" />
      
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#f2ca50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Новый наряд</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Врач */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ВРАЧ</Text>
          <TextInput
            style={styles.input}
            placeholder="ФИО врача"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={doctorName}
            onChangeText={setDoctorName}
          />
        </View>

        {/* Пациент */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ПАЦИЕНТ</Text>
          <TextInput
            style={styles.input}
            placeholder="ФИО пациента *"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={patientName}
            onChangeText={setPatientName}
          />
        </View>

        {/* Техник */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ТЕХНИК</Text>
          <TextInput
            style={styles.input}
            placeholder="ФИО техника *"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={techName}
            onChangeText={setTechName}
          />
        </View>

        {/* Даты */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ДАТЫ</Text>
          <TouchableOpacity onPress={() => setShowWorkDatePicker(true)} style={styles.dateInput}>
            <Text style={styles.dateText}>
              Дата работы: {workDate.toLocaleDateString('ru-RU')}
            </Text>
            <Ionicons name="calendar" size={20} color="#f2ca50" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowDeliveryDatePicker(true)} style={styles.dateInput}>
            <Text style={styles.dateText}>
              Дата выдачи: {deliveryDate.toLocaleDateString('ru-RU')}
            </Text>
            <Ionicons name="calendar" size={20} color="#f2ca50" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: implantsEnabled 
              ? 'rgba(242,202,80,0.1)' 
              : 'rgba(255,255,255,0.03)',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: implantsEnabled 
              ? 'rgba(242,202,80,0.4)' 
              : 'rgba(255,255,255,0.1)',
            marginBottom: 12,
          }}
          onPress={() => {
            setImplantsEnabled(!implantsEnabled);
            if (implantsEnabled) {
              setToothTypes({});
              setImplantData({});
            }
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 20 }}>🔩</Text>
            <Text style={{
              color: implantsEnabled ? '#f2ca50' : 'rgba(255,255,255,0.5)',
              fontSize: 15,
              fontWeight: '500',
            }}>
              Импланты
            </Text>
          </View>
          <View style={{
            width: 44,
            height: 24,
            borderRadius: 12,
            backgroundColor: implantsEnabled 
              ? '#f2ca50' 
              : 'rgba(255,255,255,0.15)',
            justifyContent: 'center',
            paddingHorizontal: 2,
          }}>
            <View style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: '#fff',
              alignSelf: implantsEnabled ? 'flex-end' : 'flex-start',
            }} />
          </View>
        </TouchableOpacity>

        {/* Зубы */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ЗУБЫ</Text>
          
          <Text style={styles.jawTitle}>Верхняя челюсть</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 8 }}
          >
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28].map(num => (
                <TouchableOpacity key={num} onPress={() => toggleTooth(num)}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    borderWidth: 1,
                    borderColor: selectedTeeth.includes(num) 
                      ? '#f2ca50' : 'rgba(255,255,255,0.2)',
                    backgroundColor: selectedTeeth.includes(num)
                      ? 'rgba(242,202,80,0.2)' : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{
                    fontSize: 10,
                    color: selectedTeeth.includes(num) 
                      ? '#f2ca50' : 'rgba(255,255,255,0.4)',
                  }}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          
          <View style={{
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.06)',
            marginVertical: 8,
          }} />
          
          <Text style={styles.jawTitle}>Нижняя челюсть</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 8 }}
          >
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38].map(num => (
                <TouchableOpacity key={num} onPress={() => toggleTooth(num)}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    borderWidth: 1,
                    borderColor: selectedTeeth.includes(num) 
                      ? '#f2ca50' : 'rgba(255,255,255,0.2)',
                    backgroundColor: selectedTeeth.includes(num)
                      ? 'rgba(242,202,80,0.2)' : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{
                    fontSize: 10,
                    color: selectedTeeth.includes(num) 
                      ? '#f2ca50' : 'rgba(255,255,255,0.4)',
                  }}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {implantsEnabled && selectedTeeth.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 11,
              letterSpacing: 1,
              marginBottom: 8,
            }}>
              ТИП ДЛЯ КАЖДОГО ЗУБА
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 0 }}>
              {selectedTeeth.sort((a, b) => a - b).map((tooth, index) => {
                const nextTooth = selectedTeeth.sort((a,b) => a-b)[index + 1];
                const linked = nextTooth && isBridged(tooth, nextTooth);
                return (
                  <View key={tooth} style={{ 
                    flexDirection: 'row', 
                    alignItems: 'flex-start',
                  }}>
                    {/* Карточка зуба */}
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedToothForImplant(tooth);
                        setShowImplantModal(true);
                      }}
                      style={{
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: 'rgba(242,202,80,0.5)',
                        backgroundColor: 'rgba(242,202,80,0.08)',
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        alignItems: 'center',
                        minWidth: 64,
                      }}
                    >
                      <Text style={{
                        color: '#f2ca50',
                        fontSize: 16,
                        fontWeight: '700',
                        marginBottom: 4,
                      }}>
                        {tooth}
                      </Text>
                      {toothTypes[tooth] === 'implant' ? (
                        <>
                          <Text style={{ fontSize: 14 }}>🔩</Text>
                          <Text style={{
                            color: 'rgba(242,202,80,0.8)',
                            fontSize: 9,
                            textAlign: 'center',
                          }}>
                            {implantData[tooth]?.system ?? '?'}
                          </Text>
                          <Text style={{
                            color: 'rgba(242,202,80,0.8)',
                            fontSize: 9,
                          }}>
                            {implantData[tooth]?.diameter
                              ? `∅${implantData[tooth].diameter}` 
                              : '∅?'}
                          </Text>
                        </>
                      ) : (
                        <Text style={{ fontSize: 16 }}>👑</Text>
                      )}
                    </TouchableOpacity>

                    {/* Цепочка между соседними зубами */}
                    {nextTooth && (
                      <TouchableOpacity
                        onPress={() => toggleBridge(tooth, nextTooth)}
                        style={{
                          justifyContent: 'flex-start',
                          alignItems: 'center',
                          paddingTop: 6,
                          paddingHorizontal: 2,
                        }}
                      >
                        <Ionicons
                          name="link"
                          size={16}
                          color={linked ? '#f2ca50' : 'rgba(255,255,255,0.15)'}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Вид работы */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ВИД РАБОТЫ *</Text>
          <TouchableOpacity
            onPress={() => setShowWorkTypes(!showWorkTypes)}
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 10,
              padding: 14,
              borderWidth: 1,
              borderColor: workType 
                ? '#f2ca50' : 'rgba(255,255,255,0.1)',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{
              color: workType ? '#f2ca50' : 'rgba(255,255,255,0.3)',
              fontSize: 15,
            }}>
              {workType ? WORK_TYPES.find(w => w.id === workType)?.label 
                : 'Выберите вид работы...'}
            </Text>
            <Ionicons 
              name={showWorkTypes ? 'chevron-up' : 'chevron-down'} 
              size={18} color="#f2ca50" 
            />
          </TouchableOpacity>

          {showWorkTypes && (
            <View style={{
              backgroundColor: '#0a1628',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: 'rgba(242,202,80,0.2)',
              marginTop: 4,
              overflow: 'hidden',
            }}>
              {WORK_TYPES.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => {
                    setWorkType(item.id);
                    setShowWorkTypes(false);
                  }}
                  style={{
                    padding: 14,
                    borderBottomWidth: index < WORK_TYPES.length - 1 ? 1 : 0,
                    borderBottomColor: 'rgba(255,255,255,0.06)',
                    backgroundColor: workType === item.id 
                      ? 'rgba(242,202,80,0.1)' : 'transparent',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{
                    color: workType === item.id 
                      ? '#f2ca50' : 'rgba(255,255,255,0.8)',
                    fontSize: 15,
                  }}>{item.label}</Text>
                  {workType === item.id && (
                    <Ionicons name="checkmark" size={18} color="#f2ca50" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Цвет VITA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ЦВЕТ VITA</Text>
          {vitaResult ? (
  <View style={{
    borderWidth: 1,
    borderColor: '#f2ca50',
    borderRadius: 12,
    overflow: 'hidden',
  }}>
    {/* Главная строка — всегда видна */}
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: 'rgba(242,202,80,0.08)',
      }}
      onPress={() => setShowVitaDetails(!showVitaDetails)}
    >
      <Text style={{
        color: '#f2ca50',
        fontSize: 32,
        fontWeight: 'bold',
        letterSpacing: 1,
      }}>
        {vitaResult.primary_range ?? vitaResult.shade ?? '—'}
      </Text>
      <Ionicons
        name={showVitaDetails ? 'chevron-up' : 'chevron-down'}
        size={24}
        color="#f2ca50"
      />
    </TouchableOpacity>

    {/* Детали — скрыты по умолчанию */}
    {showVitaDetails && (
      <View style={{ padding: 16 }}>
        
        {/* Фото */}
        {(vitaResult.imageUri || vitaResult.originalImageUri) && (
          <TouchableOpacity
            onPress={() => {
              setActivePhoto(
                vitaResult.imageUri || vitaResult.originalImageUri
              );
              setShowPhotoModal(true);
            }}
            style={{ marginBottom: 12 }}
          >
            <Image
              source={{ 
                uri: vitaResult.imageUri || vitaResult.originalImageUri 
              }}
              style={{
                width: '100%',
                height: 160,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: 'rgba(242,202,80,0.3)',
              }}
              resizeMode="cover"
            />
            <Text style={{
              color: 'rgba(255,255,255,0.3)',
              fontSize: 10,
              textAlign: 'center',
              marginTop: 4,
            }}>
              Нажмите для увеличения
            </Text>
          </TouchableOpacity>
        )}

        {/* Зоны */}
        <Text style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: 11,
          letterSpacing: 1.5,
          marginBottom: 10,
        }}>ЗОНЫ</Text>

        {[
          { label: 'Шейка', value: vitaResult.zones?.cervical ?? vitaResult.zone_cervical ?? '—' },
          { label: 'Тело', value: vitaResult.zones?.body ?? vitaResult.zone_middle ?? '—' },
          { label: 'Режущий край', value: vitaResult.zones?.incisal ?? vitaResult.zone_incisal ?? '—' },
        ].map(zone => (
          <View key={zone.label} style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.06)',
          }}>
            <Text style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 13,
              flex: 1,
            }}>{zone.label}</Text>
            <Text style={{
              color: '#ffffff',
              fontSize: 13,
              fontWeight: '600',
              flex: 2,
              textAlign: 'right',
            }}>{zone.value}</Text>
          </View>
        ))}

        {/* Описание */}
        {vitaResult.description ? (
          <View style={{ marginBottom: 12 }}>
            {vitaResult.description
              .split('. ')
              .filter((s: string) => s.trim().length > 0)
              .map((sentence: string, index: number) => (
                <View key={index} style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 6,
                  borderLeftWidth: 2,
                  borderLeftColor: 'rgba(242,202,80,0.4)',
                }}>
                  <Text style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 12,
                    lineHeight: 18,
                    fontStyle: 'italic',
                  }}>
                    {sentence.trim().endsWith('.')
                      ? sentence.trim()
                      : sentence.trim() + '.'}
                  </Text>
                </View>
              ))}
          </View>
        ) : null}

        {/* Переопределить */}
        <TouchableOpacity
          onPress={() => {
            setVitaResult(null);
            router.push('/color-analyzer');
          }}
          style={{ alignItems: 'center', paddingVertical: 8 }}
        >
          <Text style={{
            color: 'rgba(242,202,80,0.5)',
            fontSize: 13,
          }}>Переопределить цвет →</Text>
        </TouchableOpacity>
      </View>
    )}
  </View>
) : (
  <TouchableOpacity
    onPress={() => router.push('/color-analyzer')}
    style={{
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}
  >
    <Text style={{
      color: 'rgba(255,255,255,0.5)',
      fontSize: 15,
    }}>🦷 Определить цвет VITA</Text>
    <Ionicons name="chevron-forward" 
      size={20} color="#f2ca50" />
  </TouchableOpacity>
)}
        </View>

        {/* Примечание */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ПРИМЕЧАНИЕ</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Дополнительная информация"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={workNote}
            onChangeText={setWorkNote}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Расширенные данные */}
        <View style={styles.section}>
          <TouchableOpacity onPress={() => setShowExtended(!showExtended)} style={styles.extendedHeader}>
            <Text style={styles.sectionTitle}>
              Дополнительно {showExtended ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
          
          {showExtended && (
            <View style={styles.extendedContent}>
              <TextInput
                style={styles.input}
                placeholder="Система имплантов"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={implantSystem}
                onChangeText={setImplantSystem}
              />
              
              <Text style={styles.subTitle}>Фиксация</Text>
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  onPress={() => setFixationType('screw')}
                  style={[
                    styles.optionBtn,
                    fixationType === 'screw' && styles.optionBtnSelected
                  ]}
                >
                  <Text style={[
                    styles.optionBtnText,
                    fixationType === 'screw' && styles.optionBtnTextSelected
                  ]}>
                    Винтовая
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFixationType('cement')}
                  style={[
                    styles.optionBtn,
                    fixationType === 'cement' && styles.optionBtnSelected
                  ]}
                >
                  <Text style={[
                    styles.optionBtnText,
                    fixationType === 'cement' && styles.optionBtnTextSelected
                  ]}>
                    Цементная
                  </Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.subTitle}>Анатомия</Text>
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  onPress={() => setAnatomyType('full')}
                  style={[
                    styles.optionBtn,
                    anatomyType === 'full' && styles.optionBtnSelected
                  ]}
                >
                  <Text style={[
                    styles.optionBtnText,
                    anatomyType === 'full' && styles.optionBtnTextSelected
                  ]}>
                    Полная
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAnatomyType('apply')}
                  style={[
                    styles.optionBtn,
                    anatomyType === 'apply' && styles.optionBtnSelected
                  ]}
                >
                  <Text style={[
                    styles.optionBtnText,
                    anatomyType === 'apply' && styles.optionBtnTextSelected
                  ]}>
                    Нанесение
                  </Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.subTitle}>Конструкция</Text>
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  onPress={() => setStructureType('single')}
                  style={[
                    styles.optionBtn,
                    structureType === 'single' && styles.optionBtnSelected
                  ]}
                >
                  <Text style={[
                    styles.optionBtnText,
                    structureType === 'single' && styles.optionBtnTextSelected
                  ]}>
                    Одиночки
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setStructureType('bridge')}
                  style={[
                    styles.optionBtn,
                    structureType === 'bridge' && styles.optionBtnSelected
                  ]}
                >
                  <Text style={[
                    styles.optionBtnText,
                    structureType === 'bridge' && styles.optionBtnTextSelected
                  ]}>
                    Мост
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setStructureType('garland')}
                  style={[
                    styles.optionBtn,
                    structureType === 'garland' && styles.optionBtnSelected
                  ]}
                >
                  <Text style={[
                    styles.optionBtnText,
                    structureType === 'garland' && styles.optionBtnTextSelected
                  ]}>
                    Гирлянда
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Кнопка отправки */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 32 }]}>
        <TouchableOpacity onPress={handleSubmit} style={styles.primaryBtn} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#031427" />
          ) : (
            <Text style={styles.primaryBtnText}>Отправить наряд</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => setShowClearModal(true)}
          style={{
            marginTop: 8,
            marginBottom: 24,
            paddingVertical: 14,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255,80,80,0.3)',
            borderRadius: 14,
            backgroundColor: 'rgba(255,80,80,0.05)',
          }}
        >
          <Text style={{
            color: '#ff4444',
            fontSize: 15,
            fontWeight: '500',
          }}>
            🗑 Очистить наряд
          </Text>
        </TouchableOpacity>
      </View>

      {/* Модалки календаря */}
      {showWorkDatePicker && (
        <DateTimePicker
          value={workDate}
          mode="date"
          display="calendar"
          onChange={(event, date) => {
            setShowWorkDatePicker(false);
            if (date) setWorkDate(date);
          }}
        />
      )}

      {showDeliveryDatePicker && (
        <DateTimePicker
          value={deliveryDate}
          mode="date"
          display="calendar"
          onChange={(event, date) => {
            setShowDeliveryDatePicker(false);
            if (date) setDeliveryDate(date);
          }}
        />
      )}

      {/* Модалка для увеличения фото */}
      <Modal
        visible={showPhotoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
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
              top: 50, right: 20,
              zIndex: 10, padding: 10,
            }}
            onPress={() => setShowPhotoModal(false)}
          >
            <Text style={{ color: 'white', fontSize: 28 }}>✕</Text>
          </TouchableOpacity>
          {activePhoto && (
            <Image
              source={{ uri: activePhoto }}
              style={{
                width: '100%',
                height: '80%',
              }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Модалка очистки наряда */}
      <Modal
        visible={showClearModal}
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
            borderColor: 'rgba(255,80,80,0.3)',
          }}>
            <Text style={{
              fontSize: 40,
              textAlign: 'center',
              marginBottom: 12,
            }}>🗑</Text>
            <Text style={{
              color: '#ff4444',
              fontSize: 20,
              fontWeight: 'bold',
              textAlign: 'center',
              marginBottom: 8,
            }}>
              Очистить наряд?
            </Text>
            <Text style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: 14,
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 20,
            }}>
              Все данные будут удалены без возможности восстановления
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(242,202,80,0.3)',
                  alignItems: 'center',
                }}
                onPress={() => setShowClearModal(false)}
              >
                <Text style={{ 
                  color: '#f2ca50', 
                  fontSize: 15,
                  fontWeight: '500',
                }}>
                  Отмена
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,50,50,0.15)',
                  borderWidth: 1,
                  borderColor: '#ff4444',
                  alignItems: 'center',
                }}
                onPress={async () => {
                  setShowClearModal(false);
                  setDoctorName('');
                  setPatientName('');
                  setTechName('');
                  setWorkDate(new Date());
                  setDeliveryDate(new Date());
                  setSelectedTeeth([]);
                  setWorkType('');
                  setWorkNote('');
                  setVitaResult(null);
                  setImplantSystem('');
                  setFixationType(null);
                  setAnatomyType(null);
                  setStructureType(null);
                  setImplantsEnabled(false);
                  setToothTypes({});
                  setImplantData({});
                  setBridges([]);
                  await AsyncStorage.removeItem('orderDraft');
                  await AsyncStorage.removeItem('pendingVitaResult');
                }}
              >
                <Text style={{ 
                  color: '#ff4444', 
                  fontSize: 15,
                  fontWeight: '600',
                }}>
                  Очистить
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модалка выбора типа/системы/диаметра импланта */}
      <Modal
        visible={showImplantModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowImplantModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.8)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: '#031427',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 24,
            borderWidth: 1,
            borderColor: 'rgba(242,202,80,0.2)',
          }}>
            <Text style={{
              color: '#f2ca50',
              fontSize: 18,
              fontWeight: 'bold',
              textAlign: 'center',
              marginBottom: 20,
            }}>
              Зуб {selectedToothForImplant}
            </Text>

            {/* Тип */}
            <Text style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 11,
              letterSpacing: 1,
              marginBottom: 10,
            }}>ТИП</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {(['crown', 'implant'] as const).map(type => (
                <TouchableOpacity
                  key={type}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: toothTypes[selectedToothForImplant!] === type
                      ? '#f2ca50'
                      : 'rgba(255,255,255,0.15)',
                    backgroundColor: toothTypes[selectedToothForImplant!] === type
                      ? 'rgba(242,202,80,0.15)'
                      : 'transparent',
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    setToothTypes(prev => ({
                      ...prev,
                      [selectedToothForImplant!]: type,
                    }));
                    if (type === 'crown') {
                      setImplantData(prev => ({
                        ...prev,
                        [selectedToothForImplant!]: { system: null, diameter: null },
                      }));
                    }
                  }}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>
                    {type === 'crown' ? '👑' : '🔩'}
                  </Text>
                  <Text style={{
                    color: toothTypes[selectedToothForImplant!] === type
                      ? '#f2ca50'
                      : 'rgba(255,255,255,0.5)',
                    fontSize: 13,
                    fontWeight: '500',
                  }}>
                    {type === 'crown' ? 'Коронка' : 'Имплант'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Система — только если выбран имплант */}
            {toothTypes[selectedToothForImplant!] === 'implant' && (
              <>
                <Text style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 11,
                  letterSpacing: 1,
                  marginBottom: 10,
                }}>СИСТЕМА</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                  {(Object.keys(IMPLANT_SYSTEMS) as Array<keyof typeof IMPLANT_SYSTEMS>).map(system => (
                    <TouchableOpacity
                      key={system}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: implantData[selectedToothForImplant!]?.system === system
                          ? '#f2ca50'
                          : 'rgba(255,255,255,0.15)',
                        backgroundColor: implantData[selectedToothForImplant!]?.system === system
                          ? 'rgba(242,202,80,0.15)'
                          : 'transparent',
                        alignItems: 'center',
                      }}
                      onPress={() => {
                        setImplantData(prev => ({
                          ...prev,
                          [selectedToothForImplant!]: {
                            system,
                            diameter: null,
                          },
                        }));
                      }}
                    >
                      <Text style={{
                        color: implantData[selectedToothForImplant!]?.system === system
                          ? '#f2ca50'
                          : 'rgba(255,255,255,0.5)',
                        fontSize: 11,
                        fontWeight: '600',
                        textAlign: 'center',
                      }}>
                        {system}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Диаметр */}
                {implantData[selectedToothForImplant!]?.system && (
                  <>
                    <Text style={{
                      color: 'rgba(255,255,255,0.4)',
                      fontSize: 11,
                      letterSpacing: 1,
                      marginBottom: 10,
                    }}>ДИАМЕТР (мм)</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                      {IMPLANT_SYSTEMS[implantData[selectedToothForImplant!]!.system!].map(d => (
                        <TouchableOpacity
                          key={d}
                          style={{
                            paddingVertical: 10,
                            paddingHorizontal: 16,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: implantData[selectedToothForImplant!]?.diameter === d
                              ? '#f2ca50'
                              : 'rgba(255,255,255,0.15)',
                            backgroundColor: implantData[selectedToothForImplant!]?.diameter === d
                              ? 'rgba(242,202,80,0.15)'
                              : 'transparent',
                          }}
                          onPress={() => {
                            setImplantData(prev => ({
                              ...prev,
                              [selectedToothForImplant!]: {
                                ...prev[selectedToothForImplant!],
                                diameter: d,
                              },
                            }));
                          }}
                        >
                          <Text style={{
                            color: implantData[selectedToothForImplant!]?.diameter === d
                              ? '#f2ca50'
                              : 'rgba(255,255,255,0.5)',
                            fontSize: 14,
                            fontWeight: '600',
                          }}>
                            ∅{d}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}

            {/* Готово */}
            <TouchableOpacity
              style={{
                backgroundColor: '#f2ca50',
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
              }}
              onPress={() => {
                setShowImplantModal(false);
                setSelectedToothForImplant(null);
              }}
            >
              <Text style={{
                color: '#031427',
                fontSize: 16,
                fontWeight: '700',
              }}>
                Готово
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f2ca50',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    backgroundColor: '#0a1628ee',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.15)',
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 12,
    color: 'white',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  dateText: {
    color: 'white',
    fontSize: 16,
  },
  jawTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 8,
  },
  teethRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  workTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  workTypeBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    padding: 10,
    margin: 4,
    alignItems: 'center',
  },
  workTypeBtnSelected: {
    borderColor: '#f2ca50',
    backgroundColor: 'rgba(242,202,80,0.15)',
  },
  workTypeBtnText: {
    fontSize: 13,
    color: 'white',
  },
  workTypeBtnTextSelected: {
    color: '#f2ca50',
  },
  vitaBlock: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vitaBlockSelected: {
    borderColor: '#f2ca50',
  },
  vitaShade: {
    color: '#f2ca50',
    fontSize: 24,
    fontWeight: 'bold',
  },
  vitaZones: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  vitaPlaceholder: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
  },
  extendedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  extendedContent: {
    marginTop: 12,
  },
  subTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  optionBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    padding: 10,
    marginRight: 12,
    flex: 1,
    alignItems: 'center',
  },
  optionBtnSelected: {
    borderColor: '#f2ca50',
    backgroundColor: 'rgba(242,202,80,0.15)',
  },
  optionBtnText: {
    fontSize: 13,
    color: 'white',
  },
  optionBtnTextSelected: {
    color: '#f2ca50',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0a1628ee',
    padding: 16,
  },
  primaryBtn: {
    backgroundColor: '#f2ca50',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#031427',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#0a1628',
    borderRadius: 16,
    padding: 24,
    width: '80%',
  },
  modalTitle: {
    color: '#f2ca50',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateBtn: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(242,202,80,0.1)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateValue: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  modalBtn: {
    backgroundColor: '#f2ca50',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  modalBtnText: {
    color: '#031427',
    fontSize: 16,
    fontWeight: '600',
  },
});
