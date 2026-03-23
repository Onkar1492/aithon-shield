import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, borderRadius, fontSize, spacing } from '../theme/colors';

type BadgeVariant = 'default' | 'critical' | 'high' | 'medium' | 'low' | 'success' | 'outline';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const variantStyles: Record<BadgeVariant, { background: string; text: string; border?: string }> = {
  default: { background: colors.surface, text: colors.textSecondary },
  critical: { background: '#FEF2F2', text: colors.critical },
  high: { background: '#FFFBEB', text: colors.high },
  medium: { background: '#FFF7ED', text: colors.medium },
  low: { background: '#F0FDF4', text: colors.low },
  success: { background: '#F0FDF4', text: colors.success },
  outline: { background: 'transparent', text: colors.textSecondary, border: colors.border },
};

export function Badge({ children, variant = 'default', style, textStyle }: BadgeProps) {
  const variantStyle = variantStyles[variant];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: variantStyle.background },
        variantStyle.border ? { borderWidth: 1, borderColor: variantStyle.border } : {},
        style,
      ]}
    >
      <Text style={[styles.text, { color: variantStyle.text }, textStyle]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
