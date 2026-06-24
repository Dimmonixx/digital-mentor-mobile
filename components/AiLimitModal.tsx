import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function AiLimitModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    (globalThis as any).showAiLimitAlert = () => setVisible(true);
    return () => { delete (globalThis as any).showAiLimitAlert; };
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => setVisible(false)}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.iconRow}>
            <Ionicons name="flash-off" size={32} color="#f2ca50" />
          </View>
          <Text style={styles.title}>Лимит исчерпан</Text>
          <Text style={styles.message}>
            Дневной лимит ИИ-запросов (15) израсходован.{'\n'}Обновление произойдёт в полночь.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => setVisible(false)}>
            <Text style={styles.buttonText}>Понятно</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 12, 24, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: '#0d111a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f2ca50',
    padding: 28,
    width: '88%',
    alignItems: 'center',
    shadowColor: '#f2ca50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  iconRow: {
    marginBottom: 14,
    backgroundColor: 'rgba(242,202,80,0.08)',
    borderRadius: 50,
    padding: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f2ca50',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 14,
    color: '#b0b8cc',
    textAlign: 'center',
    marginBottom: 26,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#f2ca50',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0a0f1d',
    letterSpacing: 0.4,
  },
});
