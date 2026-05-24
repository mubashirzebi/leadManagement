import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { Platform } from 'react-native';

enableScreens(false);

export default function App() {
  console.log('[App] Rendering application shell');
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    // Expo Web sometimes ends up with a non-scrollable root; force document scrolling.
    const html = document.documentElement;
    const body = document.body;
    html.style.height = '100%';
    body.style.height = '100%';
    body.style.overflow = 'auto';
    body.style.overscrollBehavior = 'auto';
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
        <StatusBar style="light" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
