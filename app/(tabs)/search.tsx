import { database } from '@/constants/firebase';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { onValue, ref } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ImageBackground,
    SafeAreaView,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Order {
  id: string;
  doctorName: string;
  patientName: string;
  techName: string;
  technicianName?: string;
  techId?: string;
  technicianId?: string;
  workType: string;
  status: 'new' | 'in_progress' | 'ready' | 'delivered' | 'Новый' | 'New';
  createdAt: number;
  deliveryDate: string;
  selectedTeeth: any[];
  vitaResult?: any;
  blockDetails?: any;
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { filter: filterParam } = useLocalSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'new' | 'in_progress' | 'ready'>('all');
  const [shouldShowNewOrders, setShouldShowNewOrders] = useState(false);

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

  // Фильтрация по роли и статусу
  const filteredOrders = orders.filter(order => {
    if (!user) return false;

    const currentUserId = user.uid || user.id; // Берем любой доступный ID

    if (user.role === 'technician') {
      // Проверяем, что наряд назначен именно этому технику
      const isMyOrder = order.techId === currentUserId || order.technicianId === currentUserId;

      // Если передан фильтр "new" из URL, дополнительно проверяем статус
      if (filterParam === 'new') {
        return isMyOrder && (order.status === 'new' || order.status === 'Новый' || order.status === 'New');
      }

      // Если выбран таб "Новые" в интерфейсе
      if (filter === 'new') {
        return isMyOrder && (order.status === 'new' || order.status === 'Новый' || order.status === 'New');
      }

      // Для таба "Все" - показываем все наряды техника без фильтрации по статусу
      return isMyOrder;
    }

    // Для врача: показывает только его заказы
    if (user.role === 'doctor') {
      if (order.doctorName !== user.name &&
          !order.doctorName?.includes(user.name)) {
        // Если имя не совпадает — показываем все
        // (пока нет привязки по userId)
      }
    }
    // Фильтр по статусу
    if (filter === 'all') return true;
    return order.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return '#29b6f6';
      case 'in_progress': return '#f2ca50';
      case 'ready': return '#4caf50';
      case 'delivered': return 'rgba(255,255,255,0.3)';
      default: return '#f2ca50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return 'Новый';
      case 'in_progress': return 'В работе';
      case 'ready': return 'Готово';
      case 'delivered': return 'Выдан';
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

          {/* Правая часть: Минималистичная круглая кнопка "Новый наряд" */}
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
      </SafeAreaView>

      {/* Фильтры */}
      <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { key: 'all', label: 'Все' },
              { key: 'new', label: 'Новые' },
              { key: 'in_progress', label: 'В работе' },
              { key: 'ready', label: 'Готовые' },
            ].map(f => (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key as any)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: filter === f.key
                    ? '#f2ca50'
                    : 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                  borderColor: filter === f.key
                    ? '#f2ca50'
                    : 'rgba(255,255,255,0.15)',
                }}
              >
                <Text style={{
                  color: filter === f.key ? '#031427' : 'rgba(255,255,255,0.6)',
                  fontSize: 13,
                  fontWeight: filter === f.key ? '600' : '400',
                }}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
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
          <View style={{ 
            alignItems: 'center', 
            paddingTop: 60 
          }}>
            <ActivityIndicator size="large" color="#f2ca50" />
            <Text style={{ 
              color: 'rgba(255,255,255,0.4)', 
              marginTop: 12 
            }}>
              Загрузка нарядов...
            </Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View style={{ 
            alignItems: 'center', 
            paddingTop: 60 
          }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📋</Text>
            <Text style={{ 
              color: 'rgba(255,255,255,0.4)',
              fontSize: 16,
              textAlign: 'center',
            }}>
              Нарядов пока нет
            </Text>
          </View>
        ) : (
          filteredOrders.map(order => (
            <TouchableOpacity
              key={order.id}
              onPress={() => router.push({
                pathname: '/order-details',
                params: { orderId: order.id }
              })}
              style={{
                backgroundColor: '#0d1520',
                borderRadius: 14,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: 'rgba(242, 202, 80, 0.08)',
              }}
            >
              {/* Верхняя строка: Пациент + Статус */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: 'bold' }}>
                  {order.patientName || "Без фамилии"}
                </Text>
                <View style={{ backgroundColor: getStatusColor(order.status) + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                  <Text style={{ color: getStatusColor(order.status), fontSize: 12, fontWeight: '600' }}>
                    {getStatusLabel(order.status)}
                  </Text>
                </View>
              </View>

              {/* Блок людей: Врач и Техник плотно друг под друга */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 3 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Врач: </Text>{formatName(order.doctorName)}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Техник: </Text>{formatName(order.techName || order.technicianName || 'Не назначен')}
                </Text>
              </View>

              {/* Блок Конструкция + Цвет VITA */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 }}>
                  <Text style={{ color: '#f2ca50', fontWeight: 'normal' }}>Конструкция: </Text>
                  {getTeethSummary(order)}
                </Text>

                {order.vitaResult && (
                  <View style={{ backgroundColor: 'rgba(242, 202, 80, 0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                    <Text style={{ color: '#f2ca50', fontSize: 12, fontWeight: 'bold' }}>
                      {order.vitaResult.primary_range ?? order.vitaResult.shade ?? ''}
                    </Text>
                  </View>
                )}
              </View>

              {/* Нижняя подложка дат (Вертикальный столбик с левым выравниванием) */}
              <View
                style={{
                  flexDirection: 'column',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.02)',
                  gap: 6
                }}
              >
                <Text style={{ color: '#888888', fontSize: 12, textAlign: 'left' }}>
                  <Text style={{ color: '#f2ca50' }}>Оттиски: </Text>
                  {formatDateCustom(order.createdAt)}
                </Text>

                <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600', textAlign: 'left' }}>
                  <Text style={{ color: '#f2ca50', fontWeight: 'normal' }}>Сдача: </Text>
                  {formatDateCustom(order.deliveryDate || null)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </ImageBackground>
  );
}
