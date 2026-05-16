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

  // Календарь
  const [showWorkDatePicker, setShowWorkDatePicker] = useState(false);
  const [showDeliveryDatePicker, setShowDeliveryDatePicker] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [showWorkTypes, setShowWorkTypes] = useState(false);

  // ЗАГРУЗКА СОХРАНЁННЫХ ДАННЫХ при старте
  useEffect(() => {
    AsyncStorage.getItem('doctorName').then(v => v && setDoctorName(v));
    AsyncStorage.getItem('techName').then(v => v && setTechName(v));
    AsyncStorage.getItem('pendingVitaResult').then((data) => {
      if (data) {
        setVitaResult(JSON.parse(data));
        AsyncStorage.removeItem('pendingVitaResult');
      }
    });
  }, []);

  // При изменении doctorName — сохранять
  useEffect(() => {
    if (doctorName) AsyncStorage.setItem('doctorName', doctorName);
  }, [doctorName]);

  // При изменении techName — сохранять
  useEffect(() => {
    if (techName) AsyncStorage.setItem('techName', techName);
  }, [techName]);

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
    padding: 16,
  }}>
    <View style={{
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    }}>
      {vitaResult.imageUri && (
        <TouchableOpacity
          onPress={() => {
            setActivePhoto(vitaResult.imageUri);
            setShowPhotoModal(true);
          }}
          style={{ flex: 1 }}
        >
          <Image
            source={{ uri: vitaResult.imageUri }}
            style={{
              width: '100%',
              height: 100,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#f2ca50',
            }}
            resizeMode="cover"
          />
          <Text style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: 10,
            textAlign: 'center',
            marginTop: 4,
          }}>Анализ</Text>
        </TouchableOpacity>
      )}
      {vitaResult.originalImageUri && (
        <TouchableOpacity
          onPress={() => {
            setActivePhoto(vitaResult.originalImageUri);
            setShowPhotoModal(true);
          }}
          style={{ flex: 1 }}
        >
          <Image
            source={{ uri: vitaResult.originalImageUri }}
            style={{
              width: '100%',
              height: 100,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
            }}
            resizeMode="cover"
          />
          <Text style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: 10,
            textAlign: 'center',
            marginTop: 4,
          }}>Оригинал</Text>
        </TouchableOpacity>
      )}
    </View>

    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={{
        color: '#f2ca50',
        fontSize: 36,
        fontWeight: 'bold',
      }}>
        {vitaResult.shade}
      </Text>
      <Text style={{
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
      }}>
        Уверенность: {vitaResult.confidence}
      </Text>
      <Text style={{
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
      }}>
        Фото: {vitaResult.photo_quality}
      </Text>
    </View>

    <Text style={{
      color: 'rgba(255,255,255,0.4)',
      fontSize: 11,
      letterSpacing: 1.5,
      marginBottom: 8,
    }}>ЗОНЫ</Text>

    <View style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
    }}>
      {[
        { label: 'Шейка', value: vitaResult.zone_cervical },
        { label: 'Середина', value: vitaResult.zone_middle },
        { label: 'Край', value: vitaResult.zone_incisal },
      ].map(zone => (
        <View key={zone.label} style={{
          alignItems: 'center',
          flex: 1,
        }}>
          <Text style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: 11,
          }}>{zone.label}</Text>
          <Text style={{
            color: 'white',
            fontSize: 16,
            fontWeight: '600',
          }}>{zone.value}</Text>
        </View>
      ))}
    </View>

    {vitaResult.description ? (
      <Text style={{
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
        marginTop: 10,
        fontStyle: 'italic',
      }}>
        {vitaResult.description}
      </Text>
    ) : null}

    <TouchableOpacity
      onPress={() => {
        setVitaResult(null);
        router.push('/color-analyzer');
      }}
      style={{ marginTop: 10, alignItems: 'center' }}
    >
      <Text style={{
        color: 'rgba(242,202,80,0.5)',
        fontSize: 13,
      }}>Переопределить цвет</Text>
    </TouchableOpacity>
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
