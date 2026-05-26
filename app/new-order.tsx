import { database } from '@/constants/firebase';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { push, ref } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NewOrderScreen() {
  const insets = useSafeAreaInsets();
  const topJawScrollRef = useRef<ScrollView>(null);
  const bottomJawScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => {
      topJawScrollRef.current?.scrollTo({ x: 220, animated: false });
      bottomJawScrollRef.current?.scrollTo({ x: 220, animated: false });
    }, 100);
  }, []);

  // Основные
  const [doctorName, setDoctorName] = useState('');
  const [patientName, setPatientName] = useState('');
  const [techName, setTechName] = useState('');
  // Даты
  const [dates, setDates] = useState({
    impressions: new Date(),
    fitting: null as Date | null,
    delivery: null as Date | null,
  });
  const [selectedTeeth, setSelectedTeeth] = useState<{number: number, type: 'crown' | 'pontic'}[]>([]);
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
  const [showConstructions, setShowConstructions] = useState(true);
  const [showClearModal, setShowClearModal] = useState(false);

  // Календарь
  const [showDatePicker, setShowDatePicker] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [showWorkTypes, setShowWorkTypes] = useState(false);

  // Восстановление состояний при монтировании компонента
  useEffect(() => {
    const restoreStates = async () => {
      try {
        // Восстанавливаем blockDetails из AsyncStorage
        const savedBlockDetails = await AsyncStorage.getItem('tempBlockDetails');
        if (savedBlockDetails) {
          const parsedBlockDetails = JSON.parse(savedBlockDetails);
          setBlockDetails(parsedBlockDetails);
          // Удаляем временные данные
          await AsyncStorage.removeItem('tempBlockDetails');
        }

        // Восстанавливаем connections из AsyncStorage
        const savedConnections = await AsyncStorage.getItem('tempConnections');
        if (savedConnections) {
          const parsedConnections = JSON.parse(savedConnections);
          setConnections(parsedConnections);
          // Удаляем временные данные
          await AsyncStorage.removeItem('tempConnections');
        }
      } catch (error) {
        console.error('Error restoring states:', error);
      }
    };

    restoreStates();
  }, []);

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

  const [bridges, setBridges] = useState<string[]>([]);
const [connections, setConnections] = useState<string[]>([]); // Храним строки вида "12-11", "21-22"
const [blockMaterials, setBlockMaterials] = useState<Record<string, string>>({}); // Материалы для каждого блока
const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null); // Индекс выбранного блока для dropdown
const [showImplantSystems, setShowImplantSystems] = useState<Record<string, boolean>>({}); // Состояние для выпадающих списков систем имплантов (ключ: blockId-toothNumber)
const [showImplantDiameters, setShowImplantDiameters] = useState<Record<string, boolean>>({}); // Состояние для выпадающих списков диаметров (ключ: blockId-toothNumber)
const [openImplantDropdownId, setOpenImplantDropdownId] = useState<string | null>(null);
const [blockDetails, setBlockDetails] = useState<Record<string, {
  material?: string;
  isImplant?: boolean; // Новый флаг-тумблер
  fixationType?: 'screw' | 'cement'; // Тип фиксации на весь блок
  // Теперь это объекты, где ключ — номер конкретного зуба:
  implantSystems?: Record<number, string>; 
  implantDiameters?: Record<number, string>;
  isPontic?: Record<number, boolean>; // Флаг: является ли зуб промежутком
  isExpanded?: boolean; // Новый флаг: развернута ли детальная карточка
}>>({});

  const getBridgeKey = (a: number, b: number) => 
    `${Math.min(a,b)}-${Math.max(a,b)}`;

  const toggleBridge = (a: number, b: number) => {
    const key = getBridgeKey(a, b);
    setBridges(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const isBridged = (a: number, b: number) =>
    bridges.includes(getBridgeKey(a, b));

  const areNeighbors = (a: number, b: number): boolean => {
  const upper = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
  const lower = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
  const check = (row: number[]) => {
    const ia = row.indexOf(a);
    const ib = row.indexOf(b);
    return ia !== -1 && ib !== -1 && Math.abs(ia - ib) === 1;
  };
  return check(upper) || check(lower);
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
          if (d.dates) {
            setDates({
              impressions: new Date(d.dates.impressions),
              fitting: d.dates.fitting ? new Date(d.dates.fitting) : null,
              delivery: d.dates.delivery ? new Date(d.dates.delivery) : null,
            });
          }
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
        dates: {
          impressions: dates.impressions.toISOString(),
          fitting: dates.fitting?.toISOString() || null,
          delivery: dates.delivery?.toISOString() || null,
        },
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
  }, [doctorName, patientName, techName, dates, selectedTeeth, workType, workNote, implantsEnabled, toothTypes, implantData, bridges]);

  // ФОРМУЛА ЗУБОВ
  const upperJaw = [18,17,16,15,14,13,12,11, 21,22,23,24,25,26,27,28];
  const lowerJaw = [48,47,46,45,44,43,42,41, 31,32,33,34,35,36,37,38];

  const toggleTooth = (num: number) => {
    setSelectedTeeth(prev => {
      const existing = prev.find(t => t.number === num);
      if (existing) {
        // Remove tooth if it exists
        return prev.filter(t => t.number !== num);
      } else {
        // Add new tooth as crown
        return [...prev, { number: num, type: 'crown' }];
      }
    });
  };

  const toggleToothType = (num: number) => {
    setSelectedTeeth(prev => {
      const tooth = prev.find(t => t.number === num);
      if (tooth) {
        // Toggle between crown and pontic
        return prev.map(t => 
          t.number === num 
            ? { ...t, type: t.type === 'crown' ? 'pontic' : 'crown' }
            : t
        );
      }
      return prev;
    });
  };

  // Функции для управления связями
  const getConnectionKey = (a: number, b: number) => 
    `${Math.min(a,b)}-${Math.max(a,b)}`;

  const toggleConnection = (connId: string) => {
  setConnections(prev => 
    prev.includes(connId) ? prev.filter(c => c !== connId) : [...prev, connId]
  );
};

  const isConnectionActive = (a: number, b: number) =>
    connections.includes(getConnectionKey(a, b));

  // Функция группировки зубов в блоки
  const getAddonBlocks = () => {
    if (selectedTeeth.length === 0) return [];

    const sortedTeeth = [...selectedTeeth].sort((a, b) => a.number - b.number);
    const blocks = [];
    let currentBlock = [];

    for (let i = 0; i < sortedTeeth.length; i++) {
      const tooth = sortedTeeth[i];
      currentBlock.push(tooth);

      // Проверяем, нужно ли завершить текущий блок
      const nextTooth = sortedTeeth[i + 1];
      if (!nextTooth) {
        // Последний зуб - завершаем блок
        blocks.push([...currentBlock]);
        break;
      }

      // Проверяем связь в обе стороны: и "14-13", и "13-14"
      const connectionKey1 = `${tooth.number}-${nextTooth.number}`;
      const connectionKey2 = `${nextTooth.number}-${tooth.number}`;
      const hasConnection = connections.includes(connectionKey1) || connections.includes(connectionKey2);

      if (!hasConnection) {
        // Нет связи - завершаем текущий блок
        blocks.push([...currentBlock]);
        currentBlock = [];
      }
    }

    return blocks;
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

    if (showDatePicker === 'impressions') {
      setDates(prev => ({ ...prev, impressions: newDate }));
    } else if (showDatePicker === 'fitting') {
      setDates(prev => ({ ...prev, fitting: newDate }));
    } else if (showDatePicker === 'delivery') {
      setDates(prev => ({ ...prev, delivery: newDate }));
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
      bridges,
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Врач */}
        <View style={styles.section}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <Text style={styles.sectionTitle}>👨‍⚕️ ВРАЧ</Text>
            <TouchableOpacity
              onPress={() => {
                setDoctorName('');
              }}
              style={{
                padding: 4,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.05)',
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
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
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <Text style={styles.sectionTitle}>👤 ПАЦИЕНТ</Text>
            <TouchableOpacity
              onPress={() => {
                setPatientName('');
                // Можно добавить и другие поля пациента если они есть
              }}
              style={{
                padding: 4,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.05)',
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
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
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <Text style={styles.sectionTitle}>👨‍💻 ТЕХНИК</Text>
            <TouchableOpacity
              onPress={() => {
                setTechName('');
              }}
              style={{
                padding: 4,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.05)',
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
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
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <Text style={styles.sectionTitle}>📅 ДАТЫ</Text>
            <TouchableOpacity
              onPress={() => {
                setDates({
                  impressions: new Date(),
                  fitting: null,
                  delivery: null,
                });
              }}
              style={{
                padding: 4,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.05)',
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => setShowDatePicker('impressions')} style={styles.dateInput}>
            <Text style={styles.dateText}>
              <Text style={{ color: '#f2ca50' }}>Оттиски:</Text> {dates.impressions.toLocaleDateString('ru-RU')}
            </Text>
            <Ionicons name="calendar" size={20} color="#f2ca50" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowDatePicker('fitting')} style={styles.dateInput}>
            <Text style={styles.dateText}>
              <Text style={{ color: '#f2ca50' }}>Примерка:</Text> {dates.fitting ? dates.fitting.toLocaleDateString('ru-RU') : 'Не назначена'}
            </Text>
            <Ionicons name="calendar" size={20} color="#f2ca50" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowDatePicker('delivery')} style={styles.dateInput}>
            <Text style={styles.dateText}>
              <Text style={{ color: '#f2ca50' }}>Сдача:</Text> {dates.delivery ? dates.delivery.toLocaleDateString('ru-RU') : 'Не назначена'}
            </Text>
            <Ionicons name="calendar" size={20} color="#f2ca50" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
  <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <Text style={styles.sectionTitle}>🦷 ЗУБНАЯ ФОРМУЛА</Text>
            <TouchableOpacity
              onPress={() => {
                setSelectedTeeth([]);
                setConnections([]);
              }}
              style={{
                padding: 4,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.05)',
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>

  <View style={{ marginBottom: 20, width: '100%' }}>
    <Text style={styles.sectionLabel}>Верхняя челюсть</Text>

  <ScrollView 
    horizontal 
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ paddingHorizontal: 15, flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
    ref={topJawScrollRef}
  >
    <View style={{ flexDirection: 'row', paddingVertical: 10, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
      {[18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28].map((toothNumber, idx, arr) => {
        const isSelected = selectedTeeth.some(t => t.number === toothNumber);
        const toothData = selectedTeeth.find(t => t.number === toothNumber);
        const isPontic = toothData?.type === 'pontic';

        const nextTooth = arr[idx + 1];
        const connId = `${toothNumber}-${nextTooth}`;
        const isConnected = connections.includes(connId);

        return (
          <View key={toothNumber} style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Вертикальный блок: Кружок строго НАД своим зубом */}
            <View style={{ alignItems: 'center', width: 46, marginHorizontal: 2 }}>

              {/* Контейнер для кружка (сдвигаем его вправо, на границу зуба) */}
              <View style={{ height: 20, justifyContent: 'center', position: 'relative', width: '100%' }}>
                {nextTooth && (
                  <TouchableOpacity
                    onPress={() => toggleConnection(connId)}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: isConnected ? '#FFD700' : 'rgba(255,255,255,0.15)',
                      position: 'absolute',
                      right: -8, // Выносим кружок ровно на стык между кнопками
                      zIndex: 10,
                    }}
                  />
                )}
              </View>

              {/* Кнопка самого зуба */}
              <TouchableOpacity
                onPress={() => toggleTooth(toothNumber)}
                onLongPress={() => toggleToothType(toothNumber)}
                style={[
                  styles.toothButton,
                  { width: 46, height: 44 },
                  isSelected && styles.toothSelected,
                  isPontic && styles.toothPontic
                ]}
              >
                <Text style={styles.toothText}>{toothNumber}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  </ScrollView>
</View>

<View style={{ marginBottom: 20, width: '100%' }}>
  <Text style={styles.sectionLabel}>Нижняя челюсть</Text>

  <ScrollView 
    horizontal 
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ paddingHorizontal: 15, flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
    ref={bottomJawScrollRef}
  >
    <View style={{ flexDirection: 'row', paddingVertical: 10, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
      {[48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38].map((toothNumber, idx, arr) => {
        const isSelected = selectedTeeth.some(t => t.number === toothNumber);
        const toothData = selectedTeeth.find(t => t.number === toothNumber);
        const isPontic = toothData?.type === 'pontic';

        const nextTooth = arr[idx + 1];
        const connId = `${toothNumber}-${nextTooth}`;
        const isConnected = connections.includes(connId);

        return (
          <View key={toothNumber} style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Вертикальный блок: Кружок строго НАД своим зубом */}
            <View style={{ alignItems: 'center', width: 46, marginHorizontal: 2 }}>

              {/* Контейнер для кружка (сдвигаем его вправо, на границу зуба) */}
              <View style={{ height: 20, justifyContent: 'center', position: 'relative', width: '100%' }}>
                {nextTooth && (
                  <TouchableOpacity
                    onPress={() => toggleConnection(connId)}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: isConnected ? '#FFD700' : 'rgba(255,255,255,0.15)',
                      position: 'absolute',
                      right: -8, // Выносим кружок ровно на стык между кнопками
                      zIndex: 10,
                    }}
                  />
                )}
              </View>

              {/* Кнопка самого зуба */}
              <TouchableOpacity
                onPress={() => toggleTooth(toothNumber)}
                onLongPress={() => toggleToothType(toothNumber)}
                style={[
                  styles.toothButton,
                  { width: 46, height: 44 },
                  isSelected && styles.toothSelected,
                  isPontic && styles.toothPontic
                ]}
              >
                <Text style={styles.toothText}>{toothNumber}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  </ScrollView>
</View>
</View>

        {/* Динамические блоки конструкций */}
        {getAddonBlocks().length > 0 && (
          <View style={styles.section}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <TouchableOpacity
                onPress={() => setShowConstructions(prev => !prev)}
                style={{ flex: 1 }}
                activeOpacity={0.7}
              >
                <Text style={styles.sectionTitle}>
                  🛠️ КОНСТРУКЦИИ{' '}
                  <Text style={{ color: '#E2BD75', fontSize: 13, fontWeight: 'bold' }}>
                    {showConstructions ? '▼' : '►'}
                  </Text>
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setBlockDetails({});
                  setBlockMaterials({});
                  setShowImplantSystems({});
                  setShowImplantDiameters({});
                  setOpenImplantDropdownId(null);
                  setSelectedBlockIndex(null);
                  setShowWorkTypes(false);
                }}
                style={{
                  padding: 4,
                  borderRadius: 4,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>

            {!showConstructions && (() => {
              const blocks = getAddonBlocks();
              if (blocks.length === 0) {
                return <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>Конструкции не выбраны</Text>;
              }

              return (
                <View style={{ flexDirection: 'column', marginTop: 8, gap: 4 }}>
                  {blocks.map((block) => {
                    const blockKey = block.map(t => t.number).join('-');
                    const details = blockDetails[blockKey] || {};
                    const type = blockKey.includes('-') ? 'Мост' : 'Зуб';
                    const teeth = blockKey.includes('-') ? blockKey.replace(/-/g, ', ') : blockKey;
                    const material = details.material ? details.material : 'не выбран';
                    const hasImplant = !!details.isImplant;

                    return (
                      <View key={blockKey} style={{ flexDirection: 'column', gap: 2, marginBottom: 6 }}>
                        {/* Строка 1: Название и зубы */}
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>{type} </Text>
                          <Text style={{ color: '#E2BD75', fontSize: 15, fontWeight: '600' }}>({teeth})</Text>
                        </View>
                        
                        {/* Строка 2: Только название материала */}
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '500' }}>{material}</Text>
                        </View>
                        
                        {/* Строка 3: Статус импланта без точки */}
                        {hasImplant && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>На имплантах</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })()}

            {/* РЕНДЕР КАРТОЧКИ БЛОКА */}
            {showConstructions && getAddonBlocks().map((block, blockIndex) => {
              const blockKey = block.map(t => t.number).join('-');
              const details = blockDetails[blockKey] || {};

              return (
                <View key={blockKey} style={{
                  backgroundColor: '#0a1628ee',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(242,202,80,0.15)',
                  padding: 12,
                  marginBottom: 12,
                }}>
                  {/* ШАПКА КАРТОЧКИ */}
                  <View style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
                      {/* ТУМБЛЕР ИМПЛАНТ */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Имплант</Text>
                      <Switch
                        value={!!details.isImplant}
                        onValueChange={(val) => {
                          setBlockDetails(prev => ({
                            ...prev,
                            [blockKey]: { 
                              ...prev[blockKey], 
                              isImplant: val, 
                              fixationType: val ? 'screw' : undefined 
                            }
                          }));
                        }}
                        trackColor={{ false: '#767577', true: '#E2BD75' }}
                        thumbColor="#ffffff"
                        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                      />
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4, marginBottom: 12 }}>
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                        {blockKey.includes('-') ? 'Мост:' : 'Зуб:'}
                      </Text>
                      <Text style={{ color: '#E2BD75', fontSize: 15, fontWeight: '600' }}>
                        {blockKey.includes('-') ? blockKey.replace(/-/g, ', ') : blockKey}
                      </Text>
                    </View>
                  </View>

                  {/* ТЕЛО КАРТОЧКИ */}
                  <View style={{ marginTop: 12 }}>
                      {/* 1. Материал */}
                      <Text style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Материал конструкции</Text>

                      {/* ДРОПДАУН ВЫБОРА МАТЕРИАЛА */}
                      <TouchableOpacity
                        onPress={() => {
                          setShowWorkTypes(!showWorkTypes);
                          setSelectedBlockIndex(blockIndex);
                        }}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          borderRadius: 8,
                          padding: 10,
                          borderWidth: 1,
                          borderColor: details.material ? '#E2BD75' : 'rgba(255,255,255,0.1)',
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: details.material ? '#E2BD75' : 'rgba(255,255,255,0.6)' }}>
                          {details.material || 'Выберите материал...'}
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.4)' }}>▼</Text>
                      </TouchableOpacity>

                      {showWorkTypes && selectedBlockIndex === blockIndex && (
                        <View style={{
                          marginTop: 6,
                          backgroundColor: '#07111f',
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: 'rgba(226,189,117,0.25)',
                          overflow: 'hidden',
                        }}>
                          {WORK_TYPES.map(workType => (
                            <TouchableOpacity
                              key={workType.id}
                              onPress={() => {
                                setBlockDetails(prev => ({
                                  ...prev,
                                  [blockKey]: { ...prev[blockKey], material: workType.label }
                                }));
                                setShowWorkTypes(false);
                                setSelectedBlockIndex(null);
                              }}
                              style={{
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                borderBottomWidth: 1,
                                borderBottomColor: 'rgba(255,255,255,0.06)',
                                backgroundColor: details.material === workType.label ? 'rgba(226,189,117,0.12)' : 'transparent',
                              }}
                            >
                              <Text style={{ color: details.material === workType.label ? '#E2BD75' : '#fff' }}>
                                {workType.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {/* 2. Логика имплантов */}
                      {!!details.isImplant && (
                        <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 }}>

                          {/* ТИП ФИКСАЦИИ */}
                          <Text style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Тип фиксации:</Text>
                          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                            <TouchableOpacity 
                              style={{
                                flex: 1,
                                padding: 8,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: details.fixationType === 'screw' ? '#E2BD75' : 'rgba(255,255,255,0.2)',
                                backgroundColor: details.fixationType === 'screw' ? 'rgba(226,189,117,0.1)' : 'transparent',
                                alignItems: 'center',
                              }}
                              onPress={() => setBlockDetails(prev => ({ ...prev, [blockKey]: { ...prev[blockKey], fixationType: 'screw' } }))}
                            >
                              <Text style={{ color: '#fff' }}>Винтовая</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={{
                                flex: 1,
                                padding: 8,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: details.fixationType === 'cement' ? '#E2BD75' : 'rgba(255,255,255,0.2)',
                                backgroundColor: details.fixationType === 'cement' ? 'rgba(226,189,117,0.1)' : 'transparent',
                                alignItems: 'center',
                              }}
                              onPress={() => setBlockDetails(prev => ({ ...prev, [blockKey]: { ...prev[blockKey], fixationType: 'cement' } }))}
                            >
                              <Text style={{ color: '#fff' }}>Цементная</Text>
                            </TouchableOpacity>
                          </View>

                          {/* ПОЗУБНЫЙ СПИСОК */}
                          {blockKey.split('-').map((toothStr) => {
                            const toothNum = parseInt(toothStr, 10);
                            const isPontic = !!details.isPontic?.[toothNum];

                            return (
                              <View key={toothNum} style={{ marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                  <Text style={{ color: '#E2BD75', fontWeight: 'bold' }}>Зуб №{toothNum}</Text>

                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Промежуток</Text>
                                    <TouchableOpacity
                                      onPress={() => setBlockDetails(prev => ({
                                        ...prev,
                                        [blockKey]: {
                                          ...prev[blockKey],
                                          isPontic: { ...(prev[blockKey]?.isPontic || {}), [toothNum]: !isPontic }
                                        }
                                      }))}
                                      style={{
                                        width: 36,
                                        height: 20,
                                        borderRadius: 10,
                                        backgroundColor: isPontic ? '#E2BD75' : 'rgba(255,255,255,0.2)',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <View style={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: 8,
                                        backgroundColor: '#fff',
                                        alignSelf: isPontic ? 'flex-end' : 'flex-start',
                                        marginHorizontal: 2,
                                      }} />
                                    </TouchableOpacity>
                                  </View>
                                </View>

                                {isPontic ? (
                                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', paddingVertical: 4 }}>
                                    Промежуточная часть моста (без импланта)
                                  </Text>
                                ) : (
                                  <View>
                                    <TouchableOpacity
                                      onPress={() => {
                                        const key = `${blockKey}-${toothNum}`;
                                        setOpenImplantDropdownId(prev => prev === key ? null : key);
                                      }}
                                      style={{
                                        backgroundColor: 'rgba(255,255,255,0.06)',
                                        borderRadius: 8,
                                        padding: 10,
                                        borderWidth: 1,
                                        borderColor: details.implantSystems?.[toothNum] ? '#E2BD75' : 'rgba(255,255,255,0.12)',
                                      }}
                                    >
                                      <Text style={{ color: details.implantSystems?.[toothNum] ? '#E2BD75' : 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                                        {details.implantSystems?.[toothNum]
                                          ? details.implantDiameters?.[toothNum]
                                            ? `${details.implantSystems[toothNum]} ø${details.implantDiameters[toothNum]} мм`
                                            : details.implantSystems[toothNum]
                                          : 'Выберите систему имплантов...'}
                                      </Text>
                                    </TouchableOpacity>

                                    {openImplantDropdownId === `${blockKey}-${toothNum}` && (
                                      <View style={{
                                        marginTop: 4,
                                        backgroundColor: '#07111f',
                                        borderRadius: 8,
                                        borderWidth: 1,
                                        borderColor: 'rgba(226,189,117,0.25)',
                                        overflow: 'hidden',
                                      }}>
                                        {!details.implantSystems?.[toothNum] ? (
                                          (Object.keys(IMPLANT_SYSTEMS) as Array<keyof typeof IMPLANT_SYSTEMS>).map(system => (
                                            <TouchableOpacity
                                              key={system}
                                              onPress={() => {
                                                setBlockDetails(prev => ({
                                                  ...prev,
                                                  [blockKey]: {
                                                    ...prev[blockKey],
                                                    implantSystems: { ...(prev[blockKey]?.implantSystems || {}), [toothNum]: system },
                                                    implantDiameters: { ...(prev[blockKey]?.implantDiameters || {}), [toothNum]: '' },
                                                  }
                                                }));
                                              }}
                                              style={{
                                                paddingVertical: 10,
                                                paddingHorizontal: 12,
                                                borderBottomWidth: 1,
                                                borderBottomColor: 'rgba(255,255,255,0.06)',
                                              }}
                                            >
                                              <Text style={{ color: '#fff', fontSize: 12 }}>{system}</Text>
                                            </TouchableOpacity>
                                          ))
                                        ) : (
                                          IMPLANT_SYSTEMS[details.implantSystems[toothNum] as keyof typeof IMPLANT_SYSTEMS].map(diameter => (
                                            <TouchableOpacity
                                              key={diameter}
                                              onPress={() => {
                                                setBlockDetails(prev => ({
                                                  ...prev,
                                                  [blockKey]: {
                                                    ...prev[blockKey],
                                                    implantDiameters: { ...(prev[blockKey]?.implantDiameters || {}), [toothNum]: diameter },
                                                  }
                                                }));
                                                setOpenImplantDropdownId(null);
                                              }}
                                              style={{
                                                paddingVertical: 10,
                                                paddingHorizontal: 12,
                                                borderBottomWidth: 1,
                                                borderBottomColor: 'rgba(255,255,255,0.06)',
                                              }}
                                            >
                                              <Text style={{ color: '#fff', fontSize: 12 }}>ø{diameter} мм</Text>
                                            </TouchableOpacity>
                                          ))
                                        )}
                                      </View>
                                    )}
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Цвет VITA */}
        <View style={styles.section}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <Text style={styles.sectionTitle}>🎨 ЦВЕТ VITA</Text>
            <TouchableOpacity
              onPress={() => {
                setVitaResult(null);
              }}
              style={{
                padding: 4,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.05)',
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
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
    onPress={async () => {
      try {
        // Сохраняем текущие состояния в AsyncStorage перед переходом
        await AsyncStorage.setItem('tempBlockDetails', JSON.stringify(blockDetails));
        await AsyncStorage.setItem('tempConnections', JSON.stringify(connections));

        // Переходим на экран цвета
        router.push('/color-analyzer');
      } catch (error) {
        console.error('Error saving states:', error);
        // Если сохранение не удалось, все равно переходим
        router.push('/color-analyzer');
      }
    }}
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
          <Text style={styles.sectionTitle}>📝 ПРИМЕЧАНИЕ</Text>
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

        {/* Расширенные параметры */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.extendedHeader}
            onPress={() => setShowExtended(!showExtended)}
          >
            <Text style={styles.sectionTitle}>ДОПОЛНИТЕЛЬНО{' '}
              <Text style={{ color: '#E2BD75', fontSize: 13, fontWeight: 'bold' }}>
                {showExtended ? '▼' : '►'}
              </Text>
            </Text>
          </TouchableOpacity>

          {showExtended && (
            <View style={styles.extendedContent}>
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
                  ]}>Винтовая</Text>
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
                  ]}>Цементная</Text>
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
                  ]}>Полная</Text>
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
                  ]}>Нанесение</Text>
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
                  ]}>Одиночки</Text>
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
                  ]}>Мост</Text>
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
                  ]}>Гирлянда</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Кнопки */}
        <View style={{ paddingTop: 8, paddingBottom: 32, gap: 8 }}>
          <TouchableOpacity
            style={{
              backgroundColor: '#f2ca50',
              borderRadius: 14,
              padding: 16,
              alignItems: 'center',
            }}
            onPress={handleSubmit}
          >
            <Text style={{ color: '#031427', fontSize: 16, fontWeight: '700' }}>
              Отправить наряд
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              paddingVertical: 14,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,80,80,0.3)',
              borderRadius: 14,
              backgroundColor: 'rgba(255,80,80,0.05)',
            }}
            onPress={() => setShowClearModal(true)}
          >
            <Text style={{ color: '#ff4444', fontSize: 15, fontWeight: '500' }}>
              🗑 Очистить наряд
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Календарь */}
      {showDatePicker && (
        <DateTimePicker
          value={dates[showDatePicker] || new Date()}
          mode="date"
          display="calendar"
          onChange={(event, date) => {
            setShowDatePicker(null);
            if (date) {
              if (showDatePicker === 'impressions') {
                setDates(prev => ({ ...prev, impressions: date }));
              } else if (showDatePicker === 'fitting') {
                setDates(prev => ({ ...prev, fitting: date }));
              } else if (showDatePicker === 'delivery') {
                setDates(prev => ({ ...prev, delivery: date }));
              }
            }
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
                  setDates({
                    impressions: new Date(),
                    fitting: null,
                    delivery: null,
                  });
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
                  setConnections([]); // Очищаем точки соединений зубов
                  setSelectedTeeth([]); // Очищаем выбранные зубы
                  // Сбрасываем детали блоков и состояния дропдаунов
                  setBlockDetails({});
                  setBlockMaterials({});
                  setShowImplantSystems({});
                  setShowImplantDiameters({});
                  setOpenImplantDropdownId(null);
                  setSelectedBlockIndex(null);
                  setShowWorkTypes(false);
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
  toothButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toothSelected: {
    borderColor: '#f2ca50',
    backgroundColor: 'rgba(242,202,80,0.2)',
  },
  toothPontic: {
    borderStyle: 'dashed',
    opacity: 0.7,
    backgroundColor: 'rgba(242,202,80,0.1)',
  },
  toothText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
});