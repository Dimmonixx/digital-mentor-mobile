import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { off, onValue, ref } from 'firebase/database';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    ImageBackground,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getFirebaseDB } from '@/constants/firebase';
import { useAuth } from '@/hooks/useAuth';

interface ChatPartner {
  id: string;
  name: string;
  role: 'doctor' | 'technician';
}

export default function ChatListScreen() {
  const insets = useSafeAreaInsets();
  const { user, role } = useAuth();
  const [partners, setPartners] = useState<ChatPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAiModal, setShowAiModal] = useState(false);
  const [unreadChats, setUnreadChats] = useState<Set<string>>(new Set());

  const userId = user?.uid || user?.id || '';

  useEffect(() => {
    if (!userId || !role) {
      setLoading(false);
      return;
    }

    const partnershipsRef = ref(getFirebaseDB(), 'partnerships');

    const unsubscribe = onValue(partnershipsRef, (snapshot) => {
      const data = snapshot.val();
      const list: ChatPartner[] = [];
      const seen = new Set<string>();

      if (data && typeof data === 'object') {
        Object.values(data).forEach((p: any) => {
          if (!p) return;

          if (role === 'doctor' && p.doctorUid === userId && p.technicianUid && !seen.has(p.technicianUid)) {
            seen.add(p.technicianUid);
            list.push({
              id: p.technicianUid,
              name: p.technicianName || 'Техник',
              role: 'technician',
            });
          } else if (role === 'technician' && p.technicianUid === userId && p.doctorUid && !seen.has(p.doctorUid)) {
            seen.add(p.doctorUid);
            list.push({
              id: p.doctorUid,
              name: p.doctorName || 'Врач',
              role: 'doctor',
            });
          }
        });
      }

      list.sort((a, b) => a.name.localeCompare(b.name));
      setPartners(list);
      setLoading(false);
    });

    return () => off(partnershipsRef, 'value', unsubscribe);
  }, [userId, role]);

  // Слушатель для чатов и непрочитанных сообщений
  useEffect(() => {
    if (!userId || !role) return;

    const chatsRef = ref(getFirebaseDB(), 'chats');
    const unsubscribe = onValue(chatsRef, (snapshot) => {
      const data = snapshot.val();
      const unreadSet = new Set<string>();

      if (data && typeof data === 'object') {
        Object.entries(data).forEach(([chatId, chatData]: [string, any]) => {
          if (chatData?.members && chatData.members[userId]) {
            const lastTimestamp = chatData.lastTimestamp || 0;
            const lastSeen = (globalThis as any).getChatLastSeen?.(chatId) || 0;
            if (lastTimestamp > lastSeen) {
              // Определяем партнёра из members
              const partnerId = Object.keys(chatData.members).find(id => id !== userId);
              if (partnerId) {
                unreadSet.add(partnerId);
              }
            }
          }
        });
      }

      setUnreadChats(unreadSet);
    });

    return () => off(chatsRef, 'value', unsubscribe);
  }, [userId, role]);

  useFocusEffect(
    useCallback(() => {
      if (!userId || !role) return;

      const chatsRef = ref(getFirebaseDB(), 'chats');
      const unsubscribe = onValue(chatsRef, (snapshot) => {
        const data = snapshot.val();
        const unreadSet = new Set<string>();

        if (data && typeof data === 'object') {
          Object.entries(data).forEach(([chatId, chatData]: [string, any]) => {
            if (chatData?.members && chatData.members[userId]) {
              // Исключаем чат если пользователь сейчас в нём
              if ((globalThis as any).isInPartnerChat === chatId) {
                return;
              }
              const lastTimestamp = chatData.lastTimestamp || 0;
              const lastSeen = (globalThis as any).getChatLastSeen?.(chatId) || 0;
              if (lastTimestamp > lastSeen) {
                const partnerId = Object.keys(chatData.members).find(id => id !== userId);
                if (partnerId) {
                  unreadSet.add(partnerId);
                }
              }
            }
          });
        }

        // Даём время lastSeen обновиться перед пересчётом
        setTimeout(() => {
          setUnreadChats(unreadSet);
        }, 500);
      });

      return () => off(chatsRef, 'value', unsubscribe);
    }, [userId, role])
  );

  const openGlobalChat = () => {
    setShowAiModal(true);
  };

  const openPartnerChat = (partner: ChatPartner) => {
    router.push({
      pathname: '/partner-chat',
      params: {
        partnerId: partner.id,
        partnerName: partner.name,
        partnerRole: partner.role,
      },
    } as any);
  };

  const renderItem = ({ item }: { item: ChatPartner | { type: 'global' } }) => {
    if ((item as any).type === 'global') {
      return (
        <TouchableOpacity
          style={styles.globalRow}
          onPress={openGlobalChat}
          activeOpacity={0.8}
        >
          <View style={styles.globalIconWrap}>
            <Ionicons name="planet" size={28} color="#031427" />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.globalTitle}>ИИ-Наставник</Text>
            <Text style={styles.subtitle}>Выберите специализацию</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#f2ca50" />
        </TouchableOpacity>
      );
    }

    const partner = item as ChatPartner;
    const hasUnread = unreadChats.has(partner.id);
    return (
      <TouchableOpacity
        style={styles.partnerRow}
        onPress={() => openPartnerChat(partner)}
        activeOpacity={0.8}
      >
        <View style={styles.avatarWrap}>
          <Ionicons
            name={partner.role === 'doctor' ? 'medical' : 'construct'}
            size={24}
            color="#f2ca50"
          />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.partnerName}>{partner.name}</Text>
          <Text style={styles.subtitle}>
            {partner.role === 'doctor' ? 'Врач' : 'Техник'}
          </Text>
        </View>
        {hasUnread && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>1</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={22} color="#f2ca50" />
      </TouchableOpacity>
    );
  };

  const data = [{ type: 'global' } as any, ...partners];

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('@/assets/images/background.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={[styles.header, { paddingTop: 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#f2ca50" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Ionicons name="chatbubbles" size={22} color="#f2ca50" style={styles.headerIcon} />
            <Text style={styles.headerTitle}>Чаты</Text>
          </View>
          <View style={styles.backButton} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#f2ca50" />
          </View>
        ) : (
          <FlatList
            data={data}
            renderItem={renderItem}
            keyExtractor={(item, index) => ((item as any).id || `global-${index}`)}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={56} color="#f2ca5080" />
                <Text style={styles.emptyTitle}>Нет активных диалогов</Text>
                <Text style={styles.emptySubtitle}>
                  Свяжитесь с коллегой в разделе профиля
                </Text>
              </View>
            }
          />
        )}
      </ImageBackground>

      {/* AI Role Selection Modal */}
      <Modal visible={showAiModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAiModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>ИИ-Наставник</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowAiModal(false);
                router.push({ pathname: '/global-chat', params: { role: 'doctor' } } as any);
              }}
            >
              <Ionicons name="medical" size={24} color="#031427" />
              <Text style={styles.modalButtonText}>Для врача</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowAiModal(false);
                router.push({ pathname: '/global-chat', params: { role: 'technician' } } as any);
              }}
            >
              <Ionicons name="construct" size={24} color="#031427" />
              <Text style={styles.modalButtonText}>Для техника</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowAiModal(false)}
            >
              <Text style={styles.modalCancelText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#031427',
  },
  background: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f2ca50',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    marginRight: 4,
  },
  headerTitle: {
    color: '#f2ca50',
    fontSize: 18,
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  globalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a1628',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f2ca50',
    padding: 14,
    marginBottom: 16,
  },
  globalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f2ca50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,22,40,0.85)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.15)',
    padding: 14,
    marginBottom: 10,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(242,202,80,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowText: {
    flex: 1,
  },
  globalTitle: {
    color: '#f2ca50',
    fontSize: 16,
    fontWeight: '700',
  },
  partnerName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  unreadBadge: {
    backgroundColor: '#f2ca50',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginRight: 8,
  },
  unreadBadgeText: {
    color: '#031427',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 80,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: '#0a0f1e',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f2ca50',
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    color: '#f2ca50',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f2ca50',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 12,
  },
  modalButtonText: {
    color: '#031427',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
  },
});
