import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { Badge } from './Badge';
import { Button } from './Button';
import { colors, fontSize, spacing } from '../theme/colors';
import { MvpScan, WebScan, MobileScan, ScanStatus } from '../types';

type Scan = MvpScan | WebScan | MobileScan;

interface ScanCardProps {
  scan: Scan;
  scanType: 'mvp' | 'web' | 'mobile';
  onPress: () => void;
  onStartScan?: () => void;
}

function getStatusBadge(status: ScanStatus) {
  switch (status) {
    case 'pending':
      return <Badge variant="outline">Pending</Badge>;
    case 'scanning':
      return <Badge variant="medium">Scanning...</Badge>;
    case 'completed':
      return <Badge variant="success">Completed</Badge>;
    case 'failed':
      return <Badge variant="critical">Failed</Badge>;
  }
}

function getScanIcon(scanType: string): keyof typeof Ionicons.glyphMap {
  switch (scanType) {
    case 'mvp':
      return 'code-slash';
    case 'web':
      return 'globe';
    case 'mobile':
      return 'phone-portrait';
    default:
      return 'shield';
  }
}

function getScanName(scan: Scan, scanType: string): string {
  if ('projectName' in scan) return scan.projectName;
  if ('appName' in scan) return scan.appName;
  return 'Unknown Scan';
}

function getScanSubtitle(scan: Scan, scanType: string): string {
  if ('platform' in scan && 'branch' in scan) {
    return `${scan.platform} • ${scan.branch}`;
  }
  if ('appUrl' in scan) {
    return scan.appUrl;
  }
  if ('appId' in scan) {
    return `${scan.platform} • ${scan.version}`;
  }
  return '';
}

export function ScanCard({ scan, scanType, onPress, onStartScan }: ScanCardProps) {
  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Ionicons name={getScanIcon(scanType)} size={24} color={colors.primary} />
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{getScanName(scan, scanType)}</Text>
          <Text style={styles.subtitle}>{getScanSubtitle(scan, scanType)}</Text>
        </View>
        {getStatusBadge(scan.scanStatus)}
      </View>

      {scan.scanStatus === 'completed' && (
        <View style={styles.findings}>
          <View style={styles.findingItem}>
            <Badge variant="critical">{scan.criticalCount}</Badge>
            <Text style={styles.findingLabel}>Critical</Text>
          </View>
          <View style={styles.findingItem}>
            <Badge variant="high">{scan.highCount}</Badge>
            <Text style={styles.findingLabel}>High</Text>
          </View>
          <View style={styles.findingItem}>
            <Badge variant="medium">{scan.mediumCount}</Badge>
            <Text style={styles.findingLabel}>Medium</Text>
          </View>
          <View style={styles.findingItem}>
            <Badge variant="low">{scan.lowCount}</Badge>
            <Text style={styles.findingLabel}>Low</Text>
          </View>
        </View>
      )}

      {scan.scanStatus === 'pending' && onStartScan && (
        <Button
          onPress={onStartScan}
          style={styles.startButton}
          icon={<Ionicons name="play" size={16} color={colors.white} />}
        >
          Start Scan
        </Button>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  findings: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  findingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  findingLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  startButton: {
    marginTop: spacing.md,
  },
});
