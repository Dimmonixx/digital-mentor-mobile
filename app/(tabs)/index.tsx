import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import React from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroWrap, Platform.OS === 'ios' && styles.heroGlowIos]}>
          <Image
            source={require('@/assets/images/hero-tooth.png')}
            style={styles.heroImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.cardsContainer}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/chat')}
            activeOpacity={0.8}
          >
            <View style={styles.iconBox}>
              <Ionicons name="chatbubbles-outline" size={22} color="#f2ca50" />
            </View>
            <Text style={styles.labelText}>Чат Техников</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#FFD700" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => {/* Добавьте переход для тех-карты */}}
          >
            <View style={styles.iconBox}>
              <Ionicons name="layers-outline" size={22} color="#f2ca50" />
            </View>
            <Text style={styles.labelText}>Тех-Карта</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#FFD700" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, styles.cardVita]}
            onPress={() => router.push('/color-analyzer')}
            activeOpacity={0.8}
          >
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name="tooth-outline" size={22} color="#f2ca50" />
            </View>
            <Text style={styles.labelText}>Анализ цвета</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#FFD700" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 120,
  },
  heroWrap: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 340,
    height: 240,
    marginTop: -20,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGlowIos: {
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  heroImage: {
    width: '150%',
    height: '150%',
  },
  cardsContainer: {
    paddingHorizontal: 20,
    gap: 0,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    marginBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(20, 30, 45, 0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f2ca50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1.5,
    borderColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelText: {
    flex: 1,
    marginLeft: 15,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 2.0,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  cardVita: {
    marginBottom: 32,
  },
});