import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

type ProfileVisibility = 'public' | 'private';
type LocationVisibility = 'exact' | 'approximate' | 'hidden';

type PrivacySettings = {
  profileVisibility: ProfileVisibility;
  locationVisibility: LocationVisibility;
};

const SETTINGS_KEY = 'reelwall_privacy_settings';

export default function PrivacyScreen() {
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    profileVisibility: 'private',
    locationVisibility: 'hidden',
  });

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) {
        setPrivacySettings(JSON.parse(saved));
      }
    } catch (error) {
      console.log('Privacy load error:', error);
    }
  };

  const saveSettings = async (next: PrivacySettings) => {
    try {
      setPrivacySettings(next);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch (error) {
      console.log('Privacy save error:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>PRIVACY</Text>
        <Text style={styles.title}>Your Settings</Text>
        <Text style={styles.subtitle}>
          Control how your wall and catch locations appear.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profile Visibility</Text>
          <View style={styles.optionRow}>
            <OptionButton
              label="Public"
              active={privacySettings.profileVisibility === 'public'}
              onPress={() =>
                saveSettings({
                  ...privacySettings,
                  profileVisibility: 'public',
                })
              }
            />
            <OptionButton
              label="Private"
              active={privacySettings.profileVisibility === 'private'}
              onPress={() =>
                saveSettings({
                  ...privacySettings,
                  profileVisibility: 'private',
                })
              }
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location Visibility</Text>
          <View style={styles.optionWrap}>
            <OptionButton
              label="Exact"
              active={privacySettings.locationVisibility === 'exact'}
              onPress={() =>
                saveSettings({
                  ...privacySettings,
                  locationVisibility: 'exact',
                })
              }
            />
            <OptionButton
              label="Approx."
              active={privacySettings.locationVisibility === 'approximate'}
              onPress={() =>
                saveSettings({
                  ...privacySettings,
                  locationVisibility: 'approximate',
                })
              }
            />
            <OptionButton
              label="Hidden"
              active={privacySettings.locationVisibility === 'hidden'}
              onPress={() =>
                saveSettings({
                  ...privacySettings,
                  locationVisibility: 'hidden',
                })
              }
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OptionButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.optionButton, active && styles.optionButtonActive]}
    >
      <Text
        style={[styles.optionButtonText, active && styles.optionButtonTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#081E33',
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  eyebrow: {
    color: '#F2C94C',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: {
    color: '#F5F7FA',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: '#A5B3C2',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#102C47',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  cardTitle: {
    color: '#F5F7FA',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    backgroundColor: '#081E33',
    borderWidth: 1,
    borderColor: '#294B6D',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  optionButtonActive: {
    backgroundColor: '#F2C94C',
    borderColor: '#F2C94C',
  },
  optionButtonText: {
    color: '#F5F7FA',
    fontWeight: '700',
    fontSize: 13,
  },
  optionButtonTextActive: {
    color: '#0A2540',
  },
});