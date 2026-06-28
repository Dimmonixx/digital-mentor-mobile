import { getFirebaseDB } from '@/constants/firebase';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { onValue, ref, remove, update } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ImageBackground,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STATUS_FLOW = [
  { key: 'new', label: 'Новый', color: '#29b6f6', icon: '🆕' },
  { key: 'in_progress', label: 'В работе', color: '#f2ca50', icon: '⚙️' },
  { key: 'ready', label: 'Готово', color: '#4caf50', icon: '✅' },
];

const formatDateCustom = (dateVal: any) => {
  if (!dateVal) return 'Не указана';
  try {
    const d = new Date(typeof dateVal === 'number' && dateVal < 1000000000000 ? dateVal * 1000 : dateVal);
    if (isNaN(d.getTime())) return String(dateVal);

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    const daysArr = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const dayOfWeek = daysArr[d.getDay()];

    return `${day}.${month}.${year} (${dayOfWeek}) ${hours}:${minutes}`;
  } catch (e) {
    return String(dateVal);
  }
};

export default function OrderDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isVitaExpanded, setIsVitaExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('user').then(data => {
      if (data) setUser(JSON.parse(data));
    });
  }, []);

  useEffect(() => {
    if (!orderId) return;
    const orderRef = ref(getFirebaseDB(), `orders/${orderId}`);
    const unsubscribe = onValue(orderRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const orderWithId = { id: orderId, ...data };
        setOrder(orderWithId);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [orderId]);

  // Слушатель для подсчёта новых нарядов
  useEffect(() => {
    const ordersRef = ref(getFirebaseDB(), 'orders');
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const ordersList = Object.entries(data).map(([id, order]: any) => ({
          id,
          ...order,
        }));
        const currentNewOrdersCount = ordersList.filter(order => order.status === 'new').length;
        setNewOrdersCount(currentNewOrdersCount);
      } else {
        setNewOrdersCount(0);
      }
    });
    return () => unsubscribe();
  }, []);

  const updateStatus = async (newStatus: string) => {
    await update(ref(getFirebaseDB(), `orders/${orderId}`), { 
      status: newStatus,
      updatedAt: Date.now(),
    });
    setShowStatusModal(false);
  };

  const deleteOrder = async () => {
    await remove(ref(getFirebaseDB(), `orders/${orderId}`));
    router.back();
  };

  const getStatusColor = (status: string) => {
    return STATUS_FLOW.find(s => s.key === status)?.color ?? '#f2ca50';
  };

  const getStatusLabel = (status: string) => {
    return STATUS_FLOW.find(s => s.key === status)?.label ?? status;
  };

  const getWorkTypeLabel = (workType: string) => {
    const types: Record<string, string> = {
      'metal': 'Металл',
      'inlay': 'Вкладка',
      'metalceramic': 'Металлокерамика',
      'zirconia': 'Диоксид циркония',
      'emax': 'Дисиликат лития',
    };
    return types[workType] || workType;
  };

  if (loading) {
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: '#031427',
        justifyContent: 'center', 
        alignItems: 'center' 
      }}>
        <ActivityIndicator size="large" color="#f2ca50" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: '#031427',
        justifyContent: 'center', 
        alignItems: 'center' 
      }}>
        <Text style={{ color: 'rgba(255,255,255,0.4)' }}>
          Наряд не найден
        </Text>
      </View>
    );
  }

  const statusColor = getStatusColor(order.status);
  const isTechnician = user?.role === 'technician';

  interface ToothGroup {
    teeth: string[];
    workType: string;
    material: string;
    implantInfo?: string;
    isImplant: boolean;
    isConnected?: boolean;
    separation?: string;
    fixationType?: string;
  }

  const toothGroups: ToothGroup[] = [];
  const sourceDetails = order?.blockDetails || order?.orderData?.blockDetails;
  const connections = order?.connections || order?.orderData?.connections || [];

  if (sourceDetails && typeof sourceDetails === 'object') {
    // Фильтруем только реальные ключи блоков/мостов (игнорируем служебные поля типа 'material' и 'workType')
    const blockKeys = Object.keys(sourceDetails).filter(key => key !== 'material' && key !== 'workType');

    blockKeys.forEach(blockKey => {
      const blockData = sourceDetails[blockKey];
      if (!blockData) return;

      // Превращаем строку "12-13-14" в массив индивидуальных зубов ['12', '13', '14']
      const individualTeeth = blockKey.split('-').map(t => t.trim());

      // Определяем вид работы и материал конкретного блока
      let currentWork = order?.workType || order?.orderData?.workType || "Протезирование";
      const currentMaterial = blockData.material || "Не указан";
      const isImplantActive = !!blockData.isImplant;
      const fixation = blockData.fixationType || "";

      // Собираем инфо по имплантам для ВСЕХ зубов, входящих в этот мост/блок
      let implantDetailsArray: string[] = [];

      if (isImplantActive) {
        currentWork = "Импланты";

        individualTeeth.forEach(tooth => {
          const system = blockData.implantSystems?.[tooth];
          const diameter = blockData.implantDiameters?.[tooth];

          if (system && diameter) {
            implantDetailsArray.push(`зуб ${tooth}: ${system} Ø ${diameter}`);
          } else if (system) {
            implantDetailsArray.push(`зуб ${tooth}: ${system}`);
          }
        });
      }

      // Если это промежуточная часть (pontic), а работы/систем нет, код это учтет
      const implantInfoString = implantDetailsArray.length > 0 ? implantDetailsArray.join(' | ') : undefined;

      // Проверяем, входит ли этот блок в соединенные конструкции через массив connections
      const hasConnection = Array.isArray(connections) && connections.some((conn: any) => {
        if (typeof conn === 'string') return conn.includes(blockKey);
        if (conn && typeof conn === 'object') return conn.blockId === blockKey || conn.id === blockKey;
        return false;
      });

      toothGroups.push({
        teeth: individualTeeth,
        workType: currentWork,
        material: currentMaterial,
        implantInfo: implantInfoString,
        isImplant: isImplantActive,
        isConnected: hasConnection,
        fixationType: fixation
      });
    });
  }

  // Резервный плоский вариант, если мостов в базе не найдено
  if (toothGroups.length === 0) {
    let fallbackTeeth: string[] = [];
    if (Array.isArray(order?.teeth)) fallbackTeeth = order.teeth.map(String);
    else if (order?.selectedTeeth) fallbackTeeth = Object.keys(order.selectedTeeth).filter(k => order.selectedTeeth[k] === true);

    toothGroups.push({
      teeth: fallbackTeeth.sort((a, b) => Number(a) - Number(b)),
      workType: order?.workType || "Протезирование",
      material: order?.material || "Не указан",
      isImplant: false
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#090f1d' }}>
      <ImageBackground
        source={require('@/assets/images/background.png')}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
      {/* DiLabs Branded Header */}
      <View style={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 12,
        paddingBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#f2ca50',
      }}>
        <TouchableOpacity style={{ padding: 4 }}>
          <Ionicons name="menu-outline" size={28} color="#f2ca50" />
        </TouchableOpacity>
        <Image
          source={require('@/assets/images/header-logo.png')}
          style={{ width: 120, height: 40 }}
          resizeMode="contain"
        />
        <TouchableOpacity 
          style={{ padding: 4 }}
          onPress={() => {
            router.push('/(tabs)/search');
            setTimeout(() => {
              (window as any).showNewOrders?.();
            }, 100);
          }}
        >
          <Ionicons name="notifications-outline" size={24} color="#f2ca50" />
          {newOrdersCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {newOrdersCount > 99 ? '99+' : newOrdersCount.toString()}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Local Navigation Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 18,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color="#f2ca50" />
        </TouchableOpacity>
        <Text style={{
          color: '#f2ca50',
          fontSize: 18,
          fontWeight: 'bold',
        }}>
          Наряд
        </Text>
        {/* Кнопка смены статуса — только для техника */}
        {isTechnician ? (
          <TouchableOpacity
            onPress={() => setShowStatusModal(true)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: statusColor + '20',
              borderWidth: 1,
              borderColor: statusColor,
            }}
          >
            <Text style={{
              color: statusColor,
              fontSize: 12,
              fontWeight: '600',
            }}>
              {getStatusLabel(order.status)}
            </Text>
          </TouchableOpacity>
        ) : user?.role === 'doctor' ? (
          <TouchableOpacity
            onPress={() => setShowDeleteConfirm(true)}
            style={{
              padding: 8,
              borderRadius: 20,
              backgroundColor: 'rgba(231,76,60,0.2)',
              borderWidth: 1,
              borderColor: '#e74c3c',
            }}
          >
            <Ionicons name="trash-outline" size={18} color="#e74c3c" />
          </TouchableOpacity>
        ) : (
          <View style={{
            width: 40,
          }} />
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ 
          paddingHorizontal: 16,
          paddingBottom: 40,
        }}
      >
        {/* Пациент */}
        <View style={{
          backgroundColor: '#0a1628ee',
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: 'rgba(242,202,80,0.15)',
        }}>
          <Text style={{
            color: '#f2ca50',
            fontSize: 14,
            fontWeight: '700',
            marginBottom: 12,
          }}>УЧАСТНИКИ</Text>

          <View style={{ marginBottom: 12 }}>
            <Text style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 14,
              marginBottom: 2,
              textAlign: 'left',
            }}>Пациент</Text>
            <Text style={{
              color: '#ffffff',
              fontSize: 16,
              fontWeight: '500',
              textAlign: 'left',
            }}>{order?.patientName || '—'}</Text>
          </View>

          <View style={{ marginBottom: 12 }}>
            <Text style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 14,
              marginBottom: 2,
              textAlign: 'left',
            }}>Врач</Text>
            <Text style={{
              color: '#ffffff',
              fontSize: 16,
              fontWeight: '500',
              textAlign: 'left',
            }}>{order?.doctorName || "Иванова Е.Ю."}</Text>
          </View>

          <View style={{ marginBottom: 4 }}>
            <Text style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 14,
              marginBottom: 2,
              textAlign: 'left',
            }}>Техник</Text>
            <Text style={{
              color: '#ffffff',
              fontSize: 16,
              fontWeight: '500',
              textAlign: 'left',
            }}>{order?.technicianName || order?.techName || "Не указан"}</Text>
          </View>

          {/* Кнопка перехода в личный чат с коллегой */}
          {user?.role && (user?.role === 'doctor' ? order?.technicianId : order?.doctorId) && (
            <TouchableOpacity
              onPress={() => {
                const isDoctor = user.role === 'doctor';
                const partnerId = isDoctor ? order.technicianId : order.doctorId;
                const partnerName = isDoctor ? (order.technicianName || order.techName || 'Коллега') : (order.doctorName || 'Коллега');
                const partnerRole = isDoctor ? 'technician' : 'doctor';
                router.push({
                  pathname: '/partner-chat',
                  params: { partnerId, partnerName, partnerRole },
                } as any);
              }}
              style={{
                marginTop: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(242,202,80,0.1)',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#f2ca50',
                paddingVertical: 12,
                gap: 8,
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubbles-outline" size={20} color="#f2ca50" />
              <Text style={{ color: '#f2ca50', fontSize: 15, fontWeight: '600' }}>
                Чат с коллегой
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Даты */}
        <View style={{
          backgroundColor: '#0a1628ee',
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: 'rgba(242,202,80,0.15)',
        }}>
          <Text style={{
            color: '#f2ca50',
            fontSize: 14,
            fontWeight: '700',
            marginBottom: 12,
          }}>ДАТЫ</Text>

          <View style={{ marginBottom: 12 }}>
            <Text style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 14,
              marginBottom: 2,
              textAlign: 'left',
            }}>Оттиски</Text>
            <Text style={{
              color: '#ffffff',
              fontSize: 16,
              fontWeight: '500',
              textAlign: 'left',
            }}>
              {formatDateCustom(order?.impressionDate || order?.createdAt || order?.dates?.impression)}
            </Text>
          </View>

          <View style={{ marginBottom: 12 }}>
            <Text style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 14,
              marginBottom: 2,
              textAlign: 'left',
            }}>Примерка</Text>
            <Text style={{
              color: '#ffffff',
              fontSize: 16,
              fontWeight: '500',
              textAlign: 'left',
            }}>
              {order?.withoutTryIn ? 'Без примерки' : (order?.tryInDate ? formatDateCustom(order.tryInDate) : 'Не назначена')}
            </Text>
          </View>

          <View style={{ marginBottom: 4 }}>
            <Text style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 14,
              marginBottom: 2,
              textAlign: 'left',
            }}>Сдача</Text>
            <Text style={{
              color: '#ffffff',
              fontSize: 16,
              fontWeight: '500',
              textAlign: 'left',
            }}>
              {formatDateCustom(order?.deliveryDate || order?.dueDate || order?.dates?.delivery)}
            </Text>
          </View>
        </View>

        {/* Работа */}
        <View style={{
          backgroundColor: '#0a1628ee',
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: 'rgba(242,202,80,0.15)',
        }}>
          <Text style={{
            color: '#f2ca50',
            fontSize: 14,
            fontWeight: '700',
            marginBottom: 12,
          }}>РАБОТА</Text>

          {toothGroups.map((group, index) => {
            const isBridge = group.teeth.length > 1;
            const isImplantWork = !!group.isImplant;

            // Маппинг типа фиксации с английского на русский
            let displayFixation = "";
            if (group.fixationType === 'screw') displayFixation = "Винтовая";
            else if (group.fixationType === 'cement') displayFixation = "Цементная";
            else if (group.fixationType) displayFixation = group.fixationType;

            return (
              <View
                key={index}
                style={{
                  marginBottom: index === toothGroups.length - 1 ? 0 : 20,
                  borderBottomWidth: index === toothGroups.length - 1 ? 0 : 1,
                  borderBottomColor: 'rgba(242, 202, 80, 0.15)',
                  paddingBottom: index === toothGroups.length - 1 ? 0 : 20
                }}
              >
                {/* Зубы / Мост со стабильными точками над стыками */}
                <View style={{ marginBottom: 14 }}>
                  <Text style={{
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 14,
                    marginBottom: 8,
                    textAlign: 'left',
                  }}>
                    {isBridge ? 'Мост:' : 'Зуб:'}
                  </Text>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingVertical: 4, flexDirection: 'column', alignItems: 'flex-start' }}
                  >
                    {/* ВЕРХНИЙ РЯД: Точки соединений */}
                    {isBridge && (
                      <View style={{ flexDirection: 'row', height: 10, alignItems: 'center', marginBottom: 4 }}>
                        {group.teeth.map((_, tIdx) => {
                          const isLast = tIdx === group.teeth.length - 1;
                          if (isLast) return null;

                          const isTogether = group.separation !== 'Раздельно' && order?.orderData?.separation !== 'Раздельно';

                          return (
                            <View
                              key={`dot-${tIdx}`}
                              style={{
                                width: 41,
                                alignItems: 'flex-end',
                                justifyContent: 'center',
                                marginRight: tIdx === 0 ? 1 : 0
                              }}
                            >
                              <View
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: 4,
                                  backgroundColor: isTogether ? '#f2ca50' : '#555',
                                  marginRight: -4
                                }}
                              />
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* НИЖНИЙ РЯД: Сомкнутые квадратики зубов */}
                    <View style={{ flexDirection: 'row' }}>
                      {group.teeth.map((tooth, tIdx) => (
                        <View
                          key={`tooth-${tIdx}`}
                          style={{
                            borderWidth: 1,
                            borderColor: '#f2ca50',
                            borderRadius: 6,
                            backgroundColor: 'rgba(242, 202, 80, 0.03)',
                            width: 42,
                            height: 34,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginLeft: tIdx > 0 ? -1 : 0
                          }}
                        >
                          <Text style={{ color: '#f2ca50', fontSize: 14, fontWeight: 'bold' }}>{tooth}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Вид работы (Динамический текст и цвет) */}
                <View style={{ marginBottom: 10 }}>
                  <Text style={{
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 14,
                    marginBottom: 2,
                    textAlign: 'left',
                  }}>Вид работы</Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      textAlign: 'left',
                      // Белый для имплантов, тусклый серый для своих зубов
                      color: isImplantWork ? '#ffffff' : '#444444'
                    }}
                  >
                    {isImplantWork ? 'На имплантах' : 'На своих зубах'}
                  </Text>
                </View>

                {/* Вид фиксации — рендерится только для работы на имплантах */}
                {isImplantWork && displayFixation ? (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={{
                      color: 'rgba(255,255,255,0.4)',
                      fontSize: 14,
                      marginBottom: 2,
                      textAlign: 'left',
                    }}>Фиксация</Text>
                    <Text style={{
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: '500',
                      textAlign: 'left',
                    }}>
                      {displayFixation}
                    </Text>
                  </View>
                ) : null}

                {/* Спецификация систем (только если имплант активен) */}
                {isImplantWork && group.implantInfo ? (
                  <View style={{ marginBottom: 10, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#f2ca50' }}>
                    <Text style={{ color: '#aaa', fontSize: 13, textAlign: 'left', lineHeight: 18 }}>
                      {group.implantInfo.split(' | ').join('\n')}
                    </Text>
                  </View>
                ) : null}

                {/* Материал */}
                <View style={{ marginBottom: 4 }}>
                  <Text style={{
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 14,
                    marginBottom: 2,
                    textAlign: 'left',
                  }}>Материал</Text>
                  <Text style={{
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: '500',
                    textAlign: 'left',
                  }}>
                    {group.material}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* VITA цвет */}
        {order.vitaResult && (
          <View style={{
            backgroundColor: '#0a1628ee',
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: 'rgba(242,202,80,0.3)',
          }}>
            <TouchableOpacity
              onPress={() => setIsVitaExpanded(!isVitaExpanded)}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View>
                <Text style={{
                  color: '#f2ca50',
                  fontSize: 14,
                  fontWeight: '700',
                  marginBottom: 4,
                }}>ЦВЕТ VITA</Text>
                <Text style={{
                  color: '#f2ca50',
                  fontSize: 24,
                  fontWeight: 'bold',
                }}>
                  {order.vitaResult.primary_range ?? order.vitaResult.shade ?? '—'}
                </Text>
              </View>
              <Ionicons
                name={isVitaExpanded ? "chevron-up" : "chevron-down"}
                size={24}
                color="#f2ca50"
              />
            </TouchableOpacity>

            {isVitaExpanded && (
              <View style={{ marginTop: 12 }}>
                {/* Фото */}
                {order?.vitaResult?.imageUri ? (
                  <View style={{ position: 'relative', width: '100%', height: 250, borderRadius: 16, overflow: 'hidden', backgroundColor: '#0a1628', borderWidth: 1, borderColor: 'rgba(242,202,80,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                    {!imageError ? (
                      <Image
                        source={{ uri: order.vitaResult.imageUri }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="contain"
                        onLoadStart={() => {
                          setImageLoading(true);
                          setImageError(false);
                        }}
                        onLoadEnd={() => setImageLoading(false)}
                        onError={(e) => {
                          console.error("Ошибка загрузки изображения:", e.nativeEvent.error);
                          setImageLoading(false);
                          setImageError(true);
                        }}
                      />
                    ) : (
                      <Text style={{ color: '#ff4444', fontSize: 14 }}>Не удалось загрузить фото</Text>
                    )}

                    {imageLoading && (
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(3,20,39,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#f2ca50" />
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={{ width: '100%', height: 100, borderRadius: 16, backgroundColor: '#0a1628', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 12 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Фото анализа отсутствует</Text>
                  </View>
                )}

                {/* Зоны */}
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 1.5, marginBottom: 10 }}>ЗОНЫ</Text>
                {[
                  { label: 'Шейка', value: order.vitaResult.zones?.cervical ?? order.vitaResult.zone_cervical ?? '—' },
                  { label: 'Тело', value: order.vitaResult.zones?.body ?? order.vitaResult.zone_middle ?? '—' },
                  { label: 'Режущий край', value: order.vitaResult.zones?.incisal ?? order.vitaResult.zone_incisal ?? '—' },
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

                {/* Описание характеристик */}
                {order.vitaResult && (order.vitaResult.neck || order.vitaResult.body || order.vitaResult.edge || order.vitaResult.effects || order.vitaResult.features) && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={{ color: '#f2ca50', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Анализ характеристик зуба</Text>

                    {order.vitaResult.neck && (
                      <View style={{
                        backgroundColor: '#131e31',
                        borderRadius: 12,
                        paddingVertical: 16,
                        paddingHorizontal: 16,
                        marginBottom: 14,
                        width: '100%',
                        minHeight: 'auto',
                        alignItems: 'center',
                      }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#f2ca50', marginBottom: 6, textTransform: 'uppercase' }}>Шейка (Пришеечная зона)</Text>
                        <Text style={{ fontSize: 14, color: '#fff', lineHeight: 22, textAlign: 'center' }}>{order.vitaResult.neck}</Text>
                      </View>
                    )}

                    {order.vitaResult.body && (
                      <View style={{
                        backgroundColor: '#131e31',
                        borderRadius: 12,
                        paddingVertical: 16,
                        paddingHorizontal: 16,
                        marginBottom: 14,
                        width: '100%',
                        minHeight: 'auto',
                      }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#f2ca50', marginBottom: 6, textTransform: 'uppercase', textAlign: 'center' }}>Тело зуба (Центральная часть)</Text>
                        <Text style={{ fontSize: 14, color: '#fff', lineHeight: 22 }}>{order.vitaResult.body}</Text>
                      </View>
                    )}

                    {order.vitaResult.edge && (
                      <View style={{
                        backgroundColor: '#131e31',
                        borderRadius: 12,
                        paddingVertical: 16,
                        paddingHorizontal: 16,
                        marginBottom: 14,
                        width: '100%',
                        minHeight: 'auto',
                      }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#f2ca50', marginBottom: 6, textTransform: 'uppercase', textAlign: 'center' }}>Режущий край</Text>
                        <Text style={{ fontSize: 14, color: '#fff', lineHeight: 22 }}>{order.vitaResult.edge}</Text>
                      </View>
                    )}

                    {order.vitaResult.effects && (
                      <View style={{
                        backgroundColor: '#131e31',
                        borderRadius: 12,
                        paddingVertical: 16,
                        paddingHorizontal: 16,
                        marginBottom: 14,
                        width: '100%',
                        minHeight: 'auto',
                      }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#f2ca50', marginBottom: 6, textTransform: 'uppercase', textAlign: 'center' }}>Интенсивность и эффекты</Text>
                        <Text style={{ fontSize: 14, color: '#fff', lineHeight: 22 }}>{order.vitaResult.effects}</Text>
                      </View>
                    )}

                    {order.vitaResult.features && (
                      <View style={{
                        backgroundColor: '#131e31',
                        borderRadius: 12,
                        paddingVertical: 16,
                        paddingHorizontal: 16,
                        marginBottom: 14,
                        width: '100%',
                        minHeight: 'auto',
                      }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#f2ca50', marginBottom: 6, textTransform: 'uppercase', textAlign: 'center' }}>Особенности</Text>
                        <Text style={{ fontSize: 14, color: '#fff', lineHeight: 22 }}>{order.vitaResult.features}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Примечание */}
        {order.workNote && (
          <View style={{
            backgroundColor: '#0a1628ee',
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: 'rgba(242,202,80,0.15)',
          }}>
            <Text style={{
              color: '#f2ca50',
              fontSize: 14,
              fontWeight: '700',
              marginBottom: 12,
            }}>ПРИМЕЧАНИЕ</Text>
            <Text style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: 14,
              lineHeight: 20,
            }}>{order.workNote}</Text>
          </View>
        )}
      </ScrollView>

      {/* Модал смены статуса */}
      <Modal
        visible={showStatusModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatusModal(false)}
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
              Изменить статус
            </Text>

            {STATUS_FLOW.map(status => (
              <TouchableOpacity
                key={status.key}
                onPress={() => updateStatus(status.key)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 8,
                  backgroundColor: order.status === status.key
                    ? status.color + '20'
                    : 'rgba(255,255,255,0.04)',
                  borderWidth: 1,
                  borderColor: order.status === status.key
                    ? status.color
                    : 'rgba(255,255,255,0.08)',
                }}
              >
                <Text style={{ fontSize: 20, marginRight: 12 }}>
                  {status.icon}
                </Text>
                <Text style={{
                  color: order.status === status.key
                    ? status.color
                    : 'rgba(255,255,255,0.7)',
                  fontSize: 15,
                  fontWeight: order.status === status.key ? '600' : '400',
                  flex: 1,
                }}>
                  {status.label}
                </Text>
                {order.status === status.key && (
                  <Ionicons name="checkmark-circle" size={20} color={status.color} />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setShowStatusModal(false)}
              style={{
                marginTop: 8,
                padding: 16,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>
                Отмена
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модал фото */}
      <Modal
        visible={showPhotoModal}
        transparent
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
          {(() => {
            const imageUri = order.vitaResult?.imageUri || order.vitaResult?.originalImageUri;
            if (!imageUri) {
              return (
                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>
                    Изображение недоступно
                  </Text>
                </View>
              );
            }
            return (
              <Image
                source={{ uri: imageUri }}
                style={{ width: '100%', height: '80%' }}
                resizeMode="contain"
              />
            );
          })()}
        </View>
      </Modal>

      {/* Модал подтверждения удаления */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
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
            }}>Удалить наряд?</Text>
            <Text style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: 14,
              textAlign: 'center',
              marginBottom: 24,
            }}>Это действие нельзя отменить</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowDeleteConfirm(false)}
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
                onPress={deleteOrder}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: '#e74c3c',
                }}
              >
                <Text style={{ color: '#fff', textAlign: 'center', fontSize: 15, fontWeight: '600' }}>Удалить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
