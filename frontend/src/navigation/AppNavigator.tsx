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

const MainTabs = () => {
  const { user } = useAuth();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 0,
          height: 70,
          paddingBottom: 12,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          marginBottom: 4,
        },
      }}
    >
      {user?.role === 'superadmin' ? (
        <>
          <Tab.Screen name="Agencies" component={SuperAdminScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
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
