import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { useRef } from 'react';
import {
  Animated,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

function CaptureTabButton({ children, onPress }: any) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  };

  return (
    <TouchableWithoutFeedback
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={handlePress}
    >
      <Animated.View style={[styles.captureWrapper, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarActiveTintColor: '#F2C94C',
        tabBarInactiveTintColor: '#8FA3B8',
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mounts',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'earth' : 'earth-outline'}
              size={20}
              color={color}
              style={styles.tabIcon}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="wall"
        options={{
          title: 'Wall',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'fish' : 'fish-outline'}
              size={20}
              color={color}
              style={styles.tabIcon}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="capture"
        options={{
          title: '',
          tabBarButton: (props) => (
            <CaptureTabButton onPress={props.onPress}>
              <View style={styles.captureButton}>
                <Ionicons name="camera" size={32} color="#0A2540" />
              </View>
            </CaptureTabButton>
          ),
        }}
      />

      <Tabs.Screen
        name="collections"
        options={{
          title: 'Collections',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'albums' : 'albums-outline'}
              size={20}
              color={color}
              style={styles.tabIcon}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="vault"
        options={{
          title: 'Vault',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'}
              size={20}
              color={color}
              style={styles.tabIcon}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="privacy"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0B2239',
    borderTopColor: '#163554',
    height: 88,
    paddingBottom: 12,
    paddingTop: 10,
    paddingHorizontal: 8, // ✅ reduced for better spacing
  },

  tabBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },

  captureWrapper: {
    top: -18,
    justifyContent: 'center',
    alignItems: 'center',
    width: 76, // gives center button breathing room
  },

  captureButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#F2C94C',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F2C94C',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },

  tabIcon: {
    marginBottom: -2,
  },
});