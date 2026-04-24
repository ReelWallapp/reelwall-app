import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ensureProfileExistsAndSyncLocal } from '../../lib/profile-sync';
import { supabase } from '../../lib/supabase';

type CatchItem = {
  id: string;
  isPersonalBest?: boolean;
};

type PrivacySettings = {
  profileVisibility: 'public' | 'private';
  locationVisibility: LocationVisibility;
};

type LocationVisibility = 'exact' | 'approximate' | 'hidden';

const STORAGE_KEY = 'reelwall_catches';
const PROFILE_NAME_KEY = 'reelwall_profile_name';
const PROFILE_PHOTO_KEY = 'reelwall_profile_photo';
const SETTINGS_KEY = 'reelwall_privacy_settings';
const PROFILE_LOCATION_KEY = 'reelwall_profile_location';
const PROFILE_BOAT_KEY = 'reelwall_profile_boat';
const PROFILE_SPECIES_KEY = 'reelwall_profile_species';

const PRIMARY = '#F2C94C';

export default function Profile() {
  const [catchCount, setCatchCount] = useState(0);
  const [pbCount, setPbCount] = useState(0);
  const [collectionCount, setCollectionCount] = useState(0);

  const [name, setName] = useState('Your ReelWall');
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);

  const [location, setLocation] = useState('');
  const [boat, setBoat] = useState('');
  const [species, setSpecies] = useState('');

  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    profileVisibility: 'private',
    locationVisibility: 'hidden',
  });

  const [showPrivacyScreen, setShowPrivacyScreen] = useState(false);

  const loadStats = async () => {
    try {
      const savedCatches = await AsyncStorage.getItem(STORAGE_KEY);
      const catches: CatchItem[] = savedCatches ? JSON.parse(savedCatches) : [];

      setCatchCount(catches.length);
      setPbCount(catches.filter((c) => c.isPersonalBest).length);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setCollectionCount(0);
        return;
      }

      const { count, error: collectionsError } = await supabase
        .from('collections')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (collectionsError) {
        console.log('Profile collections count load error:', collectionsError);
        setCollectionCount(0);
        return;
      }

      setCollectionCount(count || 0);
    } catch (error) {
      console.log('Profile stats load error:', error);
    }
  };

  const loadName = async () => {
    try {
      const savedName = await AsyncStorage.getItem(PROFILE_NAME_KEY);
      if (savedName) {
        setName(savedName);
      }
    } catch (error) {
      console.log('Profile name load error:', error);
    }
  };

  const loadPhoto = async () => {
    try {
      const savedPhoto = await AsyncStorage.getItem(PROFILE_PHOTO_KEY);
      if (savedPhoto) {
        setProfilePhotoUri(savedPhoto);
      }
    } catch (error) {
      console.log('Profile photo load error:', error);
    }
  };

  const loadProfileDetails = async () => {
    try {
      const savedLocation = await AsyncStorage.getItem(PROFILE_LOCATION_KEY);
      const savedBoat = await AsyncStorage.getItem(PROFILE_BOAT_KEY);
      const savedSpecies = await AsyncStorage.getItem(PROFILE_SPECIES_KEY);

      if (savedLocation) setLocation(savedLocation);
      if (savedBoat) setBoat(savedBoat);
      if (savedSpecies) setSpecies(savedSpecies);
    } catch (error) {
      console.log('Profile details load error:', error);
    }
  };

  const loadPrivacy = async () => {
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) {
        setPrivacySettings(JSON.parse(saved));
      }
    } catch (error) {
      console.log('Privacy settings load error:', error);
    }
  };

  const loadProfileFromSupabase = async () => {
    try {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data?.user) {
        console.log('No logged in user yet — skipping profile load');
        return;
      }

      const user = data.user;

      await ensureProfileExistsAndSyncLocal();

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.log('Supabase profile load error:', profileError);
        return;
      }

      setName(
        profile.display_name ||
          profile.username ||
          profile.name ||
          'Your ReelWall'
      );

      setProfilePhotoUri(
        profile.avatar_url || profile.profile_photo || profile.photo_url || null
      );

      setLocation(profile.location || profile.profile_location || '');
      setBoat(profile.boat || profile.boat_name || profile.profile_boat || '');
      setSpecies(
        profile.species ||
          profile.target_species ||
          profile.profile_species ||
          ''
      );
    } catch (error) {
      console.log('loadProfileFromSupabase error:', error);
    }
  };

  const savePrivacySettings = async (nextSettings: PrivacySettings) => {
    try {
      setPrivacySettings(nextSettings);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    } catch (error) {
      console.log('Privacy save error:', error);
    }
  };

  const loadAll = async () => {
    await loadStats();
    await loadPrivacy();

    // Load local first so UI feels immediate
    await loadName();
    await loadPhoto();
    await loadProfileDetails();

    // Then refresh from Supabase
    await loadProfileFromSupabase();
  };

  useEffect(() => {
    loadAll();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser();

              if (!user) return;

              // Temporary version: signs out and clears local data.
              // Real backend deletion should be done with a secure Supabase Edge Function.
              await supabase.auth.signOut();
              await AsyncStorage.clear();
              router.replace('/login');
            } catch (error) {
              console.log('Delete account error:', error);
            }
          },
        },
      ]
    );
  };

  const getLocationLabel = () => {
    if (privacySettings.locationVisibility === 'exact') return 'Exact';
    if (privacySettings.locationVisibility === 'approximate') return 'Approximate';
    return 'Hidden';
  };

  if (showPrivacyScreen) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.privacyHeaderRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setShowPrivacyScreen(false)}
              activeOpacity={0.85}
            >
              <Ionicons name="chevron-back" size={18} color="#F5F7FA" />
              <Text style={styles.backButtonText}>Profile</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.privacyEyebrow}>PRIVACY</Text>
          <Text style={styles.privacyTitle}>Privacy Settings</Text>
          <Text style={styles.privacySubtitle}>
            Control how your wall and catch details appear.
          </Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Profile Visibility</Text>

            <View style={styles.segmentedWrap}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.segmentButton,
                  privacySettings.profileVisibility === 'public' &&
                    styles.segmentButtonActive,
                ]}
                onPress={() =>
                  savePrivacySettings({
                    ...privacySettings,
                    profileVisibility: 'public',
                  })
                }
              >
                <Text
                  style={[
                    styles.segmentButtonText,
                    privacySettings.profileVisibility === 'public' &&
                      styles.segmentButtonTextActive,
                  ]}
                >
                  Public
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.segmentButton,
                  privacySettings.profileVisibility === 'private' &&
                    styles.segmentButtonActive,
                ]}
                onPress={() =>
                  savePrivacySettings({
                    ...privacySettings,
                    profileVisibility: 'private',
                  })
                }
              >
                <Text
                  style={[
                    styles.segmentButtonText,
                    privacySettings.profileVisibility === 'private' &&
                      styles.segmentButtonTextActive,
                  ]}
                >
                  Private
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Location Visibility</Text>
            <Text style={styles.infoText}>
              Choose how much location detail appears on your wall.
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.optionCard,
                privacySettings.locationVisibility === 'exact' &&
                  styles.optionCardActive,
              ]}
              onPress={() =>
                savePrivacySettings({
                  ...privacySettings,
                  locationVisibility: 'exact',
                })
              }
            >
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionTitle}>Exact</Text>
                <Text style={styles.optionText}>
                  Show the full saved location when available.
                </Text>
              </View>
              {privacySettings.locationVisibility === 'exact' && (
                <Ionicons name="checkmark-circle" size={22} color={PRIMARY} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.optionCard,
                privacySettings.locationVisibility === 'approximate' &&
                  styles.optionCardActive,
              ]}
              onPress={() =>
                savePrivacySettings({
                  ...privacySettings,
                  locationVisibility: 'approximate',
                })
              }
            >
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionTitle}>Approximate</Text>
                <Text style={styles.optionText}>
                  Show only the broader area or region.
                </Text>
              </View>
              {privacySettings.locationVisibility === 'approximate' && (
                <Ionicons name="checkmark-circle" size={22} color={PRIMARY} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.optionCard,
                privacySettings.locationVisibility === 'hidden' &&
                  styles.optionCardActive,
              ]}
              onPress={() =>
                savePrivacySettings({
                  ...privacySettings,
                  locationVisibility: 'hidden',
                })
              }
            >
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionTitle}>Hidden</Text>
                <Text style={styles.optionText}>
                  Do not show location on your wall.
                </Text>
              </View>
              {privacySettings.locationVisibility === 'hidden' && (
                <Ionicons name="checkmark-circle" size={22} color={PRIMARY} />
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerSpacer} />
          <TouchableOpacity
            style={styles.editIconButton}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.85}
          >
            <Ionicons name="pencil" size={18} color={PRIMARY} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            {profilePhotoUri ? (
              <Image source={{ uri: profilePhotoUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>👤</Text>
            )}
          </View>

          <Text style={styles.profileName}>{name}</Text>
          <Text style={styles.profileSub}>Digital Trophy Wall</Text>

          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.85}
          >
            <Text style={styles.editProfileButtonText}>Edit Profile</Text>
          </TouchableOpacity>

          
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{catchCount}</Text>
            <Text style={styles.statLabel}>Catches</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{pbCount}</Text>
            <Text style={styles.statLabel}>PBs</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{collectionCount}</Text>
            <Text style={styles.statLabel}>Collections</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>About the Angler</Text>

          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Location</Text>
            <Text style={styles.profileValue}>{location || 'Not set'}</Text>
          </View>

          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Boat</Text>
            <Text style={styles.profileValue}>{boat || 'Not set'}</Text>
          </View>

          <View style={styles.profileRowNoBorder}>
            <Text style={styles.profileLabel}>Most Targeted Species</Text>
            <Text style={styles.profileValue}>{species || 'Not set'}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Privacy</Text>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.linkRow}
            onPress={() => setShowPrivacyScreen(true)}
          >
            <View style={styles.linkTextWrap}>
              <Text style={styles.linkTitle}>Privacy Settings</Text>
              <Text style={styles.linkSubtitle}>
                {privacySettings.profileVisibility === 'public' ? 'Public' : 'Private'} •{' '}
                {getLocationLabel()} location
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#A5B3C2" />
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Your ReelWall</Text>
          <Text style={styles.infoText}>
            Build your identity here with a profile photo, name, catches, and curated collections.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#081E33',
  },
  content: {
    padding: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerSpacer: {
    width: 40,
  },
  editIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#102C47',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 122,
    height: 122,
    borderRadius: 61,
    backgroundColor: '#102C47',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 46,
  },
  profileName: {
    color: '#F5F7FA',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  profileSub: {
    color: '#A5B3C2',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 16,
  },
  editProfileButton: {
    backgroundColor: '#163554',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  editProfileButtonText: {
    color: '#F5F7FA',
    fontWeight: '700',
    fontSize: 14,
  },
  deleteAccountButton: {
    marginTop: 10,
    backgroundColor: '#2A0F0F',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.35)',
  },
  deleteAccountButtonText: {
    color: '#FF6B6B',
    fontWeight: '700',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#102C47',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  statNumber: {
    color: '#F2C94C',
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    color: '#A5B3C2',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: '#102C47',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  infoTitle: {
    color: '#F5F7FA',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  infoText: {
    color: '#A5B3C2',
    fontSize: 15,
    lineHeight: 22,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#081E33',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  linkTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  linkTitle: {
    color: '#F5F7FA',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  linkSubtitle: {
    color: '#A5B3C2',
    fontSize: 13,
    lineHeight: 18,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  profileRowNoBorder: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  profileLabel: {
    color: '#A5B3C2',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    paddingRight: 12,
  },
  profileValue: {
    color: '#F5F7FA',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  privacyHeaderRow: {
    marginBottom: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#102C47',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    gap: 4,
  },
  backButtonText: {
    color: '#F5F7FA',
    fontSize: 14,
    fontWeight: '700',
  },
  privacyEyebrow: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  privacyTitle: {
    color: '#F5F7FA',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 10,
  },
  privacySubtitle: {
    color: '#A5B3C2',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  segmentedWrap: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentButton: {
    flex: 1,
    backgroundColor: '#081E33',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentButtonActive: {
    borderColor: PRIMARY,
    backgroundColor: '#12314F',
  },
  segmentButtonText: {
    color: '#D7DEE6',
    fontSize: 14,
    fontWeight: '700',
  },
  segmentButtonTextActive: {
    color: PRIMARY,
  },
  optionCard: {
    backgroundColor: '#081E33',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionCardActive: {
    borderColor: PRIMARY,
    backgroundColor: '#12314F',
  },
  optionTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  optionTitle: {
    color: '#F5F7FA',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  optionText: {
    color: '#A5B3C2',
    fontSize: 13,
    lineHeight: 18,
  },
});