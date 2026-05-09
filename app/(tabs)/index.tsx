import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#031427" />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.mainTitle}>Digital Mentor</Text>
          <Text style={styles.subTitle}>ЦИФРОВОЙ НАСТАВНИК</Text>
        </View>
        
        {/* Cards */}
        <View style={styles.cardsContainer}>
          <TouchableOpacity style={styles.card}>
            <View style={styles.imagePlaceholder} />
            <Text style={styles.cardTitle}>Чат Техников</Text>
            <TouchableOpacity style={styles.arrowButton}>
              <Text style={styles.arrowText}>→</Text>
            </TouchableOpacity>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.card}>
            <View style={styles.imagePlaceholder} />
            <Text style={styles.cardTitle}>Тех-Карта</Text>
            <TouchableOpacity style={styles.arrowButton}>
              <Text style={styles.arrowText}>→</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#031427',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 40,
  },
  mainTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#f2ca50',
    fontStyle: 'italic',
    marginBottom: 12,
    textAlign: 'center',
  },
  subTitle: {
    fontSize: 12,
    color: '#f2ca50',
    letterSpacing: 4,
    textAlign: 'center',
  },
  cardsContainer: {
    paddingHorizontal: 20,
    gap: 30,
    flex: 1,
  },
  card: {
    backgroundColor: '#0a2342',
    borderWidth: 2,
    borderColor: '#f2ca50',
    borderRadius: 12,
    aspectRatio: 4/3,
    padding: 20,
    justifyContent: 'space-between',
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: '#666666',
    borderRadius: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  arrowButton: {
    width: 50,
    height: 50,
    backgroundColor: '#f2ca50',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  arrowText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#031427',
  },
});
