import '@/constants/firebase'; // Инициализация Firebase ДО всех импортов, использующих Firebase

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';

import IncomingArchiveWatcher from '@/components/IncomingArchiveWatcher';
import { LanguageProvider } from '@/context/LanguageContext';
import { ThemeProvider as AppThemeProvider } from '@/context/ThemeContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setPositionAsync('absolute');
      NavigationBar.setBackgroundColorAsync('#00000000');
      NavigationBar.setButtonStyleAsync('light');
    }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0b0e14' }}>
      <KeyboardProvider>
        <LanguageProvider>
          <AppThemeProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <View style={{ flex: 1, backgroundColor: 'transparent', zIndex: 2 }}>
                <Stack>
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="auth" options={{ headerShown: false }} />
                  <Stack.Screen name="new-order" options={{ headerShown: false }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                  <Stack.Screen name="chat" options={{ headerShown: false }} />
                  <Stack.Screen name="order-details" options={{ headerShown: false }} />
                  <Stack.Screen name="morphology" options={{ headerShown: false }} />
                  <Stack.Screen name="work-analysis" options={{ headerShown: false }} />
                  <Stack.Screen name="case-details" options={{ headerShown: false }} />
                  <Stack.Screen name="golden-proportion" options={{ headerShown: false }} />
                  <Stack.Screen name="global-archive" options={{ headerShown: false }} />
                  <Stack.Screen name="create-case" options={{ headerShown: false }} />
                </Stack>
                <IncomingArchiveWatcher />
                <StatusBar style="auto" />
              </View>
            </ThemeProvider>
          </AppThemeProvider>
        </LanguageProvider>
      </KeyboardProvider>
    </View>
  );
}
