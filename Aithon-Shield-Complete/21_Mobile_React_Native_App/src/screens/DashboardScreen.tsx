import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { scansApi } from '../api/scans';
import { Card, Badge, SecurityScore } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { colors, fontSize, spacing } from '../theme/colors';

export function DashboardScreen() {
  const { user } = useAuth();
  
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: scansApi.getDashboardStats,
  });

  const { data: mvpScans } = useQuery({
    queryKey: ['mvp-scans'],
    queryFn: scansApi.getMvpScans,
  });

  const { data: webScans } = useQuery({
    queryKey: ['web-scans'],
    queryFn: scansApi.getWebScans,
  });

  const { data: mobileScans } = useQuery({
    queryKey: ['mobile-scans'],
    queryFn: scansApi.getMobileScans,
  });

  const totalScans = (mvpScans?.length || 0) + (webScans?.length || 0) + (mobileScans?.length || 0);
  const activeScans = [
    ...(mvpScans?.filter(s => s.scanStatus === 'scanning') || []),
    ...(webScans?.filter(s => s.scanStatus === 'scanning') || []),
    ...(mobileScans?.filter(s => s.scanStatus === 'scanning') || []),
  ].length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.firstName || 'User'}</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
          </View>
        </View>

        <Card style={styles.scoreCard}>
          <View style={styles.scoreContent}>
            <SecurityScore score={stats?.securityScore || 0} size="lg" />
            <View style={styles.scoreInfo}>
              <Text style={styles.scoreTitle}>Security Score</Text>
              <Text style={styles.scoreDescription}>
                Based on {stats?.totalFindings || 0} findings across {totalScans} scans
              </Text>
            </View>
          </View>
        </Card>

        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
            <Text style={styles.statValue}>{totalScans}</Text>
            <Text style={styles.statLabel}>Total Scans</Text>
          </Card>
          <Card style={styles.statCard}>
            <Ionicons name="sync" size={24} color={colors.accent} />
            <Text style={styles.statValue}>{activeScans}</Text>
            <Text style={styles.statLabel}>Active Scans</Text>
          </Card>
        </View>

        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Ionicons name="bug" size={24} color={colors.critical} />
            <Text style={styles.statValue}>{stats?.criticalFindings || 0}</Text>
            <Text style={styles.statLabel}>Critical</Text>
          </Card>
          <Card style={styles.statCard}>
            <Ionicons name="warning" size={24} color={colors.high} />
            <Text style={styles.statValue}>{stats?.highFindings || 0}</Text>
            <Text style={styles.statLabel}>High</Text>
          </Card>
        </View>

        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Ionicons name="alert-circle" size={24} color={colors.medium} />
            <Text style={styles.statValue}>{stats?.mediumFindings || 0}</Text>
            <Text style={styles.statLabel}>Medium</Text>
          </Card>
          <Card style={styles.statCard}>
            <Ionicons name="information-circle" size={24} color={colors.low} />
            <Text style={styles.statValue}>{stats?.lowFindings || 0}</Text>
            <Text style={styles.statLabel}>Low</Text>
          </Card>
        </View>

        <Card style={styles.fixedCard}>
          <View style={styles.fixedContent}>
            <Ionicons name="checkmark-circle" size={32} color={colors.success} />
            <View style={styles.fixedInfo}>
              <Text style={styles.fixedValue}>{stats?.fixedFindings || 0}</Text>
              <Text style={styles.fixedLabel}>Issues Fixed</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  userName: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCard: {
    marginBottom: spacing.md,
  },
  scoreContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  scoreInfo: {
    flex: 1,
  },
  scoreTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  scoreDescription: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs / 2,
  },
  fixedCard: {
    marginTop: spacing.sm,
  },
  fixedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fixedInfo: {
    flex: 1,
  },
  fixedValue: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.success,
  },
  fixedLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
});
