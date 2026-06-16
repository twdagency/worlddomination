import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Dilemma } from 'shared';
import { terminal } from '../../theme/terminal';

export interface DilemmaModalProps {
  visible: boolean;
  dilemma: Dilemma;
  onClose: () => void;
  onResolve: (optionId: string) => void;
}

export function DilemmaModal({ visible, dilemma, onClose, onResolve }: DilemmaModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container} testID="dilemma-modal">
        <Pressable
          onPress={onClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close dilemma"
          testID="dilemma-modal-close"
        >
          <Text style={styles.closeLabel}>× Close</Text>
        </Pressable>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{dilemma.title}</Text>
          <Text style={styles.prompt}>{dilemma.prompt}</Text>

          {dilemma.options.map((option) => (
            <View key={option.id} style={styles.optionCard} testID={`dilemma-option-${option.id}`}>
              <Text style={styles.optionLabel}>{option.label}</Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
              <Pressable
                style={styles.chooseButton}
                onPress={() => onResolve(option.id)}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${option.label}`}
                testID={`dilemma-choose-${option.id}`}
              >
                <Text style={styles.chooseLabel}>Choose</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: terminal.bg,
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  closeButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: 12,
  },
  closeLabel: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 14,
  },
  content: {
    gap: 16,
    paddingBottom: 32,
  },
  title: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  prompt: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  optionCard: {
    backgroundColor: terminal.card,
    borderColor: terminal.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  optionLabel: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 15,
    fontWeight: '700',
  },
  optionDescription: {
    color: terminal.stale,
    fontFamily: terminal.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  chooseButton: {
    alignSelf: 'flex-start',
    borderColor: terminal.accent,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  chooseLabel: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
  },
});
