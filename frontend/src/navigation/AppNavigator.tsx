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
        <Tab.Screen name="Admin" component={SuperAdminScreen} />
      ) : (
        <>
          <Tab.Screen name="Home" component={DashboardScreen} />
          <Tab.Screen name="Leads" component={LeadListScreen} />
        </>
      )}
    </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  const { token, user, isLoading } = useAuth();

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
        {token ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="LeadDetail" component={LeadDetailScreen} />
            <Stack.Screen name="AddLead" component={AddLeadScreen} />
            <Stack.Screen name="PasswordChange" component={PasswordChangeScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
