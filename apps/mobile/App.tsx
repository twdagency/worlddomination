import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameProvider } from './src/game/GameContext';
import { RootTabs } from './src/navigation/RootTabs';

export default function App() {
  return (
    <SafeAreaProvider>
      <GameProvider>
        <RootTabs />
        <StatusBar style="light" />
      </GameProvider>
    </SafeAreaProvider>
  );
}
