import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { ToastProvider, ToastViewport } from './src/components/feedback/ToastProvider';
import { TooltipProvider } from './src/components/tooltip/TooltipContext';
import { GameProvider } from './src/game/GameContext';
import { RootTabs } from './src/navigation/RootTabs';
import { clearCampaignStorage } from './src/storage/worldStorage';

export default function App() {
  const [session, setSession] = useState(0);

  return (
    <SafeAreaProvider>
      <AppErrorBoundary
        onReset={() => {
          void clearCampaignStorage().then(() => setSession((value) => value + 1));
        }}
      >
        <ToastProvider>
          <GameProvider key={session}>
            <TooltipProvider>
              <RootTabs />
            </TooltipProvider>
            <ToastViewport />
            <StatusBar style="light" />
          </GameProvider>
        </ToastProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
