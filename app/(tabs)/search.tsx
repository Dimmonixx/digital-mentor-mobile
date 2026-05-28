import { database } from '@/constants/firebase';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { onValue, ref } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ImageBackground,
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
  workType: string;
  status: 'new' | 'in_progress' | 'ready' | 'delivered';
  createdAt: number;
  deliveryDate: string;
  selectedTeeth: any[];
  vitaResult?: any;
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
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
    // Фильтр по роли
    if (user?.role === 'doctor') {
      // Врач видит только свои наряды
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

  const getToothNumbers = (teeth: any[]) => {
    if (!teeth || teeth.length === 0) return null;
    return teeth.map(t => typeof t === 'object' ? t.number : t).join(', ');
  };

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 16,
        paddingBottom: 12,
      }}>
        <Text style={{
          color: '#f2ca50',
          fontSize: 22,
          fontWeight: 'bold',
          marginBottom: 12,
        }}>
          Наряды
        </Text>

        {/* Фильтры */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 4 }}
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
                backgroundColor: '#0a1628ee',
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: 'rgba(242,202,80,0.15)',
              }}
            >
              {/* Строка 1: Пациент и статус */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}>
                <Text style={{
                  color: '#ffffff',
                  fontSize: 16,
                  fontWeight: '600',
                  flex: 1,
                }}>
                  {order.patientName || 'Без имени'}
                </Text>
                <View style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 20,
                  backgroundColor: getStatusColor(order.status) + '20',
                  borderWidth: 1,
                  borderColor: getStatusColor(order.status),
                  marginLeft: 8,
                }}>
                  <Text style={{
                    color: getStatusColor(order.status),
                    fontSize: 11,
                    fontWeight: '600',
                  }}>
                    {getStatusLabel(order.status)}
                  </Text>
                </View>
              </View>

              {/* Строка 2: Врач */}
              <Text style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: 13,
                marginBottom: 8,
              }}>
                Врач: {formatDoctorName(order.doctorName)}
              </Text>

              {/* Строка 3: Вид работы | Зубы | Цвет */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: 10,
                gap: 8,
              }}>
                {getWorkTypeLabel(order.workType) && (
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                    {getWorkTypeLabel(order.workType)}
                  </Text>
                )}
                {getToothNumbers(order.selectedTeeth) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="medical-outline" size={14} color="rgba(255,255,255,0.4)" style={{ marginRight: 6 }} />
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginRight: 4 }}>Зубы:</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500' }}>
                      {getToothNumbers(order.selectedTeeth)}
                    </Text>
                  </View>
                )}
                {order.vitaResult && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginRight: 4 }}>Цвет:</Text>
                    <Text style={{ color: '#f2ca50', fontSize: 13, fontWeight: '600' }}>
                      {order.vitaResult.primary_range ?? order.vitaResult.shade ?? ''}
                    </Text>
                  </View>
                )}
              </View>

              {/* Строка 4: Дата и техник */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.06)',
              }}>
                <Text style={{ 
                  color: 'rgba(255,255,255,0.3)', 
                  fontSize: 11 
                }}>
                  {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                </Text>
                <Text style={{ 
                  color: 'rgba(255,255,255,0.3)', 
                  fontSize: 11 
                }}>
                  Техник: {order.techName || (user?.role === 'technician' ? user.name : '—')}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </ImageBackground>
  );
}
