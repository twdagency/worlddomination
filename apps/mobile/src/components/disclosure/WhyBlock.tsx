import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { terminal } from '../../theme/terminal';

interface WhyBlockProps {
  explanation: string | undefined;
}

export function WhyBlock({ explanation }: WhyBlockProps) {
  const [open, setOpen] = useState(false);
  if (!explanation) return null;

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen((prev) => !prev)} style={styles.trigger}>
        <Text style={styles.triggerText}>Why?</Text>
        <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open ? <Text style={styles.body}>{explanation}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 6,
    gap: 4,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
  },
  triggerText: {
    color: terminal.warning,
    fontFamily: terminal.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  chevron: {
    color: terminal.warning,
    fontFamily: terminal.mono,
    fontSize: 12,
  },
  body: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 12,
    lineHeight: 18,
  },
});
