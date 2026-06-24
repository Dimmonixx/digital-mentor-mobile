import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ImageBackground, Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

interface ChatHeaderProps {
  isAiMode: boolean;
  onToggleAi: (value: boolean) => void;
  onlineCount?: number;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  isAiMode,
  onToggleAi,
  onlineCount = 1,
}) => {
  const router = useRouter();

  return (
    <ImageBackground
      source={require('../assets/images/background.png')}
      style={styles.absoluteWrapper}
    >
      <View style={styles.blurOverlay}>

        {/* 1. ГЛАВНЫЙ ТОП-ХЕДЕР */}
        <View style={styles.globalHeader}>
          <TouchableOpacity style={styles.glassButton}>
            <Ionicons name="menu" size={22} color="#f2ca50" style={styles.neonGlow} />
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>
              <Text style={styles.logoGold}>Di</Text>Labs
            </Text>
            <View style={styles.mainCreditsBadge}>
              <Ionicons name="diamond" size={12} color="#f2ca50" style={{ marginRight: 4 }} />
              <Text style={styles.mainCreditsText}>999k</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.glassButton}>
            <Ionicons name="notifications" size={20} color="#f2ca50" style={styles.neonGlow} />
          </TouchableOpacity>
        </View>

        {/* 2. ТЕХНОЛОГИЧНЫЙ SUB-HEADER ЧАТА */}
        <View style={styles.chatSubHeader}>

          {/* Левая сторона: Стрелка назад и Неоновый Онлайн */}
          <View style={styles.leftSubSection}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#f2ca50" />
            </TouchableOpacity>

            <View style={styles.statusContainer}>
              <View style={styles.onlineDot} />
              <Text style={styles.statusText}>{onlineCount} онлайн</Text>
            </View>
          </View>

          {/* Правая сторона: Интегрированный ИИ-Тоггл */}
          <View style={styles.rightSubSection}>
            <Text style={styles.aiLabel}>Режим ИИ</Text>
            <Switch
              trackColor={{ false: 'rgba(255,255,255,0.05)', true: '#f2ca50' }}
              thumbColor={isAiMode ? '#ffffff' : '#a0a0a0'}
              ios_backgroundColor="rgba(0,0,0,0.3)"
              onValueChange={onToggleAi}
              value={isAiMode}
              style={styles.aiSwitch}
            />
          </View>

        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  absoluteWrapper: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(242, 202, 80, 0.25)',
    shadowColor: '#f2ca50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  blurOverlay: {
    backgroundColor: 'rgba(13, 17, 26, 0.75)',
    paddingTop: Platform.OS === 'ios' ? 50 : 35,
  },
  globalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  glassButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.2)',
  },
  neonGlow: {
    shadowColor: '#f2ca50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginRight: 10,
    textShadowColor: 'rgba(255, 255, 255, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  logoGold: {
    color: '#f2ca50',
  },
  mainCreditsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242, 202, 80, 0.07)',
    borderWidth: 1,
    borderColor: '#f2ca50',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 20,
    shadowColor: '#f2ca50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  mainCreditsText: {
    color: '#f2ca50',
    fontSize: 13,
    fontWeight: '800',
  },
  chatSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(242, 202, 80, 0.1)',
  },
  leftSubSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    paddingRight: 14,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginRight: 6,
    shadowColor: '#4CAF50',
    shadowRadius: 4,
    shadowOpacity: 0.8,
  },
  statusText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '700',
  },
  rightSubSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  aiLabel: {
    color: '#8e9bb0',
    fontSize: 12,
    marginRight: 8,
    fontWeight: '600',
  },
  aiSwitch: {
    transform: Platform.OS === 'android' ? [{ scaleX: 0.8 }, { scaleY: 0.8 }] : [],
  },
});
