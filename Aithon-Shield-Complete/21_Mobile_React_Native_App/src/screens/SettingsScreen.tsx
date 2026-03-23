import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components';
import { colors, fontSize, spacing, borderRadius } from '../theme/colors';

interface SettingItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}

function SettingItem({ icon, label, value, onPress, danger }: SettingItemProps) {
  return (
    <TouchableOpacity style={styles.settingItem} onPress={onPress} disabled={!onPress}>
      <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>
        <Ionicons name={icon} size={20} color={danger ? colors.error : colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>{label}</Text>
        {value && <Text style={styles.settingValue}>{value}</Text>}
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

export function SettingsScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.firstName?.[0]?.toUpperCase() || 'U'}
              {user?.lastName?.[0]?.toUpperCase() || ''}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            {user?.company && (
              <Text style={styles.profileCompany}>{user.company}</Text>
            )}
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Account</Text>
        <Card style={styles.section}>
          <SettingItem
            icon="person-outline"
            label="Edit Profile"
            onPress={() => {}}
          />
          <SettingItem
            icon="lock-closed-outline"
            label="Change Password"
            onPress={() => {}}
          />
          <SettingItem
            icon="notifications-outline"
            label="Notifications"
            value="Enabled"
            onPress={() => {}}
          />
        </Card>

        <Text style={styles.sectionTitle}>Security</Text>
        <Card style={styles.section}>
          <SettingItem
            icon="finger-print-outline"
            label="Biometric Login"
            value="Disabled"
            onPress={() => {}}
          />
          <SettingItem
            icon="key-outline"
            label="Two-Factor Auth"
            value="Not set up"
            onPress={() => {}}
          />
          <SettingItem
            icon="time-outline"
            label="Session Timeout"
            value="30 minutes"
            onPress={() => {}}
          />
        </Card>

        <Text style={styles.sectionTitle}>App</Text>
        <Card style={styles.section}>
          <SettingItem
            icon="moon-outline"
            label="Theme"
            value="Dark"
            onPress={() => {}}
          />
          <SettingItem
            icon="information-circle-outline"
            label="About"
            value="v1.0.0"
            onPress={() => {}}
          />
          <SettingItem
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => {}}
          />
        </Card>

        <Card style={[styles.section, styles.dangerSection]}>
          <SettingItem
            icon="log-out-outline"
            label="Sign Out"
            onPress={handleLogout}
            danger
          />
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
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.white,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  profileEmail: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  profileCompany: {
    fontSize: fontSize.sm,
    color: colors.accent,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    padding: 0,
    overflow: 'hidden',
  },
  dangerSection: {
    marginTop: spacing.lg,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingIconDanger: {
    backgroundColor: colors.error + '20',
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  settingLabelDanger: {
    color: colors.error,
  },
  settingValue: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
});
