import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

function CaptureTabButton({ children, onPress }: any) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.9,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    onPress?.();
  };

  return (
    <TouchableWithoutFeedback
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Capture a moment"
      accessibilityHint="Opens the camera or upload screen"
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
              name={focused ? 'trophy' : 'trophy-outline'}
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
              name={focused ? 'apps' : 'apps-outline'}
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
              name={focused ? 'layers' : 'layers-outline'}
              size={20}
              color={color}
              style={styles.tabIcon}
            />
          ),
        }}
      />
<Tabs.Screen
  name="vault/index"
  options={{
    title: 'Vault',
    tabBarIcon: ({ color, focused }) => (
      <Ionicons
        name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'}
        size={20}
        color={color}
      />
    ),
  }}
/>



<Tabs.Screen
  name="vault/[recordId]/qr"
  options={{
    href: null,
  }}
/>
<Tabs.Screen
  name="vault/[recordId]/index"
  options={{ href: null }}
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
    height: Platform.OS === 'ios' ? 88 : 78,
    paddingBottom: Platform.OS === 'ios' ? 12 : 8,
    paddingTop: 10,
    paddingHorizontal: 6,
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
    width: 76,
  },

  captureButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#F2C94C',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F2C94C',
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },

  tabIcon: {
    marginBottom: -2,
  },
});