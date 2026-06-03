import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  buttons?: Array<{ text: string; onPress: () => void; style?: 'cancel' | 'default' | 'destructive' }>;
}

export default function CustomAlert({
  visible,
  title,
  message,
  onClose,
  buttons = [{ text: 'OK', onPress: onClose }],
}: CustomAlertProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttonContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  button.style === 'destructive' && styles.buttonDestructive,
                  button.style === 'cancel' && styles.buttonCancel,
                ]}
                onPress={() => {
                  button.onPress();
                  if (button.style !== 'default') {
                    onClose();
                  }
                }}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.style === 'destructive' && styles.buttonTextDestructive,
                    button.style === 'cancel' && styles.buttonTextCancel,
                  ]}
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 16, 29, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f2ca50',
    padding: 24,
    width: '85%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f2ca50',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#E0E0E0',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    backgroundColor: '#f2ca50',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDestructive: {
    backgroundColor: '#d32f2f',
  },
  buttonCancel: {
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#f2ca50',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a0f1d',
  },
  buttonTextDestructive: {
    color: '#fff',
  },
  buttonTextCancel: {
    color: '#f2ca50',
  },
});
