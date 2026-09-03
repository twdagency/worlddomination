import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { terminal } from '../theme/terminal';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
  onReset: () => void;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container} testID="app-error-boundary">
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The campaign can be reset to get you back in. Unsaved progress on this device will be
          lost.
        </Text>
        <Pressable
          style={styles.button}
          onPress={this.handleReset}
          accessibilityRole="button"
          accessibilityLabel="Reset campaign"
          testID="app-error-reset"
        >
          <Text style={styles.buttonLabel}>Reset campaign</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: terminal.bg,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
    lineHeight: 20,
  },
  button: {
    backgroundColor: terminal.accent,
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonLabel: {
    color: terminal.bg,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
  },
});
