import { useRouter } from 'expo-router';
import React from 'react';
import { Image, ImageBackground, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  
  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#031427" />
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <ImageBackground
              source={require('@/assets/images/header-logo.png')}
              style={styles.headerImage}
              resizeMode="cover"
            >
              <View style={styles.headerOverlay}>
                <Text style={styles.headerTitle}>Digital Mentor</Text>
              </View>
            </ImageBackground>
          </View>
          
          {/* Cards */}
          <View style={styles.cardsContainer}>
            <TouchableOpacity style={styles.card} onPress={() => router.push('/chat')}>
              <Image
                source={require('@/assets/images/chat.png')}
                style={{ flex: 1, width: '100%' }}
                resizeMode="cover"
              />
              <View style={styles.labelContainer}>
                <View style={styles.label}>
                  <Text style={styles.labelText}>Чат Техников</Text>
                </View>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.card}>
              <Image
                source={require('@/assets/images/techcard.png')}
                style={{ flex: 1, width: '100%' }}
                resizeMode="cover"
              />
              <View style={styles.labelContainer}>
                <View style={styles.label}>
                  <Text style={styles.labelText}>Тех-Карта</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    width: '100%',
  },
  headerImage: {
    width: '100%',
    height: 320,
    justifyContent: 'flex-end',
  },
  headerOverlay: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  headerTitle: {
    color: '#f2ca50',
    fontSize: 36,
    fontWeight: 'bold',
    fontStyle: 'italic',
    letterSpacing: 1,
    textShadowColor: '#f2ca5080',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  headerSubtitle: {
    color: '#f2ca50',
    fontSize: 11,
    letterSpacing: 3,
    opacity: 0.8,
    marginTop: 6,
  },
  cardsContainer: {
    paddingHorizontal: 20,
    gap: 30,
    flex: 1,
  },
  card: {
    borderWidth: 4,
    borderColor: '#f2ca50',
    borderRadius: 16,
    height: 220,
    padding: 0,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#f2ca50',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 20,
    marginBottom: 3,
  },
  labelContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  label: {
    backgroundColor: 'rgba(10, 22, 40, 0.8)',
    borderWidth: 1,
    borderColor: '#f2ca50',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#f2ca50',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f2ca50',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  });
