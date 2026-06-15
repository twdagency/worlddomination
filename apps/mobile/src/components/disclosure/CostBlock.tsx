import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CostLine, CostPreview } from '../../game/costPreview';
import { terminal } from '../../theme/terminal';
import { formatFunding, formatResource } from '../../utils/format';

interface CostBlockProps {
  preview: CostPreview;
  title?: string;
}

function formatAmount(line: CostLine): string {
  if (line.id === 'funding') {
    return formatFunding(line.required);
  }
  if (line.id === 'manpower') {
    return Math.ceil(line.required).toLocaleString();
  }
  if (line.id === 'offer') {
    return line.label;
  }
  return formatResource(line.required);
}

function formatAvailable(line: CostLine): string {
  if (line.id === 'funding') {
    return formatFunding(line.available);
  }
  if (line.id === 'manpower') {
    return Math.floor(line.available).toLocaleString();
  }
  if (line.id === 'offer') {
    return 'Ready';
  }
  return formatResource(line.available);
}

export function CostBlock({ preview, title = 'Cost preview' }: CostBlockProps) {
  if (preview.lines.length === 0) return null;

  return (
    <View style={styles.block}>
      <Text style={styles.heading}>{title}</Text>
      {preview.lines.map((line) => {
        const sufficient = line.available >= line.required;
        if (line.id === 'offer') {
          return (
            <Text key={line.id} style={styles.offer}>
              {line.label}
            </Text>
          );
        }
        return (
          <Text
            key={line.id}
            style={[styles.line, sufficient ? styles.ok : styles.short]}
          >
            {line.label}: {formatAmount(line)} (have {formatAvailable(line)})
          </Text>
        );
      })}
      {!preview.affordable && preview.shortfallLabel ? (
        <Text style={styles.shortfall}>{preview.shortfallLabel}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 4,
  },
  heading: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  line: {
    fontFamily: terminal.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  ok: {
    color: terminal.accent,
  },
  short: {
    color: terminal.danger,
  },
  offer: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  shortfall: {
    color: terminal.danger,
    fontFamily: terminal.mono,
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
});
