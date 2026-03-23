import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { scansApi } from '../api/scans';
import { Card, Badge } from '../components';
import { colors, fontSize, spacing, borderRadius } from '../theme/colors';
import { Finding, Severity } from '../types';

type FilterSeverity = 'all' | Severity;

export function FindingsScreen({ navigation }: any) {
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>('all');

  const { data: findings, isLoading, refetch } = useQuery({
    queryKey: ['findings'],
    queryFn: () => scansApi.getFindings(),
  });

  const filteredFindings = findings?.filter((finding) => {
    if (severityFilter === 'all') return true;
    return finding.severity === severityFilter;
  }) || [];

  const getSeverityBadgeVariant = (severity: Severity) => {
    const variants: Record<Severity, 'critical' | 'high' | 'medium' | 'low'> = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low',
    };
    return variants[severity];
  };

  const filters: { key: FilterSeverity; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'critical', label: 'Critical' },
    { key: 'high', label: 'High' },
    { key: 'medium', label: 'Medium' },
    { key: 'low', label: 'Low' },
  ];

  const renderFinding = ({ item }: { item: Finding }) => (
    <Card
      style={styles.findingCard}
      onPress={() => navigation.navigate('FindingDetail', { findingId: item.id })}
    >
      <View style={styles.findingHeader}>
        <Badge variant={getSeverityBadgeVariant(item.severity)}>
          {item.severity.toUpperCase()}
        </Badge>
        <Badge variant={item.status === 'fixed' ? 'success' : 'outline'}>
          {item.status}
        </Badge>
      </View>
      <Text style={styles.findingTitle}>{item.title}</Text>
      <Text style={styles.findingDescription} numberOfLines={2}>
        {item.description}
      </Text>
      {item.filePath && (
        <View style={styles.fileInfo}>
          <Ionicons name="document-outline" size={14} color={colors.textMuted} />
          <Text style={styles.filePath} numberOfLines={1}>
            {item.filePath}
            {item.lineNumber && `:${item.lineNumber}`}
          </Text>
        </View>
      )}
      <View style={styles.findingMeta}>
        {item.cweId && (
          <Text style={styles.metaText}>{item.cweId}</Text>
        )}
        {item.owaspCategory && (
          <Text style={styles.metaText}>{item.owaspCategory}</Text>
        )}
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Findings</Text>
        <Text style={styles.count}>{filteredFindings.length} issues</Text>
      </View>

      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filters}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                severityFilter === item.key && styles.filterChipActive,
              ]}
              onPress={() => setSeverityFilter(item.key)}
            >
              <Text
                style={[
                  styles.filterText,
                  severityFilter === item.key && styles.filterTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={filteredFindings}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderFinding}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={64} color={colors.success} />
            <Text style={styles.emptyTitle}>No findings</Text>
            <Text style={styles.emptyText}>
              {severityFilter === 'all'
                ? 'Run a security scan to detect vulnerabilities'
                : `No ${severityFilter} severity issues found`}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  count: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  filterContainer: {
    marginBottom: spacing.md,
  },
  filterList: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginRight: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  filterTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  findingCard: {
    marginBottom: spacing.sm,
  },
  findingHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  findingTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  findingDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  filePath: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  findingMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  metaText: {
    fontSize: fontSize.xs,
    color: colors.accent,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
