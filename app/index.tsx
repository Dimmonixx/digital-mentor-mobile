import { useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  useEffect(() => {
    AsyncStorage.getItem('user').then((data) => {
      if (data) {
        router.replace('/(tabs)');
      } else {
        router.replace('/auth');
      }
    });
  }, []);

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: '#031427',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <ActivityIndicator color="#f2ca50" size="large" />
    </View>
  );
}
