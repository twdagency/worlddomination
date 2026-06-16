import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TerminalCard } from '../TerminalCard';
import { terminal } from '../../theme/terminal';

export type QuickActionId = 'order' | 'diplomacy' | 'territory' | 'forces';

interface QuickAction {
  id: QuickActionId;
  label: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'order', label: 'Issue Order' },
  { id: 'diplomacy', label: 'Diplomacy' },
  { id: 'territory', label: 'Manage Capital' },
  { id: 'forces', label: 'View Forces' },
];

interface QuickActionsCardProps {
  onAction: (action: QuickActionId) => void;
  disabled?: boolean;
}

export function QuickActionsCard({ onAction, disabled = false }: QuickActionsCardProps) {
  return (
    <TerminalCard testID="dashboard-quick-actions" style={disabled ? styles.disabledCard : undefined}>
      <Text style={styles.label}>Quick Actions</Text>
      {disabled ? (
        <Text style={styles.disabledHint} testID="quick-actions-read-only">
          Read-only — your country has fallen.
        </Text>
      ) : null}
      <View style={styles.grid}>
        {QUICK_ACTIONS.map((action) => (
          <Pressable
            key={action.id}
            style={[styles.button, disabled && styles.buttonDisabled]}
            onPress={() => {
              if (!disabled) onAction(action.id);
            }}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{ disabled }}
            testID={`quick-action-${action.id}`}
          >
            <Text style={[styles.buttonLabel, disabled && styles.buttonLabelDisabled]}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </TerminalCard>
  );
}

const styles = StyleSheet.create({
  label: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    borderColor: terminal.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: '47%',
  },
  buttonLabel: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  disabledCard: {
    opacity: 0.7,
  },
  disabledHint: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginBottom: 8,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonLabelDisabled: {
    color: terminal.muted,
  },
});
