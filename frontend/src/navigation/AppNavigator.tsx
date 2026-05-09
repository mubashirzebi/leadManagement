import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { PasswordChangeScreen } from '../screens/PasswordChangeScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { LeadListScreen } from '../screens/LeadListScreen';
import { LeadDetailScreen } from '../screens/LeadDetailScreen';
import { AddLeadScreen } from '../screens/AddLeadScreen';
import { SuperAdminScreen } from '../screens/SuperAdminScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SuspendedScreen } from '../screens/SuspendedScreen';
import { View, Text } from 'react-native';
import { Colors } from '../theme/colors';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Firms:         { active: '🏢', inactive: '🏢' },
  'My Account':  { active: '👤', inactive: '👤' },
  Home:          { active: '⚡', inactive: '⚡' },
  Leads:         { active: '📋', inactive: '📋' },
  'My Leads':    { active: '📋', inactive: '📋' },
  Profile:       { active: '👤', inactive: '👤' },
};

const MainTabs = () => {
  const { user } = useAuth();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarIcon: ({ focused }) => {
          const icons = TAB_ICONS[route.name] ?? { active: '●', inactive: '○' };
          return (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 28,
              borderRadius: 8,
              backgroundColor: focused ? Colors.primary + '20' : 'transparent',
            }}>
              <Text style={{ fontSize: 16 }}>{focused ? icons.active : icons.inactive}</Text>
            </View>
          );
        },
      })}
    >
      {user?.role === 'superadmin' ? (
        <>
          <Tab.Screen name="Firms" component={SuperAdminScreen} />
          <Tab.Screen name="My Account" component={ProfileScreen} />
        </>
      ) : (
        <>
          <Tab.Screen name="Home" component={DashboardScreen} />
          <Tab.Screen name={user?.role === 'staff' ? 'My Leads' : 'Leads'} component={LeadListScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
        </>
      )}
    </Tab.Navigator>
  );
};


export const AppNavigator = () => {
  const { token, user, isLoading, isSuspended } = useAuth();

  console.log('[Nav] State', {
    hasToken: Boolean(token),
    isLoading,
    isSuspended,
    role: user?.role ?? null,
    mustChangePassword: user?.must_change_password ?? null,
    mustChangePasswordType: typeof user?.must_change_password,
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: Colors.text }}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isSuspended ? (
          <Stack.Screen name="Suspended" component={SuspendedScreen} />
        ) : token ? (
          user?.must_change_password ? (
            <Stack.Screen name="PasswordChange" component={PasswordChangeScreen} />
          ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="LeadDetail" component={LeadDetailScreen} />
            <Stack.Screen name="AddLead" component={AddLeadScreen} />
            <Stack.Screen name="PasswordChange" component={PasswordChangeScreen} />
          </>
          )
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
