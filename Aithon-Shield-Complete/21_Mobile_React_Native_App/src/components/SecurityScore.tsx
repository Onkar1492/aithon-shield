import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius } from '../theme/colors';

interface SecurityScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

function getScoreColor(score: number): string {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.warning;
  if (score >= 40) return colors.medium;
  return colors.critical;
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

export function SecurityScore({ score, size = 'md' }: SecurityScoreProps) {
  const scoreColor = getScoreColor(score);
  const scoreLabel = getScoreLabel(score);

  const dimensions = {
    sm: { container: 80, fontSize: fontSize.xl, label: fontSize.xs },
    md: { container: 120, fontSize: fontSize.xxxl, label: fontSize.sm },
    lg: { container: 160, fontSize: 48, label: fontSize.md },
  };

  const dim = dimensions[size];

  return (
    <View style={[styles.container, { width: dim.container, height: dim.container }]}>
      <View style={[styles.circle, { borderColor: scoreColor }]}>
        <Text style={[styles.score, { fontSize: dim.fontSize, color: scoreColor }]}>{score}</Text>
        <Text style={[styles.label, { fontSize: dim.label }]}>{scoreLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.full,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  score: {
    fontWeight: 'bold',
  },
  label: {
    color: colors.textMuted,
    marginTop: spacing.xs / 2,
  },
});
