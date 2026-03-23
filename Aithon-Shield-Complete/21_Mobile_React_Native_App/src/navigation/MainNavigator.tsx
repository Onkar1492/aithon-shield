import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { DashboardScreen, ScansScreen, FindingsScreen, SettingsScreen } from '../screens';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Scans':
              iconName = focused ? 'shield' : 'shield-outline';
              break;
            case 'Findings':
              iconName = focused ? 'bug' : 'bug-outline';
              break;
            case 'Settings':
              iconName = focused ? 'settings' : 'settings-outline';
              break;
            default:
              iconName = 'home';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Scans" component={ScansScreen} />
      <Tab.Screen name="Findings" component={FindingsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen 
        name="ScanDetail" 
        component={ScanDetailPlaceholder}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen 
        name="FindingDetail" 
        component={FindingDetailPlaceholder}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen 
        name="NewScan" 
        component={NewScanPlaceholder}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}

// Placeholder screens - implement these as needed
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function ScanDetailPlaceholder({ navigation, route }: any) {
  return (
    <SafeAreaView style={styles.placeholder}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>
      <Ionicons name="shield-checkmark" size={64} color={colors.primary} />
      <Text style={styles.placeholderTitle}>Scan Details</Text>
      <Text style={styles.placeholderText}>
        Scan ID: {route.params?.scanId}
      </Text>
      <Text style={styles.placeholderText}>
        Type: {route.params?.scanType}
      </Text>
    </SafeAreaView>
  );
}

function FindingDetailPlaceholder({ navigation, route }: any) {
  return (
    <SafeAreaView style={styles.placeholder}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>
      <Ionicons name="bug" size={64} color={colors.critical} />
      <Text style={styles.placeholderTitle}>Finding Details</Text>
      <Text style={styles.placeholderText}>
        Finding ID: {route.params?.findingId}
      </Text>
    </SafeAreaView>
  );
}

function NewScanPlaceholder({ navigation, route }: any) {
  return (
    <SafeAreaView style={styles.placeholder}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="close" size={24} color={colors.textPrimary} />
      </TouchableOpacity>
      <Ionicons name="add-circle" size={64} color={colors.primary} />
      <Text style={styles.placeholderTitle}>New Scan</Text>
      <Text style={styles.placeholderText}>
        Type: {route.params?.scanType}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 16,
  },
  placeholderText: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 8,
  },
});
