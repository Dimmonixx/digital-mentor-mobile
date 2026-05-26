import { database } from '@/constants/firebase';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onValue, push, ref } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  Keyboard,
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
import { playSuccessSound } from '../utils/audio';

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

  const [selectedDoctor, setSelectedDoctor] = useState<{id: string, name: string} | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<{id: string, name: string} | null>(null);
  const [doctors, setDoctors] = useState<{id: string, name: string}[]>([]);
  const [technicians, setTechnicians] = useState<{id: string, name: string}[]>([]);
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [showTechnicianModal, setShowTechnicianModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [patientName, setPatientName] = useState('');
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

  const [implantSystem, setImplantSystem] = useState('');
  const [fixationType, setFixationType] = useState<'screw'|'cement'|null>(null);
  const [anatomyType, setAnatomyType] = useState<'full'|'apply'|null>(null);
  const [structureType, setStructureType] = useState<'single'|'bridge'|'garland'|null>(null);

  const [vitaResult, setVitaResult] = useState<any>(null);
  const [showVitaDetails, setShowVitaDetails] = useState(false);
  const [showConstructions, setShowConstructions] = useState(true);
  const [showClearModal, setShowClearModal] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [showWorkTypes, setShowWorkTypes] = useState(false);

  useEffect(() => {
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const usersList = Object.entries(data).map(([id, user]: any) => ({
          id,
          name: user.name,
          role: user.role,
        }));
        const doctorsList = usersList.filter(user => user.role === 'doctor');
        const techniciansList = usersList.filter(user => user.role === 'technician');
        setDoctors(doctorsList);
        setTechnicians(techniciansList);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('user').then(data => {
      if (data) {
        const user = JSON.parse(data);
        setUser(user);
        console.log('Текущий пользователь:', user);
      }
    });
  }, []);

  useEffect(() => {
    if (user && doctors.length > 0 && technicians.length > 0) {
      if (user.role === 'doctor' && !selectedDoctor) {
        const currentDoctor = doctors.find(d => d.id === user.email || d.name === user.name);
        if (currentDoctor) {
          setSelectedDoctor(currentDoctor);
        } else {
          setSelectedDoctor({ id: user.email, name: user.name });
        }
      } else if (user.role === 'technician' && !selectedTechnician) {
        const currentTechnician = technicians.find(t => t.id === user.email || t.name === user.name);
        if (currentTechnician) {
          setSelectedTechnician(currentTechnician);
        } else {
          setSelectedTechnician({ id: user.email, name: user.name });
        }
      }
    }
  }, [user, doctors, technicians, selectedDoctor, selectedTechnician]);

  useEffect(() => {
    const restoreStates = async () => {
      try {
        const savedBlockDetails = await AsyncStorage.getItem('tempBlockDetails');
        if (savedBlockDetails) {
          setBlockDetails(JSON.parse(savedBlockDetails));
          await AsyncStorage.removeItem('tempBlockDetails');
        }
        const savedConnections = await AsyncStorage.getItem('tempConnections');
        if (savedConnections) {
          setConnections(JSON.parse(savedConnections));
          await AsyncStorage.removeItem('tempConnections');
        }
      } catch (error) {
        console.error('Error restoring states:', error);
      }
    };
    restoreStates();
  }, []);

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
  const [connections, setConnections] = useState<string[]>([]);
  const [blockMaterials, setBlockMaterials] = useState<Record<string, string>>({});
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [showImplantSystems, setShowImplantSystems] = useState<Record<string, boolean>>({});
  const [showImplantDiameters, setShowImplantDiameters] = useState<Record<string, boolean>>({});
  const [openImplantDropdownId, setOpenImplantDropdownId] = useState<string | null>(null);
  const [blockDetails, setBlockDetails] = useState<Record<string, {
    material?: string;
    isImplant?: boolean;
    fixationType?: 'screw' | 'cement';
    implantSystems?: Record<number, string>;
    implantDiameters?: Record<number, string>;
    isPontic?: Record<number, boolean>;
    isExpanded?: boolean;
  }>>({});

  const getBridgeKey = (a: number, b: number) =>
    `${Math.min(a,b)}-${Math.max(a,b)}`;

  const toggleBridge = (a: number, b: number) => {
    const key = getBridgeKey(a, b);
    setBridges(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
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

  useEffect(() => {
    const loadVitaResult = async () => {
      try {
        const stored = await AsyncStorage.getItem('pendingVitaResult');
        if (stored) {
          setVitaResult(JSON.parse(stored));
          await AsyncStorage.removeItem('pendingVitaResult');
        }
      } catch (e) {
        console.error('Error loading vita result:', e);
      }
    };
    loadVitaResult();
  }, []);

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await AsyncStorage.getItem('orderDraft');
        if (draft) {
          const d = JSON.parse(draft);
          if (d.selectedDoctor) setSelectedDoctor(d.selectedDoctor);
          if (d.patientName) setPatientName(d.patientName);
          if (d.selectedTechnician) setSelectedTechnician(d.selectedTechnician);
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

  useEffect(() => {
    if (selectedDoctor) AsyncStorage.setItem('selectedDoctor', JSON.stringify(selectedDoctor));
  }, [selectedDoctor]);

  useEffect(() => {
    if (selectedTechnician) AsyncStorage.setItem('selectedTechnician', JSON.stringify(selectedTechnician));
  }, [selectedTechnician]);

  useEffect(() => {
    const saveDraft = async () => {
      const draft = {
        selectedDoctor,
        patientName,
        selectedTechnician,
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
  }, [selectedDoctor, patientName, selectedTechnician, dates, selectedTeeth, workType, workNote, implantsEnabled, toothTypes, implantData, bridges]);

  const upperJaw = [18,17,16,15,14,13,12,11, 21,22,23,24,25,26,27,28];
  const lowerJaw = [48,47,46,45,44,43,42,41, 31,32,33,34,35,36,37,38];

  const toggleTooth = (num: number) => {
    setSelectedTeeth(prev => {
      const existing = prev.find(t => t.number === num);
      if (existing) {
        return prev.filter(t => t.number !== num);
      } else {
        return [...prev, { number: num, type: 'crown' }];
      }
    });
  };

  const toggleToothType = (num: number) => {
    setSelectedTeeth(prev => {
      const tooth = prev.find(t => t.number === num);
      if (tooth) {
        return prev.map(t =>
          t.number === num
            ? { ...t, type: t.type === 'crown' ? 'pontic' : 'crown' }
            : t
        );
      }
      return prev;
    });
  };

  const getConnectionKey = (a: number, b: number) =>
    `${Math.min(a,b)}-${Math.max(a,b)}`;

  const toggleConnection = (connId: string) => {
    setConnections(prev =>
      prev.includes(connId) ? prev.filter(c => c !== connId) : [...prev, connId]
    );
  };

  const isConnectionActive = (a: number, b: number) =>
    connections.includes(getConnectionKey(a, b));

  const getAddonBlocks = () => {
    if (selectedTeeth.length === 0) return [];

    const sortedTeeth = [...selectedTeeth].sort((a, b) => a.number - b.number);
    const blocks = [];
    let currentBlock = [];

    for (let i = 0; i < sortedTeeth.length; i++) {
      const tooth = sortedTeeth[i];
      currentBlock.push(tooth);

      const nextTooth = sortedTeeth[i + 1];
      if (!nextTooth) {
        blocks.push([...currentBlock]);
        break;
      }

      const connectionKey1 = `${tooth.number}-${nextTooth.number}`;
      const connectionKey2 = `${nextTooth.number}-${tooth.number}`;
      const hasConnection = connections.includes(connectionKey1) || connections.includes(connectionKey2);

      if (!hasConnection) {
        blocks.push([...currentBlock]);
        currentBlock = [];
      }
    }

    return blocks;
  };

  const WORK_TYPES = [
    { id: 'metal', label: 'Металл' },
    { id: 'inlay', label: 'Вкладка' },
    { id: 'metalceramic', label: 'Металлокерамика' },
    { id: 'zirconia', label: 'Диоксид циркона' },
    { id: 'emax', label: 'Дисиликат лития' },
    { id: 'implant', label: 'Имплант' },
  ];

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

  const handleSubmit = async () => {
    Keyboard.dismiss();

    if (!selectedDoctor || !selectedTechnician || !patientName.trim()) {
      Alert.alert('Внимание', 'Пожалуйста, заполните ФИО пациента, а также выберите врача и техника.');
      return;
    }
    setLoading(true);
    const order = {
      doctorId: selectedDoctor?.id || null,
      doctorName: selectedDoctor?.name || 'Не указан',
      technicianId: selectedTechnician?.id || null,
      technicianName: selectedTechnician?.name || 'Не указан',
      patientName,
      workType,
      dates: {
        impressions: dates.impressions.toISOString(),
        fitting: dates.fitting?.toISOString() || null,
        delivery: dates.delivery?.toISOString() || null,
      },
      selectedTeeth,
      workNote,
      vitaResult,
      implantSystem,
      fixationType,
      anatomyType,
      structureType,
      bridges,
      blockDetails,
      status: 'new',
      createdAt: Date.now(),
    };
    await push(ref(database, 'orders'), order);
    await playSuccessSound();
    await AsyncStorage.removeItem('orderDraft');
    setLoading(false);
    Alert.alert('Успешно!', 'Наряд отправлен технику', [
      { text: 'OK', onPress: () => setTimeout(() => router.back(), 400) }
    ]);
  };

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
      <StatusBar style="light" backgroundColor="transparent" translucent />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.headerIconBtn}>
          <Ionicons name="menu-outline" size={28} color="#f2ca50" />
        </TouchableOpacity>
        <Image
          source={require('@/assets/images/header-logo.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.headerIconBtn}
            onPress={() => {
              router.push('/(tabs)/search');
              setTimeout(() => {
                (window as any).showNewOrders?.();
              }, 100);
            }}
          >
            <Ionicons name="notifications-outline" size={24} color="#f2ca50" />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>3</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Локальная навигация */}
      <View style={[styles.localHeader, { paddingTop: 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#f2ca50" />
        </TouchableOpacity>
        <Text style={styles.localTitle}>Новый наряд</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Анкета: Врач, Пациент, Техник */}
        <View style={styles.section}>
          <View style={styles.cardContainer}>
            {/* Врач */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.sectionTitle}>👨‍⚕️ ВРАЧ</Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedDoctor(null);
                  setPatientName('');
                  setSelectedTechnician(null);
                }}
                style={{ padding: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)' }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setShowDoctorModal(true)} style={[styles.input, { marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                <Text style={{ color: selectedDoctor ? '#ffffff' : 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: '500' }}>
                  {selectedDoctor?.name || 'Выберите врача'}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#f2ca50" />
              </View>
            </TouchableOpacity>

            {/* Разделитель */}
            <View style={{ height: 1, backgroundColor: 'rgba(242,202,80,0.15)', marginVertical: 8 }} />

            {/* Пациент */}
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.sectionTitle}>👤 ПАЦИЕНТ</Text>
            </View>
            <TextInput
              style={[styles.input, { marginBottom: 12 }]}
              placeholder="ФИО пациента *"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={patientName}
              onChangeText={setPatientName}
            />

            {/* Разделитель */}
            <View style={{ height: 1, backgroundColor: 'rgba(242,202,80,0.15)', marginVertical: 8 }} />

            {/* Техник */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.sectionTitle}>👨‍💻 ТЕХНИК</Text>
            </View>
            <TouchableOpacity onPress={() => setShowTechnicianModal(true)} style={styles.input}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                <Text style={{ color: selectedTechnician ? '#ffffff' : 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: '500' }}>
                  {selectedTechnician?.name || 'Выберите техника'}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#f2ca50" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Даты */}
        <View style={styles.section}>
          <View style={styles.cardContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={styles.sectionTitle}>📅 ДАТЫ</Text>
            <TouchableOpacity
              onPress={() => setDates({ impressions: new Date(), fitting: null, delivery: null })}
              style={{ padding: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)' }}
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
        </View>

        {/* Зубная формула */}
        <View style={styles.section}>
          <View style={styles.cardContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.sectionTitle}>🦷 ЗУБНАЯ ФОРМУЛА</Text>
              <TouchableOpacity
                onPress={() => { setSelectedTeeth([]); setConnections([]); }}
                style={{ padding: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)' }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>

            {/* Верхняя челюсть */}
            <View style={{ marginBottom: 20, width: '100%' }}>
              <Text style={styles.sectionLabel}>Верхняя челюсть</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 15, flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
                ref={topJawScrollRef}
              >
                <View style={{ flexDirection: 'row', paddingVertical: 10, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                  {[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28].map((toothNumber, idx, arr) => {
                    const isSelected = selectedTeeth.some(t => t.number === toothNumber);
                    const toothData = selectedTeeth.find(t => t.number === toothNumber);
                    const isPontic = toothData?.type === 'pontic';
                    const nextTooth = arr[idx + 1];
                    const connId = `${toothNumber}-${nextTooth}`;
                    const isConnected = connections.includes(connId);
                    return (
                      <View key={toothNumber} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ alignItems: 'center', width: 46, marginHorizontal: 2 }}>
                          <View style={{ height: 20, justifyContent: 'center', position: 'relative', width: '100%' }}>
                            {nextTooth && (
                              <TouchableOpacity
                                onPress={() => toggleConnection(connId)}
                                style={{
                                  width: 12, height: 12, borderRadius: 6,
                                  backgroundColor: isConnected ? '#FFD700' : 'rgba(255,255,255,0.15)',
                                  position: 'absolute', right: -8, zIndex: 10,
                                }}
                              />
                            )}
                          </View>
                          <TouchableOpacity
                            onPress={() => toggleTooth(toothNumber)}
                            onLongPress={() => toggleToothType(toothNumber)}
                            style={[
                              styles.toothButton,
                              { width: 46, height: 44 },
                              isSelected && styles.toothSelected,
                              isPontic && styles.toothPontic,
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

            {/* Нижняя челюсть */}
            <View style={{ marginBottom: 20, width: '100%' }}>
              <Text style={styles.sectionLabel}>Нижняя челюсть</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 15, flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
                ref={bottomJawScrollRef}
              >
                <View style={{ flexDirection: 'row', paddingVertical: 10, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                  {[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38].map((toothNumber, idx, arr) => {
                    const isSelected = selectedTeeth.some(t => t.number === toothNumber);
                    const toothData = selectedTeeth.find(t => t.number === toothNumber);
                    const isPontic = toothData?.type === 'pontic';
                    const nextTooth = arr[idx + 1];
                    const connId = `${toothNumber}-${nextTooth}`;
                    const isConnected = connections.includes(connId);
                    return (
                      <View key={toothNumber} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ alignItems: 'center', width: 46, marginHorizontal: 2 }}>
                          <View style={{ height: 20, justifyContent: 'center', position: 'relative', width: '100%' }}>
                            {nextTooth && (
                              <TouchableOpacity
                                onPress={() => toggleConnection(connId)}
                                style={{
                                  width: 12, height: 12, borderRadius: 6,
                                  backgroundColor: isConnected ? '#FFD700' : 'rgba(255,255,255,0.15)',
                                  position: 'absolute', right: -8, zIndex: 10,
                                }}
                              />
                            )}
                          </View>
                          <TouchableOpacity
                            onPress={() => toggleTooth(toothNumber)}
                            onLongPress={() => toggleToothType(toothNumber)}
                            style={[
                              styles.toothButton,
                              { width: 46, height: 44 },
                              isSelected && styles.toothSelected,
                              isPontic && styles.toothPontic,
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
        </View>

        {/* 🛠️ КОНСТРУКЦИИ */}
        <View style={styles.section}>
          <View style={styles.cardContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
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
                style={{ padding: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)' }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>

            {!showConstructions && (
              <View style={{ marginTop: 12 }}>
                {selectedTeeth.length === 0 ? (
                  <View style={{
                    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 20,
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center',
                  }}>
                    <Ionicons name="construct-outline" size={32} color="rgba(255,255,255,0.3)" style={{ marginBottom: 8 }} />
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                      Выберите зуб на формуле выше, чтобы настроить тип работы, материал или имплант
                    </Text>
                  </View>
                ) : (
                  (() => {
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
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>{type} </Text>
                                <Text style={{ color: '#E2BD75', fontSize: 15, fontWeight: '600' }}>({teeth})</Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '500' }}>{material}</Text>
                              </View>
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
                  })()
                )}
              </View>
            )}

            {/* РЕНДЕР КАРТОЧКИ БЛОКА */}
            {showConstructions && getAddonBlocks().map((block, blockIndex) => {
              const blockKey = block.map(t => t.number).join('-');
              const details = blockDetails[blockKey] || {};
              return (
                <View key={blockKey} style={{
                  backgroundColor: '#0a1628ee', borderRadius: 12,
                  borderWidth: 1, borderColor: 'rgba(242,202,80,0.15)',
                  padding: 12, marginBottom: 12,
                }}>
                  {/* ШАПКА КАРТОЧКИ */}
                  <View style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
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
                                fixationType: val ? 'screw' : undefined,
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
                    <Text style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Материал конструкции</Text>
                    <TouchableOpacity
                      onPress={() => { setShowWorkTypes(!showWorkTypes); setSelectedBlockIndex(blockIndex); }}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 10,
                        borderWidth: 1, borderColor: details.material ? '#E2BD75' : 'rgba(255,255,255,0.1)',
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: details.material ? '#E2BD75' : 'rgba(255,255,255,0.6)' }}>
                        {details.material || 'Выберите материал...'}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.4)' }}>▼</Text>
                    </TouchableOpacity>

                    {showWorkTypes && selectedBlockIndex === blockIndex && (
                      <View style={{
                        marginTop: 6, backgroundColor: '#07111f', borderRadius: 8,
                        borderWidth: 1, borderColor: 'rgba(226,189,117,0.25)', overflow: 'hidden',
                      }}>
                        {WORK_TYPES.map(wt => (
                          <TouchableOpacity
                            key={wt.id}
                            onPress={() => {
                              setBlockDetails(prev => ({
                                ...prev,
                                [blockKey]: {
                                  ...prev[blockKey],
                                  material: wt.label,
                                  isImplant: wt.id === 'implant',
                                  implantSystems: wt.id === 'implant' ? {} : prev[blockKey]?.implantSystems,
                                  implantDiameters: wt.id === 'implant' ? {} : prev[blockKey]?.implantDiameters,
                                }
                              }));
                              setShowWorkTypes(false);
                              setSelectedBlockIndex(null);
                            }}
                            style={{
                              paddingVertical: 10, paddingHorizontal: 12,
                              borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
                              backgroundColor: details.material === wt.label ? 'rgba(226,189,117,0.12)' : 'transparent',
                            }}
                          >
                            <Text style={{ color: details.material === wt.label ? '#E2BD75' : '#fff' }}>
                              {wt.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Логика имплантов */}
                    {!!details.isImplant && (
                      <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 }}>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Тип фиксации:</Text>
                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                          <TouchableOpacity
                            style={{
                              flex: 1, padding: 8, borderRadius: 6, borderWidth: 1, alignItems: 'center',
                              borderColor: details.fixationType === 'screw' ? '#E2BD75' : 'rgba(255,255,255,0.2)',
                              backgroundColor: details.fixationType === 'screw' ? 'rgba(226,189,117,0.1)' : 'transparent',
                            }}
                            onPress={() => setBlockDetails(prev => ({ ...prev, [blockKey]: { ...prev[blockKey], fixationType: 'screw' } }))}
                          >
                            <Text style={{ color: '#fff' }}>Винтовая</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{
                              flex: 1, padding: 8, borderRadius: 6, borderWidth: 1, alignItems: 'center',
                              borderColor: details.fixationType === 'cement' ? '#E2BD75' : 'rgba(255,255,255,0.2)',
                              backgroundColor: details.fixationType === 'cement' ? 'rgba(226,189,117,0.1)' : 'transparent',
                            }}
                            onPress={() => setBlockDetails(prev => ({ ...prev, [blockKey]: { ...prev[blockKey], fixationType: 'cement' } }))}
                          >
                            <Text style={{ color: '#fff' }}>Цементная</Text>
                          </TouchableOpacity>
                        </View>

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
                                      width: 36, height: 20, borderRadius: 10,
                                      backgroundColor: isPontic ? '#E2BD75' : 'rgba(255,255,255,0.2)',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <View style={{
                                      width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff',
                                      alignSelf: isPontic ? 'flex-end' : 'flex-start', marginHorizontal: 2,
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
                                      backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 10,
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
                                      marginTop: 4, backgroundColor: '#07111f', borderRadius: 8,
                                      borderWidth: 1, borderColor: 'rgba(226,189,117,0.25)', overflow: 'hidden',
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
                                            style={{ paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}
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
                                            style={{ paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}
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
        </View>

        {/* Цвет VITA */}
        <View style={styles.section}>
          <View style={styles.cardContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.sectionTitle}>🎨 ЦВЕТ VITA</Text>
              <TouchableOpacity
                onPress={() => setVitaResult(null)}
                style={{ padding: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)' }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
            {vitaResult ? (
              <View style={{ borderWidth: 1, borderColor: '#f2ca50', borderRadius: 12, overflow: 'hidden' }}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: 'rgba(242,202,80,0.08)' }}
                  onPress={() => setShowVitaDetails(!showVitaDetails)}
                >
                  <Text style={{ color: '#f2ca50', fontSize: 32, fontWeight: 'bold', letterSpacing: 1 }}>
                    {vitaResult.primary_range ?? vitaResult.shade ?? '—'}
                  </Text>
                  <Ionicons name={showVitaDetails ? 'chevron-up' : 'chevron-down'} size={24} color="#f2ca50" />
                </TouchableOpacity>

                {showVitaDetails && (
                  <View style={{ padding: 16 }}>
                    {(vitaResult.imageUri || vitaResult.originalImageUri) && (
                      <TouchableOpacity
                        onPress={() => { setActivePhoto(vitaResult.imageUri || vitaResult.originalImageUri); setShowPhotoModal(true); }}
                        style={{ marginBottom: 12 }}
                      >
                        <Image
                          source={{ uri: vitaResult.imageUri || vitaResult.originalImageUri }}
                          style={{ width: '100%', height: 160, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(242,202,80,0.3)' }}
                          resizeMode="cover"
                        />
                        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, textAlign: 'center', marginTop: 4 }}>
                          Нажмите для увеличения
                        </Text>
                      </TouchableOpacity>
                    )}

                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 1.5, marginBottom: 10 }}>ЗОНЫ</Text>
                    {[
                      { label: 'Шейка', value: vitaResult.zones?.cervical ?? vitaResult.zone_cervical ?? '—' },
                      { label: 'Тело', value: vitaResult.zones?.body ?? vitaResult.zone_middle ?? '—' },
                      { label: 'Режущий край', value: vitaResult.zones?.incisal ?? vitaResult.zone_incisal ?? '—' },
                    ].map(zone => (
                      <View key={zone.label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, flex: 1 }}>{zone.label}</Text>
                        <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600', flex: 2, textAlign: 'right' }}>{zone.value}</Text>
                      </View>
                    ))}

                    {vitaResult.description ? (
                      <View style={{ marginBottom: 12 }}>
                        {vitaResult.description.split('. ').filter((s: string) => s.trim().length > 0).map((sentence: string, index: number) => (
                          <View key={index} style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 10, marginBottom: 6, borderLeftWidth: 2, borderLeftColor: 'rgba(242,202,80,0.4)' }}>
                            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18, fontStyle: 'italic' }}>
                              {sentence.trim().endsWith('.') ? sentence.trim() : sentence.trim() + '.'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    <TouchableOpacity onPress={() => { setVitaResult(null); router.push('/color-analyzer'); }} style={{ alignItems: 'center', paddingVertical: 8 }}>
                      <Text style={{ color: 'rgba(242,202,80,0.5)', fontSize: 13 }}>Переопределить цвет →</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await AsyncStorage.setItem('tempBlockDetails', JSON.stringify(blockDetails));
                    await AsyncStorage.setItem('tempConnections', JSON.stringify(connections));
                    router.push('/color-analyzer');
                  } catch (error) {
                    console.error('Error saving states:', error);
                    router.push('/color-analyzer');
                  }
                }}
                style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>🦷 Определить цвет VITA</Text>
                <Ionicons name="chevron-forward" size={20} color="#f2ca50" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Примечание */}
        <View style={styles.section}>
          <View style={styles.cardContainer}>
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
        </View>

        
        {/* Сводка заказа */}
        <View style={styles.section}>
          <View style={styles.cardContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.sectionTitle}>📋 СВОДКА ЗАКАЗА</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Пациент:</Text>
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>{patientName || 'Не указан'}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Врач:</Text>
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>{selectedDoctor?.name || 'Не выбран'}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Техник:</Text>
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>{selectedTechnician?.name || 'Не выбран'}</Text>
            </View>
            {selectedTeeth.length > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Зубы:</Text>
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>{selectedTeeth.map(t => t.number).join(', ')}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Снятие слепков:</Text>
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>{dates.impressions.toLocaleDateString('ru-RU')}</Text>
            </View>
            {dates.fitting && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Примерка:</Text>
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>{dates.fitting.toLocaleDateString('ru-RU')}</Text>
              </View>
            )}
            {dates.delivery && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Сдача:</Text>
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>{dates.delivery.toLocaleDateString('ru-RU')}</Text>
              </View>
            )}
            </View>
          </View>

        {/* Кнопки */}
        <View style={{ paddingTop: 8, paddingBottom: 32, gap: 8 }}>
          <TouchableOpacity
            style={{ backgroundColor: '#f2ca50', borderRadius: 25, padding: 16, alignItems: 'center' }}
            onPress={handleSubmit}
          >
            <Text style={{ color: '#031427', fontSize: 16, fontWeight: '700' }}>Отправить наряд</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,68,68,0.3)', borderRadius: 25, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            onPress={() => setShowClearModal(true)}
          >
            <Ionicons name="trash-outline" size={16} color="#ff4444" />
            <Text style={{ color: '#ff4444', fontSize: 15, fontWeight: '500' }}>Очистить наряд</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Календарь */}
      {showDatePicker && (
        <DateTimePicker
          value={dates[showDatePicker as keyof typeof dates] || new Date()}
          mode="date"
          display="calendar"
          onChange={(event, date) => {
            setShowDatePicker(null);
            if (date) {
              if (showDatePicker === 'impressions') setDates(prev => ({ ...prev, impressions: date }));
              else if (showDatePicker === 'fitting') setDates(prev => ({ ...prev, fitting: date }));
              else if (showDatePicker === 'delivery') setDates(prev => ({ ...prev, delivery: date }));
            }
          }}
        />
      )}

      {/* Модалка фото */}
      <Modal visible={showPhotoModal} transparent={true} animationType="fade" onRequestClose={() => setShowPhotoModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }} onPress={() => setShowPhotoModal(false)}>
            <Text style={{ color: 'white', fontSize: 28 }}>✕</Text>
          </TouchableOpacity>
          {activePhoto && (
            <Image source={{ uri: activePhoto }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* Модалка очистки */}
      <Modal visible={showClearModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 }}>
          <View style={{ backgroundColor: '#031427', borderRadius: 20, padding: 24, width: '100%', borderWidth: 1, borderColor: 'rgba(255,80,80,0.3)' }}>
            <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>🗑</Text>
            <Text style={{ color: '#ff4444', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>Очистить наряд?</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              Все данные будут удалены без возможности восстановления
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(242,202,80,0.3)', alignItems: 'center' }}
                onPress={() => setShowClearModal(false)}
              >
                <Text style={{ color: '#f2ca50', fontSize: 15, fontWeight: '500' }}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255,50,50,0.15)', borderWidth: 1, borderColor: '#ff4444', alignItems: 'center' }}
                onPress={async () => {
                  setShowClearModal(false);
                  setSelectedDoctor(null);
                  setPatientName('');
                  setSelectedTechnician(null);
                  setDates({ impressions: new Date(), fitting: null, delivery: null });
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
                  setConnections([]);
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
                <Text style={{ color: '#ff4444', fontSize: 15, fontWeight: '600' }}>Очистить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модалка импланта */}
      <Modal visible={showImplantModal} transparent animationType="slide" onRequestClose={() => setShowImplantModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#031427', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderWidth: 1, borderColor: 'rgba(242,202,80,0.2)' }}>
            <Text style={{ color: '#f2ca50', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 }}>
              Зуб {selectedToothForImplant}
            </Text>

            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 1, marginBottom: 10 }}>ТИП</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {(['crown', 'implant'] as const).map(type => (
                <TouchableOpacity
                  key={type}
                  style={{
                    flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center',
                    borderColor: toothTypes[selectedToothForImplant!] === type ? '#f2ca50' : 'rgba(255,255,255,0.15)',
                    backgroundColor: toothTypes[selectedToothForImplant!] === type ? 'rgba(242,202,80,0.15)' : 'transparent',
                  }}
                  onPress={() => {
                    setToothTypes(prev => ({ ...prev, [selectedToothForImplant!]: type }));
                    if (type === 'crown') setImplantData(prev => ({ ...prev, [selectedToothForImplant!]: { system: null, diameter: null } }));
                  }}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>{type === 'crown' ? '👑' : '🔩'}</Text>
                  <Text style={{ color: toothTypes[selectedToothForImplant!] === type ? '#f2ca50' : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '500' }}>
                    {type === 'crown' ? 'Коронка' : 'Имплант'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {toothTypes[selectedToothForImplant!] === 'implant' && (
              <>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 1, marginBottom: 10 }}>СИСТЕМА</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                  {(Object.keys(IMPLANT_SYSTEMS) as Array<keyof typeof IMPLANT_SYSTEMS>).map(system => (
                    <TouchableOpacity
                      key={system}
                      style={{
                        flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center',
                        borderColor: implantData[selectedToothForImplant!]?.system === system ? '#f2ca50' : 'rgba(255,255,255,0.15)',
                        backgroundColor: implantData[selectedToothForImplant!]?.system === system ? 'rgba(242,202,80,0.15)' : 'transparent',
                      }}
                      onPress={() => setImplantData(prev => ({ ...prev, [selectedToothForImplant!]: { system, diameter: null } }))}
                    >
                      <Text style={{ color: implantData[selectedToothForImplant!]?.system === system ? '#f2ca50' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', textAlign: 'center' }}>
                        {system}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {implantData[selectedToothForImplant!]?.system && (
                  <>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 1, marginBottom: 10 }}>ДИАМЕТР (мм)</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                      {IMPLANT_SYSTEMS[implantData[selectedToothForImplant!]!.system!].map(d => (
                        <TouchableOpacity
                          key={d}
                          style={{
                            paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1,
                            borderColor: implantData[selectedToothForImplant!]?.diameter === d ? '#f2ca50' : 'rgba(255,255,255,0.15)',
                            backgroundColor: implantData[selectedToothForImplant!]?.diameter === d ? 'rgba(242,202,80,0.15)' : 'transparent',
                          }}
                          onPress={() => setImplantData(prev => ({ ...prev, [selectedToothForImplant!]: { ...prev[selectedToothForImplant!], diameter: d } }))}
                        >
                          <Text style={{ color: implantData[selectedToothForImplant!]?.diameter === d ? '#f2ca50' : 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' }}>
                            ∅{d}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}

            <TouchableOpacity
              style={{ backgroundColor: '#f2ca50', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
              onPress={() => { setShowImplantModal(false); setSelectedToothForImplant(null); }}
            >
              <Text style={{ color: '#031427', fontSize: 16, fontWeight: '700' }}>Готово</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модалка врача */}
      <Modal visible={showDoctorModal} transparent animationType="slide" onRequestClose={() => setShowDoctorModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#031427', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderWidth: 1, borderColor: 'rgba(242,202,80,0.2)', maxHeight: '70%' }}>
            <Text style={{ color: '#f2ca50', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 }}>Выберите врача</Text>
            <ScrollView style={{ marginBottom: 20 }}>
              {doctors.map(doctor => (
                <TouchableOpacity
                  key={doctor.id}
                  onPress={() => { setSelectedDoctor(doctor); setShowDoctorModal(false); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 8,
                    backgroundColor: selectedDoctor?.id === doctor.id ? 'rgba(242,202,80,0.15)' : 'rgba(255,255,255,0.04)',
                    borderWidth: 1, borderColor: selectedDoctor?.id === doctor.id ? '#f2ca50' : 'rgba(255,255,255,0.08)',
                  }}
                >
                  <Text style={{ color: selectedDoctor?.id === doctor.id ? '#f2ca50' : 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: selectedDoctor?.id === doctor.id ? '600' : '400', flex: 1 }}>
                    {doctor.name}
                  </Text>
                  {selectedDoctor?.id === doctor.id && <Ionicons name="checkmark-circle" size={20} color="#f2ca50" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowDoctorModal(false)} style={{ padding: 16, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модалка техника */}
      <Modal visible={showTechnicianModal} transparent animationType="slide" onRequestClose={() => setShowTechnicianModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#031427', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderWidth: 1, borderColor: 'rgba(242,202,80,0.2)', maxHeight: '70%' }}>
            <Text style={{ color: '#f2ca50', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 }}>Выберите техника</Text>
            <ScrollView style={{ marginBottom: 20 }}>
              {technicians.map(technician => (
                <TouchableOpacity
                  key={technician.id}
                  onPress={() => { setSelectedTechnician(technician); setShowTechnicianModal(false); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 8,
                    backgroundColor: selectedTechnician?.id === technician.id ? 'rgba(242,202,80,0.15)' : 'rgba(255,255,255,0.04)',
                    borderWidth: 1, borderColor: selectedTechnician?.id === technician.id ? '#f2ca50' : 'rgba(255,255,255,0.08)',
                  }}
                >
                  <Text style={{ color: selectedTechnician?.id === technician.id ? '#f2ca50' : 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: selectedTechnician?.id === technician.id ? '600' : '400', flex: 1 }}>
                    {technician.name}
                  </Text>
                  {selectedTechnician?.id === technician.id && <Ionicons name="checkmark-circle" size={20} color="#f2ca50" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowTechnicianModal(false)} style={{ padding: 16, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f2ca50',
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
  headerIconBtn: {
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#E2BD75',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#031427',
  },
  notificationBadgeText: {
    color: '#031427',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 4,
  },
  localHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  localTitle: {
    color: '#f2ca50',
    fontSize: 18,
    fontWeight: 'bold',
  },
  section: { marginBottom: 20 },
  cardContainer: { backgroundColor: 'rgba(7, 15, 28, 0.93)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(242, 202, 80, 0.1)' },
  sectionTitle: { color: '#f2ca50', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  input: { backgroundColor: '#0a1628ee', borderWidth: 1, borderColor: 'rgba(242,202,80,0.15)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#ffffff', fontSize: 16 },
  dateBtn: { width: 40, height: 40, backgroundColor: 'rgba(242,202,80,0.1)', borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(242,202,80,0.3)' },
  dateValue: { color: '#ffffff', fontSize: 18, fontWeight: '600', minWidth: 50, textAlign: 'center' },
  submitBtn: { backgroundColor: '#f2ca50', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginHorizontal: 16, marginBottom: 20 },
  submitBtnText: { color: '#031427', fontSize: 16, fontWeight: 'bold' },
  extendedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, backgroundColor: '#0a1628ee', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(242,202,80,0.15)', marginBottom: 16 },
  extendedContent: { paddingHorizontal: 16 },
  subTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 1.5, marginBottom: 12 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  optionBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'transparent' },
  optionBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '500' },
  optionBtnSelected: { borderColor: '#f2ca50', backgroundColor: 'rgba(242,202,80,0.15)' },
  optionBtnTextSelected: { color: '#f2ca50' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#031427', borderRadius: 20, padding: 24, width: '90%', maxWidth: 400, borderWidth: 1, borderColor: 'rgba(242,202,80,0.2)' },
  modalTitle: { color: '#f2ca50', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  modalBtn: { backgroundColor: '#f2ca50', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, alignItems: 'center' },
  modalBtnText: { color: '#031427', fontSize: 16, fontWeight: 'bold' },
  bg: { flex: 1 },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dateInput: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0a1628ee', borderWidth: 1, borderColor: 'rgba(242,202,80,0.15)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginRight: 8 },
  dateText: { color: '#ffffff', fontSize: 16 },
  sectionLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  toothButton: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginHorizontal: 1 },
  toothSelected: { backgroundColor: 'rgba(242,202,80,0.2)', borderColor: '#f2ca50' },
  toothPontic: { borderStyle: 'dashed', backgroundColor: 'rgba(255,255,255,0.05)' },
  toothText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  textArea: { height: 80, textAlignVertical: 'top' },
});