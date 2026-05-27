import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface StyledToastProps {
  visible: boolean;
  message: string;
  type?: 'success' | 'error';
  onDismiss?: () => void;
  duration?: number;
}

export default function StyledToast({
  visible,
  message,
  type = 'success',
  onDismiss,
  duration = 3000,
}: StyledToastProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      hideToast();
    }
  }, [visible, duration]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  };

  if (!visible) return null;

  const backgroundColor = type === 'success' ? '#0a1f44' : '#1a1a1a';
  const borderColor = type === 'success' ? '#f2ca50' : '#ff6b6b';
  const icon = type === 'success' ? '✓' : '⚠';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.toastContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            backgroundColor,
            borderColor,
          },
        ]}
      >
        <View style={styles.toastContent}>
          <Text style={[styles.icon, { color: borderColor }]}>{icon}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: borderColor }]}>✕</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: '#0a1f44',
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  message: {
    flex: 1,
    color: '#f2ca50',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});
