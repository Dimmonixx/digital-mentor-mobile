import { database } from '@/constants/firebase';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { onValue, ref, remove } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ImageBackground,
    Modal,
    SafeAreaView,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAYS_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

interface DateRange { start: Date | null; end: Date | null; }

const DateRangePicker = ({ visible, onClose, onSelect }: {
  visible: boolean;
  onClose: () => void;
  onSelect: (range: DateRange) => void;
}) => {
  const today = new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [pickingStart, setPickingStart] = useState(true);

  const firstDow = new Date(calYear, calMonth, 1).getDay();
  const offset = firstDow === 0 ? 6 : firstDow - 1;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const isSel = (day: number) => {
    const d = new Date(calYear, calMonth, day);
    if (start && d.toDateString() === start.toDateString()) return 'start';
    if (end && d.toDateString() === end.toDateString()) return 'end';
    if (start && end && d > start && d < end) return 'range';
    return null;
  };

  const onPressDay = (day: number) => {
    const sel = new Date(calYear, calMonth, day);
    if (pickingStart) { setStart(sel); setEnd(null); setPickingStart(false); }
    else {
      const finalEnd = start && sel < start ? start : sel;
      const finalStart = start && sel < start ? sel : start;
      setEnd(finalEnd);
      onSelect({ start: finalStart, end: finalEnd });
      setPickingStart(true);
    }
  };

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.85)', justifyContent:'center', alignItems:'center', padding:24 }}>
        <View style={{ backgroundColor:'#031427', borderRadius:20, padding:20, borderWidth:1, borderColor:'rgba(242,202,80,0.2)', width:'100%', maxWidth:340 }}>
          <Text style={{ color:'#f2ca50', fontSize:16, fontWeight:'bold', textAlign:'center', marginBottom:4 }}>Выбор периода</Text>
          <Text style={{ color:'rgba(255,255,255,0.35)', fontSize:12, textAlign:'center', marginBottom:16 }}>
            {pickingStart ? 'Укажите начало' : `От ${start?.toLocaleDateString('ru')} — укажите конец`}
          </Text>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <TouchableOpacity onPress={prevMonth}><Ionicons name="chevron-back" size={20} color="#f2ca50" /></TouchableOpacity>
            <Text style={{ color:'#fff', fontWeight:'600' }}>{MONTHS_RU[calMonth]} {calYear}</Text>
            <TouchableOpacity onPress={nextMonth}><Ionicons name="chevron-forward" size={20} color="#f2ca50" /></TouchableOpacity>
          </View>
          <View style={{ flexDirection:'row', marginBottom:6 }}>
            {DAYS_SHORT.map(d => <Text key={d} style={{ flex:1, textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:11 }}>{d}</Text>)}
          </View>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <View key={row} style={{ flexDirection:'row', marginBottom:3 }}>
              {cells.slice(row*7, row*7+7).map((day, col) => {
                const s = day ? isSel(day) : null;
                return (
                  <TouchableOpacity key={col} disabled={!day} onPress={() => day && onPressDay(day)}
                    style={{ flex:1, height:32, alignItems:'center', justifyContent:'center', borderRadius:16,
                      backgroundColor: s === 'start' || s === 'end' ? '#f2ca50' : s === 'range' ? 'rgba(242,202,80,0.15)' : 'transparent' }}>
                    {day ? <Text style={{ color: s === 'start' || s === 'end' ? '#031427' : 'rgba(255,255,255,0.8)', fontSize:13, fontWeight: s ? '700':'400' }}>{day}</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          <TouchableOpacity onPress={onClose} style={{ marginTop:14, padding:10, borderRadius:10, backgroundColor:'rgba(255,255,255,0.07)' }}>
            <Text style={{ color:'rgba(255,255,255,0.45)', textAlign:'center', fontSize:13 }}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

type TimeFilter = 'all' | 'this_week' | 'next_week' | 'month' | 'custom';
type ListItem =
  | { type: 'week_header'; label: string; key: string }
  | { type: 'day_header'; label: string; key: string }
  | { type: 'order_card'; order: Order; key: string };

interface Order {
  id: string;
  doctorName: string;
  patientName: string;
  techName: string;
  technicianName?: string;
  techId?: string;
  technicianId?: string;
  workType: string;
  status: 'new' | 'in_progress' | 'ready' | 'Новый' | 'New';
  createdAt: number;
  deliveryDate: string;
  selectedTeeth: any[];
  vitaResult?: any;
  blockDetails?: any;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}`;
const DAYS_RU = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];

const getMonday = (d: Date) => {
  const r = new Date(d); r.setHours(0,0,0,0);
  const day = r.getDay(); r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  return r;
};
const getSunday = (mon: Date) => { const r = new Date(mon); r.setDate(r.getDate()+6); r.setHours(23,59,59,999); return r; };
const parseDelivery = (o: Order): Date | null => { if (!o.deliveryDate) return null; const d = new Date(o.deliveryDate); return isNaN(d.getTime()) ? null : d; };

const groupOrders = (orders: Order[]): ListItem[] => {
  const sorted = [...orders].sort((a,b) => (parseDelivery(a)?.getTime()??0) - (parseDelivery(b)?.getTime()??0));
  const items: ListItem[] = [];
  let lastWeek = ''; let lastDay = '';
  for (const order of sorted) {
    const d = parseDelivery(order);
    if (!d) {
      if (lastWeek !== '__no') { items.push({ type:'week_header', label:'Дата не указана', key:'wk_no' }); lastWeek='__no'; }
      items.push({ type:'order_card', order, key:order.id }); continue;
    }
    const mon = getMonday(d); const sun = getSunday(mon);
    const wk = `wk_${mon.getTime()}`;
    const dk = `dk_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`;
    if (lastWeek !== wk) {
      items.push({ type:'week_header', label:`${fmt(mon)} – ${fmt(sun)}`, key:wk });
      lastWeek = wk; lastDay = '';
    }
    if (lastDay !== dk) {
      items.push({ type:'day_header', label:`${DAYS_RU[d.getDay()]}, ${fmt(d)}`, key:dk });
      lastDay = dk;
    }
    items.push({ type:'order_card', order, key:order.id });
  }
  return items;
};

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { filter: filterParam } = useLocalSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'new' | 'in_progress' | 'ready'>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [shouldShowNewOrders, setShouldShowNewOrders] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const deleteAllMyOrders = async () => {
    if (!user) return;
    const myOrders = orders.filter(order => {
      if (user.role === 'doctor') return order.doctorName === user.name;
      if (user.role === 'technician') return order.techName === user.name || order.technicianName === user.name;
      return false;
    });
    for (const order of myOrders) {
      await remove(ref(database, `orders/${order.id}`));
    }
    setShowDeleteAllConfirm(false);
  };

  // Проверяем флаг для показа новых нарядов
  useEffect(() => {
    if (shouldShowNewOrders && !loading) {
      setFilter('new');
      setShouldShowNewOrders(false);
    }
  }, [shouldShowNewOrders, loading]);

  // Регистрация функции для переключения на новые наряды
  useEffect(() => {
    // Экспортируем функцию для вызова из _layout.tsx
    (window as any).showNewOrders = () => {
      setShouldShowNewOrders(true);
    };

    return () => {
      delete (window as any).showNewOrders;
    };
  }, []);

  // Загрузка пользователя
  useEffect(() => {
    AsyncStorage.getItem('user').then(data => {
      if (data) setUser(JSON.parse(data));
    });
  }, []);

  // Real-time listener на наряды (только для отображения)
  useEffect(() => {
    const ordersRef = ref(database, 'orders');
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const ordersList = Object.entries(data).map(([id, order]: any) => ({
          id,
          ...order,
        }));
        // Сортировка по дате создания (новые первые)
        ordersList.sort((a, b) => b.createdAt - a.createdAt);
        setOrders(ordersList);
      } else {
        setOrders([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const applyTimeFilter = (order: Order): boolean => {
    const d = parseDelivery(order);
    if (!d) return false;
    if (timeFilter === 'all') return true;
    const now = new Date();
    if (timeFilter === 'this_week') {
      const mon = getMonday(now); return d >= mon && d <= getSunday(mon);
    }
    if (timeFilter === 'next_week') {
      const nmon = new Date(getMonday(now)); nmon.setDate(nmon.getDate()+7);
      return d >= nmon && d <= getSunday(nmon);
    }
    if (timeFilter === 'month') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59);
      return d >= s && d <= e;
    }
    if (timeFilter === 'custom' && dateRange.start && dateRange.end) {
      const s = new Date(dateRange.start); s.setHours(0,0,0,0);
      const e = new Date(dateRange.end); e.setHours(23,59,59,999);
      return d >= s && d <= e;
    }
    return true;
  };

  const filteredOrders = orders.filter(order => {
    if (!user) return false;
    const uid = user.uid || user.id;
    const isNew = order.status === 'new' || order.status === 'Новый' || order.status === 'New';
    if (user.role === 'technician') {
      const mine = order.techId === uid || order.technicianId === uid;
      if (!mine) return false;
      if (filterParam === 'new' || filter === 'new') return isNew && applyTimeFilter(order);
      if (filter !== 'all') return order.status === filter && applyTimeFilter(order);
      return applyTimeFilter(order);
    }
    if (filter !== 'all' && order.status !== filter) return false;
    return applyTimeFilter(order);
  });

  const grouped = groupOrders(filteredOrders);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return '#29b6f6';
      case 'in_progress': return '#f2ca50';
      case 'ready': return '#4caf50';
      default: return '#f2ca50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return 'Новый';
      case 'in_progress': return 'В работе';
      case 'ready': return 'Готово';
      default: return status;
    }
  };

  const getWorkTypeLabel = (workType: string) => {
    const types: Record<string, string> = {
      'metal': 'Металл',
      'inlay': 'Вкладка',
      'metalceramic': 'Металлокерамика',
      'zirconia': 'Диоксид циркона',
      'emax': 'Дисиликат лития',
    };
    return types[workType] || workType;
  };

  const formatDoctorName = (fullName: string) => {
    if (!fullName) return '—';
    const parts = fullName.trim().split(' ');
    if (parts.length === 0) return '—';
    const lastName = parts[0];
    const initials = parts.slice(1).map(p => p[0] ? p[0].toUpperCase() : '').join('.');
    return initials ? `${lastName} ${initials}.` : lastName;
  };

  const formatName = (fullName: string) => {
    if (!fullName) return 'Не назначен';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} ${parts[1][0]}.`;
    return `${parts[0]} ${parts[1][0]}.${parts[2][0]}.`;
  };

  const formatDateCustom = (dateInput: any) => {
    if (!dateInput) return '—';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '—';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    const daysOfWeek = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const dayOfWeek = daysOfWeek[date.getDay()];

    return `${day}.${month}.${year} (${dayOfWeek}) ${hours}:${minutes}`;
  };

  const getToothNumbers = (teeth: any[]) => {
    if (!teeth || teeth.length === 0) return null;
    return teeth.map(t => typeof t === 'object' ? t.number : t).join(', ');
  };

  const getTeethSummary = (order: Order) => {
    if (!order?.blockDetails) return 'Зубы не выбраны';

    const materialCounts: Record<string, number> = {};

    // Проходим по всем блокам конструкций в наряде
    Object.entries(order.blockDetails).forEach(([key, block]: [string, any]) => {
      // Пропускаем служебные поля
      if (key === 'material' || key === 'workType') return;

      if (block && block.material) {
        // Ключ может быть как "12-13-14" (мост), так и отдельным номером зуба
        const teethCount = key.split('-').length;
        let mat = block.material.toLowerCase();
        let shortMaterial = block.material;

        // Зуботехнический маппинг сокращений
        if (mat.includes('циркон')) shortMaterial = 'циркония';
        else if (mat.includes('металлокерам')) shortMaterial = 'МК';
        else if (mat.includes('керам')) shortMaterial = 'керамики';
        else if (mat.includes('пластмасс') || mat.includes('пммк')) shortMaterial = 'пластмассы';
        else if (mat.includes('композит')) shortMaterial = 'композита';

        materialCounts[shortMaterial] = (materialCounts[shortMaterial] || 0) + teethCount;
      }
    });

    const pairs = Object.entries(materialCounts);
    if (pairs.length === 0) return 'Зубы не выбраны';

    // Собираем строку через разделитель '\' с использованием "ед."
    return pairs.map(([material, count]) => `${count} ед. ${material}`).join(' \\ ');
  };

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      {/* Полностью контролируемый кастомный Header */}
      <SafeAreaView style={{ backgroundColor: 'transparent' }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          marginTop: 20,
          marginBottom: 20
        }}>
          {/* Левая часть: Стрелка назад + Заголовок */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginRight: 14, paddingVertical: 4 }}
            >
              <Ionicons name="chevron-back" size={26} color="#f2ca50" />
            </TouchableOpacity>

            <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: 'bold' }}>
              Наряды
            </Text>
          </View>

          {/* Правая часть: Кнопки удалить все и новый наряд */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setShowDeleteAllConfirm(true)}
              style={{
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                width: 38,
                height: 38,
                borderRadius: 19,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(231, 76, 60, 0.3)'
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color="#e74c3c" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/new-order')}
              style={{
                backgroundColor: 'rgba(242, 202, 80, 0.1)',
                width: 38,
                height: 38,
                borderRadius: 19,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(242, 202, 80, 0.2)'
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={22} color="#f2ca50" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Фильтр по статусу */}
      <View style={{ paddingHorizontal: 16, marginBottom: 6 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([{ key:'all', label:'Все' },{ key:'new', label:'Новые' },{ key:'in_progress', label:'В работе' },{ key:'ready', label:'Готовые' }] as const).map(f => (
              <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)}
                style={{ paddingHorizontal:16, paddingVertical:8, borderRadius:20,
                  backgroundColor: filter===f.key ? '#f2ca50' : 'rgba(255,255,255,0.08)',
                  borderWidth:1, borderColor: filter===f.key ? '#f2ca50' : 'rgba(255,255,255,0.15)' }}>
                <Text style={{ color: filter===f.key ? '#031427' : 'rgba(255,255,255,0.6)', fontSize:13, fontWeight: filter===f.key ? '600':'400' }}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Фильтр по времени */}
      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {([{ key:'all' as TimeFilter, label:'Все' },{ key:'this_week' as TimeFilter, label:'Эта неделя' },{ key:'next_week' as TimeFilter, label:'След. неделя' },{ key:'month' as TimeFilter, label:'Месяц' }]).map(tf => (
              <TouchableOpacity key={tf.key} onPress={() => setTimeFilter(tf.key)}
                style={{ paddingHorizontal:12, paddingVertical:6, borderRadius:16,
                  backgroundColor: timeFilter===tf.key ? 'rgba(242,202,80,0.15)' : 'rgba(255,255,255,0.05)',
                  borderWidth:1, borderColor: timeFilter===tf.key ? 'rgba(242,202,80,0.45)' : 'rgba(255,255,255,0.08)' }}>
                <Text style={{ color: timeFilter===tf.key ? '#f2ca50' : 'rgba(255,255,255,0.4)', fontSize:12, fontWeight: timeFilter===tf.key ? '600':'400' }}>{tf.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => { setTimeFilter('custom'); setShowDatePicker(true); }}
              style={{ paddingHorizontal:12, paddingVertical:6, borderRadius:16, flexDirection:'row', alignItems:'center', gap:4,
                backgroundColor: timeFilter==='custom' ? 'rgba(242,202,80,0.15)' : 'rgba(255,255,255,0.05)',
                borderWidth:1, borderColor: timeFilter==='custom' ? 'rgba(242,202,80,0.45)' : 'rgba(255,255,255,0.08)' }}>
              <Ionicons name="calendar-outline" size={12} color={timeFilter==='custom' ? '#f2ca50' : 'rgba(255,255,255,0.4)'} />
              <Text style={{ color: timeFilter==='custom' ? '#f2ca50' : 'rgba(255,255,255,0.4)', fontSize:12, fontWeight: timeFilter==='custom' ? '600':'400' }}>
                {timeFilter==='custom' && dateRange.start && dateRange.end
                  ? `${fmt(dateRange.start)} – ${fmt(dateRange.end)}`
                  : 'Даты'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* Список */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ alignItems:'center', paddingTop:60 }}>
            <ActivityIndicator size="large" color="#f2ca50" />
            <Text style={{ color:'rgba(255,255,255,0.4)', marginTop:12 }}>Загрузка нарядов...</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View style={{ alignItems:'center', paddingTop:60 }}>
            <Text style={{ fontSize:48, marginBottom:16 }}>📋</Text>
            <Text style={{ color:'rgba(255,255,255,0.4)', fontSize:16, textAlign:'center' }}>Нарядов пока нет</Text>
          </View>
        ) : grouped.map(item => {
          if (item.type === 'week_header') return (
            <View key={item.key} style={{ flexDirection:'row', alignItems:'center', marginTop:20, marginBottom:6 }}>
              <View style={{ flex:1, height:1, backgroundColor:'rgba(242,202,80,0.12)' }} />
              <Text style={{ color:'rgba(242,202,80,0.5)', fontSize:10, fontWeight:'600', letterSpacing:1.2, marginHorizontal:10, textTransform:'uppercase' }}>
                НЕДЕЛЯ: {item.label}
              </Text>
              <View style={{ flex:1, height:1, backgroundColor:'rgba(242,202,80,0.12)' }} />
            </View>
          );
          if (item.type === 'day_header') return (
            <Text key={item.key} style={{ color:'rgba(255,255,255,0.3)', fontSize:12, marginTop:8, marginBottom:4, paddingLeft:2, letterSpacing:0.4 }}>
              {item.label}
            </Text>
          );
          const order = item.order;
          return (
            <TouchableOpacity key={item.key}
              onPress={() => router.push({ pathname:'/order-details', params:{ orderId:order.id } })}
              style={{ backgroundColor:'#0d1520', borderRadius:14, padding:16, marginBottom:10, borderWidth:1, borderColor:'rgba(242,202,80,0.08)' }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <Text style={{ color:'#fff', fontSize:18, fontWeight:'bold' }}>{order.patientName || 'Без фамилии'}</Text>
                <View style={{ backgroundColor:getStatusColor(order.status)+'20', paddingHorizontal:10, paddingVertical:4, borderRadius:20 }}>
                  <Text style={{ color:getStatusColor(order.status), fontSize:12, fontWeight:'600' }}>{getStatusLabel(order.status)}</Text>
                </View>
              </View>
              <View style={{ marginBottom:12 }}>
                <Text style={{ color:'rgba(255,255,255,0.5)', fontSize:13, marginBottom:3 }}>
                  <Text style={{ color:'rgba(255,255,255,0.7)' }}>Врач: </Text>{formatName(order.doctorName)}
                </Text>
                <Text style={{ color:'rgba(255,255,255,0.5)', fontSize:13 }}>
                  <Text style={{ color:'rgba(255,255,255,0.7)' }}>Техник: </Text>{formatName(order.techName || order.technicianName || 'Не назначен')}
                </Text>
              </View>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <Text style={{ color:'#fff', fontSize:14, fontWeight:'600', flex:1, marginRight:8 }}>
                  <Text style={{ color:'#f2ca50', fontWeight:'normal' }}>Конструкция: </Text>{getTeethSummary(order)}
                </Text>
                {order.vitaResult && (
                  <View style={{ backgroundColor:'rgba(242,202,80,0.1)', paddingHorizontal:8, paddingVertical:3, borderRadius:6 }}>
                    <Text style={{ color:'#f2ca50', fontSize:12, fontWeight:'bold' }}>{order.vitaResult.primary_range ?? order.vitaResult.shade ?? ''}</Text>
                  </View>
                )}
              </View>
              <View style={{ backgroundColor:'rgba(255,255,255,0.02)', paddingVertical:10, paddingHorizontal:12, borderRadius:8, borderWidth:1, borderColor:'rgba(255,255,255,0.02)', gap:6 }}>
                <Text style={{ color:'#888', fontSize:12 }}><Text style={{ color:'#f2ca50' }}>Оттиски: </Text>{formatDateCustom(order.createdAt)}</Text>
                <Text style={{ color:'#fff', fontSize:12, fontWeight:'600' }}><Text style={{ color:'#f2ca50', fontWeight:'normal' }}>Сдача: </Text>{formatDateCustom(order.deliveryDate || null)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <DateRangePicker
        visible={showDatePicker}
        onClose={() => { setShowDatePicker(false); if (!dateRange.start || !dateRange.end) setTimeFilter('all'); }}
        onSelect={(range) => { setDateRange(range); setShowDatePicker(false); }}
      />

      {/* Модал подтверждения удаления всех нарядов */}
      <Modal
        visible={showDeleteAllConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteAllConfirm(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.8)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}>
          <View style={{
            backgroundColor: '#031427',
            borderRadius: 20,
            padding: 24,
            borderWidth: 1,
            borderColor: 'rgba(242,202,80,0.2)',
            width: '100%',
            maxWidth: 320,
          }}>
            <Text style={{
              color: '#f2ca50',
              fontSize: 20,
              fontWeight: 'bold',
              textAlign: 'center',
              marginBottom: 12,
            }}>Удалить все наряды?</Text>
            <Text style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: 14,
              textAlign: 'center',
              marginBottom: 24,
            }}>Все ваши наряды будут безвозвратно удалены</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowDeleteAllConfirm(false)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                }}
              >
                <Text style={{ color: '#fff', textAlign: 'center', fontSize: 15 }}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={deleteAllMyOrders}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: '#e74c3c',
                }}
              >
                <Text style={{ color: '#fff', textAlign: 'center', fontSize: 15, fontWeight: '600' }}>Удалить все</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}
