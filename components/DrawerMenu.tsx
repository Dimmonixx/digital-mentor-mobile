import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 340);

interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
  onRoleSwitch?: () => void;
  unreadAnalysesCount?: number;
}

const PRIVACY_POLICY = `ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ

Последнее обновление: июнь 2025 г.

DiLabs («Приложение») собирает минимально необходимые данные для обеспечения работы сервиса. Мы не передаём ваши персональные данные третьим лицам без вашего согласия.

Собираемые данные:
• Имя пользователя и роль (врач / техник)
• Email-адрес для авторизации
• Данные о нарядах и клинических кейсах, создаваемых в приложении
• Анонимная статистика использования функций

Хранение данных:
Все данные хранятся в защищённой базе данных Firebase (Google Cloud) с шифрованием в состоянии покоя и при передаче.

Права пользователя:
Вы вправе в любое время запросить удаление своего аккаунта и всех связанных данных, направив запрос разработчику.

По вопросам конфиденциальности: dimmonix@gmail.com`;

const TERMS_OF_USE = `ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ

Последнее обновление: июнь 2025 г.

Используя приложение DiLabs, вы соглашаетесь с настоящими условиями.

1. НАЗНАЧЕНИЕ
DiLabs — профессиональный инструмент для зубных техников и врачей-стоматологов. Приложение предназначено исключительно для профессионального использования.

2. ОГРАНИЧЕНИЕ ОТВЕТСТВЕННОСТИ
AI-анализ работ носит вспомогательный, рекомендательный характер и не является медицинским заключением. Окончательное профессиональное решение всегда остаётся за специалистом.

3. БЕТА-ВЕРСИЯ
Приложение находится в стадии бета-тестирования. Функциональность может изменяться. Разработчик не несёт ответственности за возможные сбои в период тестирования.

4. КОНТЕНТ ПОЛЬЗОВАТЕЛЕЙ
Загружая фотографии и данные пациентов, вы подтверждаете, что имеете все необходимые разрешения на обработку этих данных в соответствии с действующим законодательством.

5. СВЯЗЬ
По всем вопросам: dimmonix@gmail.com`;

export default function DrawerMenu({ visible, onClose, onRoleSwitch, unreadAnalysesCount = 0 }: DrawerMenuProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [user, setUser] = useState<any>(null);
  const [modalContent, setModalContent] = useState<{ title: string; text: string } | null>(null);
  const [supportModalVisible, setSupportModalVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('user').then((data) => {
      if (data) setUser(JSON.parse(data));
    });
  }, [visible]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -DRAWER_WIDTH, duration: 240, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleRoleSwitch = async () => {
    if (!user) return;
    const newRole = user.role === 'doctor' ? 'technician' : 'doctor';
    const updatedUser = { ...user, role: newRole };
    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    onRoleSwitch?.();
    onClose();
  };

  const getRoleLabel = (role: string) => {
    if (role === 'doctor') return 'Врач';
    if (role === 'technician') return 'Зубной техник';
    return role;
  };

  const getRoleIcon = (role: string) => {
    return role === 'doctor' ? 'medkit-outline' : 'construct-outline';
  };

  const menuItems = [
    {
      icon: 'time-outline' as const,
      label: 'Глобальный архив ИИ',
      onPress: () => { onClose(); router.push('/global-archive' as any); },
    },
    {
      icon: 'shield-checkmark-outline' as const,
      label: 'Политика конфиденциальности',
      onPress: () => setModalContent({ title: 'Политика конфиденциальности', text: PRIVACY_POLICY }),
    },
    {
      icon: 'document-text-outline' as const,
      label: 'Пользовательское соглашение',
      onPress: () => setModalContent({ title: 'Пользовательское соглашение', text: TERMS_OF_USE }),
    },
    {
      icon: 'bug-outline' as const,
      label: 'Сообщить о баге / Поддержка',
      onPress: () => setSupportModalVisible(true),
    },
  ];

  const firstName = user?.profile?.firstName?.trim() || user?.name?.split(' ').slice(0, 2).join(' ') || 'Пользователь';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />
        </TouchableWithoutFeedback>

        {/* Drawer panel */}
        <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }], paddingTop: insets.top }]}>

          {/* Кнопка закрытия (абсолютно, правый верхний угол) */}
          <TouchableOpacity
            style={[styles.closeBtn, { top: insets.top + 12 }]}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.45)" />
          </TouchableOpacity>

          {/* ── 1. БОЛЬШОЙ ЛОГОТИП по центру ── */}
          <View style={styles.logoBlock}>
            <Image
              source={require('@/assets/images/header-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* ── 2. КАРТОЧКА ПОЛЬЗОВАТЕЛЯ ── */}
          <View style={styles.profileRow}>
            <View style={styles.avatarCircle}>
              <Ionicons name={user ? getRoleIcon(user.role) : 'person-outline'} size={20} color="#f2ca50" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userName} numberOfLines={1}>{firstName}</Text>
              {user?.role && (
                <Text style={styles.roleText}>{getRoleLabel(user.role)}</Text>
              )}
              {user?.diamondBalance !== undefined && (
                <View style={styles.diamondRow}>
                  <Ionicons name="flash" size={13} color="#f2ca50" />
                  <Text style={styles.diamondText}>{user.diamondBalance} зарядов ИИ</Text>
                </View>
              )}
            </View>
          </View>

          {/* ── 3. РАЗДЕЛИТЕЛЬ ── */}
          <View style={styles.divider} />

          {/* Beta role switcher */}
          <View style={styles.betaSection}>
            <View style={styles.betaBadgeRow}>
              <View style={styles.betaBadge}>
                <Text style={styles.betaBadgeText}>BETA</Text>
              </View>
              <Text style={styles.betaLabel}>Переключатель ролей</Text>
            </View>
            <TouchableOpacity style={styles.roleSwitchBtn} onPress={handleRoleSwitch} activeOpacity={0.8}>
              <Ionicons name="swap-horizontal-outline" size={18} color="#031427" />
              <Text style={styles.roleSwitchText}>
                Сменить на: {user?.role === 'doctor' ? 'Техник' : 'Врач'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Menu items */}
          <ScrollView style={styles.menuList} showsVerticalScrollIndicator={false}>
            {menuItems.map((item, index) => {
              const isArchive = item.label === 'Глобальный архив ИИ';
              const showBadge = isArchive && unreadAnalysesCount > 0;
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.menuItem}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuItemIcon}>
                    <Ionicons name={item.icon} size={20} color="#f2ca50" />
                  </View>
                  <Text style={styles.menuItemLabel}>{item.label}</Text>
                  {showBadge && (
                    <View style={styles.archiveBadge}>
                      <Text style={styles.archiveBadgeText}>
                        {unreadAnalysesCount > 99 ? '99+' : unreadAnalysesCount}
                      </Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer version */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.footerText}>DiLabs Beta v1.0.0</Text>
            <Text style={styles.footerSubtext}>© 2025 DiLabs. Все права защищены.</Text>
          </View>
        </Animated.View>
      </View>

      {/* Legal modal */}
      {modalContent && (
        <Modal visible={!!modalContent} transparent animationType="fade" onRequestClose={() => setModalContent(null)}>
          <View style={styles.legalOverlay}>
            <View style={styles.legalModal}>
              <Text style={styles.legalTitle}>{modalContent.title}</Text>
              <ScrollView style={styles.legalScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.legalText}>{modalContent.text}</Text>
              </ScrollView>
              <TouchableOpacity style={styles.legalCloseBtn} onPress={() => setModalContent(null)}>
                <Text style={styles.legalCloseBtnText}>Понятно</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Support modal */}
      {supportModalVisible && (
        <Modal visible={supportModalVisible} transparent animationType="fade" onRequestClose={() => setSupportModalVisible(false)}>
          <View style={styles.legalOverlay}>
            <View style={styles.legalModal}>
              <View style={styles.supportIconWrap}>
                <Ionicons name="bug-outline" size={40} color="#f2ca50" />
              </View>
              <Text style={styles.legalTitle}>Сообщить о баге</Text>
              <Text style={styles.supportText}>
                Спасибо за участие в бета-тестировании! 🙏{'\n\n'}
                Пожалуйста, отправляйте скриншоты и описание багов напрямую разработчику Дмитрию.{'\n\n'}
                📧 dimmonix@gmail.com{'\n\n'}
                Ваша обратная связь помогает сделать DiLabs лучше!
              </Text>
              <TouchableOpacity style={styles.legalCloseBtn} onPress={() => setSupportModalVisible(false)}>
                <Text style={styles.legalCloseBtnText}>Понятно</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  drawer: {
    width: DRAWER_WIDTH,
    backgroundColor: '#080d1a',
    borderRightWidth: 1,
    borderRightColor: 'rgba(242,202,80,0.25)',
    elevation: 24,
    shadowColor: '#f2ca50',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    padding: 6,
  },
  logoBlock: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  logo: {
    width: 200,
    height: 68,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(242,202,80,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(242,202,80,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  profileInfo: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  userName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  roleText: {
    color: 'rgba(242,202,80,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  diamondRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  diamondText: {
    color: '#bda15d',
    fontSize: 13,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(242,202,80,0.12)',
    marginHorizontal: 16,
    marginVertical: 4,
  },
  betaSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  betaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  betaBadge: {
    backgroundColor: '#f2ca50',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  betaBadgeText: {
    color: '#031427',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  betaLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
  },
  roleSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f2ca50',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  roleSwitchText: {
    color: '#031427',
    fontSize: 14,
    fontWeight: '700',
  },
  menuList: {
    flex: 1,
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  menuItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(242,202,80,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemLabel: {
    flex: 1,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '500',
  },
  archiveBadge: {
    backgroundColor: '#c0392b',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginRight: 4,
  },
  archiveBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(242,202,80,0.1)',
  },
  footerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    fontWeight: '500',
  },
  footerSubtext: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    marginTop: 2,
  },
  legalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  legalModal: {
    backgroundColor: '#0d1525',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.2)',
  },
  legalTitle: {
    color: '#f2ca50',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  legalScroll: {
    maxHeight: 380,
    marginBottom: 16,
  },
  legalText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 20,
  },
  legalCloseBtn: {
    backgroundColor: '#f2ca50',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  legalCloseBtnText: {
    color: '#031427',
    fontSize: 15,
    fontWeight: '700',
  },
  supportIconWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  supportText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
});
