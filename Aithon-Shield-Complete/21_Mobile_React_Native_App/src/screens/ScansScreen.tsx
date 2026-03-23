import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { scansApi } from '../api/scans';
import { ScanCard, Button } from '../components';
import { colors, fontSize, spacing, borderRadius } from '../theme/colors';
import { MvpScan, WebScan, MobileScan } from '../types';

type ScanTab = 'mvp' | 'web' | 'mobile';

export function ScansScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<ScanTab>('mvp');
  const queryClient = useQueryClient();

  const { data: mvpScans, isLoading: mvpLoading, refetch: refetchMvp } = useQuery({
    queryKey: ['mvp-scans'],
    queryFn: scansApi.getMvpScans,
  });

  const { data: webScans, isLoading: webLoading, refetch: refetchWeb } = useQuery({
    queryKey: ['web-scans'],
    queryFn: scansApi.getWebScans,
  });

  const { data: mobileScans, isLoading: mobileLoading, refetch: refetchMobile } = useQuery({
    queryKey: ['mobile-scans'],
    queryFn: scansApi.getMobileScans,
  });

  const startMvpScan = useMutation({
    mutationFn: scansApi.startMvpScan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mvp-scans'] }),
  });

  const startWebScan = useMutation({
    mutationFn: scansApi.startWebScan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['web-scans'] }),
  });

  const startMobileScan = useMutation({
    mutationFn: scansApi.startMobileScan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mobile-scans'] }),
  });

  const handleRefresh = () => {
    if (activeTab === 'mvp') refetchMvp();
    else if (activeTab === 'web') refetchWeb();
    else refetchMobile();
  };

  const handleScanPress = (scan: MvpScan | WebScan | MobileScan) => {
    navigation.navigate('ScanDetail', { scanId: scan.id, scanType: activeTab });
  };

  const handleStartScan = (id: number) => {
    if (activeTab === 'mvp') startMvpScan.mutate(id);
    else if (activeTab === 'web') startWebScan.mutate(id);
    else startMobileScan.mutate(id);
  };

  const getScans = () => {
    if (activeTab === 'mvp') return mvpScans || [];
    if (activeTab === 'web') return webScans || [];
    return mobileScans || [];
  };

  const isLoading = activeTab === 'mvp' ? mvpLoading : activeTab === 'web' ? webLoading : mobileLoading;

  const tabs: { key: ScanTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'mvp', label: 'MVP', icon: 'code-slash' },
    { key: 'web', label: 'Web', icon: 'globe' },
    { key: 'mobile', label: 'Mobile', icon: 'phone-portrait' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Security Scans</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('NewScan', { scanType: activeTab })}
        >
          <Ionicons name="add" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={18}
              color={activeTab === tab.key ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={getScans()}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ScanCard
            scan={item}
            scanType={activeTab}
            onPress={() => handleScanPress(item)}
            onStartScan={item.scanStatus === 'pending' ? () => handleStartScan(item.id) : undefined}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="shield-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No scans yet</Text>
            <Text style={styles.emptyText}>
              Create your first {activeTab.toUpperCase()} scan to get started
            </Text>
            <Button
              onPress={() => navigation.navigate('NewScan', { scanType: activeTab })}
              style={styles.emptyButton}
              icon={<Ionicons name="add" size={18} color={colors.white} />}
            >
              Create Scan
            </Button>
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tabActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
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
  emptyButton: {
    marginTop: spacing.lg,
  },
});
