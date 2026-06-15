import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider, ToastViewport } from './src/components/feedback/ToastProvider';
import { GameProvider } from './src/game/GameContext';
import { RootTabs } from './src/navigation/RootTabs';

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <GameProvider>
          <RootTabs />
          <ToastViewport />
          <StatusBar style="light" />
        </GameProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
