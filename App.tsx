import 'react-native-get-random-values';
import 'react-native-gesture-handler';

import { useRef, useCallback, useMemo, useEffect } from 'react';
import { initNotifications } from './useNotifications';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, Pressable, Animated } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { House, Chat, Users, UserCircle } from 'phosphor-react-native';

import { PreferencesProvider } from './PreferencesContext';
import { useColors } from './colors';
import { RelayProvider } from './RelayContext';
import { NostrProvider, useNostr } from './NostrContext';
import WelcomeScreen from './WelcomeScreen';
import SignUpScreen from './SignUpScreen';
import SignInScreen from './SignInScreen';
import ChatScreen from './ChatScreen';
import ChatDetailScreen from './ChatDetailScreen';
import GroupListScreen from './GroupListScreen';
import GroupDetailScreen from './GroupDetailScreen';
import ContactsScreen from './ContactsScreen';
import SettingsScreen from './SettingsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();



function TabBarButton({ children, onPress, onLongPress, ...rest }: any) {
  const opacity = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0.7,
      duration: 50,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  const handlePressOut = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      <Animated.View style={{ opacity, flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const c = useColors();

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: c.bg,
          shadowOpacity: 0,
          elevation: 0,
        },
        headerTitleStyle: {
          color: c.text,
          fontSize: 18,
          fontWeight: '600',
        },
        headerTintColor: c.text,
        tabBarStyle: {
          backgroundColor: c.tabBarBg,
          borderTopWidth: 0,
          elevation: 0,
          paddingBottom: insets.bottom,
          height: 60 + insets.bottom,
        },
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        tabBarButton: (props) => <TabBarButton {...props} />,
      }}
    >
      <Tab.Screen
        name="Home"
        component={ChatScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <House size={24} color={color} weight="fill" />,
        }}
      />
      <Tab.Screen
        name="Groups"
        component={GroupListScreen}
        options={{
          title: 'Groups',
          tabBarIcon: ({ color }) => <Chat size={24} color={color} weight="fill" />,
        }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{
          title: 'Contacts',
          tabBarIcon: ({ color }) => <Users size={24} color={color} weight="fill" />,
        }}
      />
      <Tab.Screen
        name="You"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'You',
          headerShown: false,
          tabBarIcon: ({ color }) => <UserCircle size={24} color={color} weight="fill" />,
        }}
      />
    </Tab.Navigator>
  );
}

function NavigatorWithAuth() {
  const { isAuthenticated, loaded } = useNostr();
  const c = useColors();

  const navTheme = useMemo(() => {
    const isDark = c.bg === '#000';
    return {
      ...DefaultTheme,
      dark: isDark,
      colors: {
        ...DefaultTheme.colors,
        primary: c.text,
        background: c.bg,
        card: c.bgCard,
        text: c.text,
        border: c.border,
      },
    };
  }, [c]);

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: c.textMuted, fontSize: 14 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName={isAuthenticated ? 'Chat' : 'Welcome'}
        screenOptions={{
          cardStyle: {
            backgroundColor: c.bg,
          },
          cardOverlayEnabled: true,
          cardOverlay: () => <View style={{ flex: 1, backgroundColor: c.bg }} />,
          headerStyle: {
            backgroundColor: c.bg,
          },
          headerShadowVisible: false,
          headerTitleStyle: {
            color: c.text,
            fontSize: 18,
            fontWeight: '600',
          },
          headerBackTitleStyle: {
            color: c.text,
          },
          headerTintColor: c.text,
          gestureEnabled: false,
        }}
      >
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="SignUp" 
          component={SignUpScreen}
          options={{ headerShown: true, title: 'Sign Up' }}
        />
        <Stack.Screen 
          name="SignIn" 
          component={SignInScreen}
          options={{ headerShown: true, title: 'Sign In' }}
        />
        <Stack.Screen 
          name="Chat" 
          component={MainTabs}
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="ChatDetail"
          component={ChatDetailScreen}
          options={({ route }: any) => ({
            title: route.params?.pubkey
              ? (route.params.pubkey as string).slice(0, 12) + '...'
              : 'DM',
          })}
        />
        <Stack.Screen
          name="GroupDetail"
          component={GroupDetailScreen}
          options={{ title: 'Group' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function App() {
  useEffect(() => { initNotifications(); }, []);

  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <RelayProvider>
          <NostrProvider>
            <NavigatorWithAuth />
          </NostrProvider>
        </RelayProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}

export default App;
