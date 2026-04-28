import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ensureProfileExistsAndSyncLocal } from '../lib/profile-sync';
import { supabase } from '../lib/supabase';

const PROFILE_NAME_KEY = 'reelwall_profile_name';
const PROFILE_PHOTO_KEY = 'reelwall_profile_photo';
const PROFILE_LOCATION_KEY = 'reelwall_profile_location';
const PROFILE_BOAT_KEY = 'reelwall_profile_boat';
const PROFILE_SPECIES_KEY = 'reelwall_profile_species';

export default function EditProfileScreen() {
  const [name, setName] = useState('');
  const [photoUri, setPhotoUri] = useState('');
  const [location, setLocation] = useState('');
  const [boat, setBoat] = useState('');
  const [species, setSpecies] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadLocalProfile = async () => {
    try {
      const savedName = await AsyncStorage.getItem(PROFILE_NAME_KEY);
      const savedPhoto = await AsyncStorage.getItem(PROFILE_PHOTO_KEY);
      const savedLocation = await AsyncStorage.getItem(PROFILE_LOCATION_KEY);
      const savedBoat = await AsyncStorage.getItem(PROFILE_BOAT_KEY);
      const savedSpecies = await AsyncStorage.getItem(PROFILE_SPECIES_KEY);

      setName(savedName || '');
      setPhotoUri(savedPhoto || '');
      setLocation(savedLocation || '');
      setBoat(savedBoat || '');
      setSpecies(savedSpecies || '');
    } catch (error) {
      console.log('Local load error:', error);
    }
  };

  const handleDeleteAccount = async () => {
  Alert.alert(
    'Delete Account',
    'This will permanently delete your account and all ReelWall data. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.functions.invoke('delete-account');

            if (error) {
              console.log('Delete account invoke error:', error);
              Alert.alert(
                'Delete failed',
                'We could not delete your account right now. Please try again.'
              );
              return;
            }

            await AsyncStorage.clear();
            await supabase.auth.signOut();
            router.replace('/login');
          } catch (error) {
            console.log('Delete account error:', error);
            Alert.alert(
              'Delete failed',
              'We could not delete your account right now. Please try again.'
            );
          }
        },
      },
    ]
  );
};

  const loadProfile = async () => {
    try {
      await loadLocalProfile();

      const { data, error } = await supabase.auth.getUser();

      if (error || !data?.user) {
        console.log('No user — using local profile');
        return;
      }

      await ensureProfileExistsAndSyncLocal();

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (!profile) return;

      setName(profile.display_name || profile.username || '');
      setPhotoUri(profile.avatar_url || '');
      setLocation(profile.location || '');
      setBoat(profile.boat || '');
      setSpecies(profile.species || '');
    } catch (error) {
      console.log('loadProfile error:', error);
    }
  };

  const pickAndUploadAvatar = async () => {
  try {
    setUploadingAvatar(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      Alert.alert('Error', 'You must be logged in to upload an avatar.');
      return;
    }

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        'Permission needed',
        'Please allow photo access to upload an avatar.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const image = result.assets[0];

    if (!image.uri) {
      throw new Error('No image uri');
    }

    const arrayBuffer = await fetch(image.uri).then((res) => res.arrayBuffer());

    const fileExt =
      image.uri.split('.').pop()?.toLowerCase()?.split('?')[0] || 'jpg';
    const filePath = `${user.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, arrayBuffer, {
        contentType: image.mimeType ?? 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.log('Avatar upload error:', uploadError);
      Alert.alert('Upload failed', uploadError.message);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    if (profileError) {
      console.log('Avatar profile update error:', profileError);
      Alert.alert(
        'Saved image, but could not update profile',
        profileError.message
      );
      return;
    }

    setPhotoUri(publicUrl);
    await AsyncStorage.setItem(PROFILE_PHOTO_KEY, publicUrl);

    Alert.alert('Success', 'Avatar updated.');
  } catch (error: any) {
    console.log('pickAndUploadAvatar error:', error);
    Alert.alert('Error', error?.message || 'Could not upload avatar.');
  } finally {
    setUploadingAvatar(false);
  }
};


  const saveProfile = async () => {
    try {
      setSaving(true);

      const trimmedName = name.trim();
      const trimmedPhoto = photoUri.trim();
      const trimmedLocation = location.trim();
      const trimmedBoat = boat.trim();
      const trimmedSpecies = species.trim();

      await AsyncStorage.setItem(PROFILE_NAME_KEY, trimmedName);
      await AsyncStorage.setItem(PROFILE_PHOTO_KEY, trimmedPhoto);
      await AsyncStorage.setItem(PROFILE_LOCATION_KEY, trimmedLocation);
      await AsyncStorage.setItem(PROFILE_BOAT_KEY, trimmedBoat);
      await AsyncStorage.setItem(PROFILE_SPECIES_KEY, trimmedSpecies);

      const { data, error } = await supabase.auth.getUser();

      if (!error && data?.user) {
        await ensureProfileExistsAndSyncLocal();

        const usernameFallback = data.user.email?.split('@')[0] || 'angler';

        const { error: saveError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          username: usernameFallback,
          display_name: trimmedName || usernameFallback,
          avatar_url: trimmedPhoto || null,
          location: trimmedLocation || null,
          boat: trimmedBoat || null,
          species: trimmedSpecies || null,
        });

        if (saveError) {
          throw saveError;
        }
      }

      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.log('Save error:', error);

      Alert.alert('Saved locally', 'Cloud sync failed.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.content}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>

            <Text style={styles.eyebrow}>PROFILE</Text>
            <Text style={styles.title}>Edit Profile</Text>

            <View style={styles.avatarCard}>
              <TouchableOpacity
                style={styles.avatar}
                onPress={pickAndUploadAvatar}
                activeOpacity={0.85}
                disabled={uploadingAvatar}
              >
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>👤</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.avatarButton,
                  uploadingAvatar && styles.avatarButtonDisabled,
                ]}
                onPress={pickAndUploadAvatar}
                activeOpacity={0.85}
                disabled={uploadingAvatar}
              >
                <Text style={styles.avatarButtonText}>
                  {uploadingAvatar ? 'Uploading...' : 'Upload Avatar'}
                </Text>
              </TouchableOpacity>
            </View>

          
            <View style={styles.card}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor="#7D8FA3"
              />

              <Text style={styles.label}>Location</Text>
              <TextInput
                value={location}
                onChangeText={setLocation}
                style={styles.input}
                placeholder="Ontario, Lake, Region..."
                placeholderTextColor="#7D8FA3"
              />

              <Text style={styles.label}>Boat</Text>
              <TextInput
                value={boat}
                onChangeText={setBoat}
                style={styles.input}
                placeholder="Boat type (if any)"
                placeholderTextColor="#7D8FA3"
              />

              <Text style={styles.label}>Species</Text>
              <TextInput
                value={species}
                onChangeText={setSpecies}
                style={styles.input}
                placeholder="Bass, Trout, Multi-species..."
                placeholderTextColor="#7D8FA3"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={saveProfile}
              disabled={saving}
            >
              <Text style={styles.saveText}>
                {saving ? 'Saving...' : 'Save Profile'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const PRIMARY = '#F2C94C';

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#081E33' },
  content: { padding: 20 },

  backButton: {
    backgroundColor: '#102C47',
    padding: 10,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backButtonText: { color: '#fff', fontWeight: '700' },

  eyebrow: {
    color: PRIMARY,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 1.2,
  },

  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 20,
  },

  avatarCard: {
    backgroundColor: '#102C47',
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    alignItems: 'center',
  },

  deleteAccountButton: {
  marginTop: 10,
  backgroundColor: '#2A0F0F',
  paddingVertical: 14,
  borderRadius: 14,
  alignItems: 'center',
},
deleteAccountButtonText: {
  color: '#FF6B6B',
  fontWeight: '700',
},

  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#081E33',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  avatarImage: {
    width: '100%',
    height: '100%',
  },

  avatarText: {
    fontSize: 42,
  },

  avatarButton: {
    marginTop: 14,
    alignSelf: 'center',
    backgroundColor: PRIMARY,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },

  avatarButtonDisabled: {
    opacity: 0.7,
  },

  avatarButtonText: {
    color: '#0A2540',
    fontWeight: '800',
    fontSize: 14,
  },

  card: {
    backgroundColor: '#102C47',
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
  },

  label: {
    color: '#F5F7FA',
    marginTop: 10,
    marginBottom: 6,
    fontWeight: '700',
  },

  input: {
    backgroundColor: '#081E33',
    color: '#fff',
    borderRadius: 14,
    padding: 12,
  },

  saveButton: {
    backgroundColor: PRIMARY,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },

  saveButtonDisabled: {
    opacity: 0.7,
  },

  saveText: {
    fontWeight: '800',
    color: '#0A2540',
    fontSize: 16,
  },
});
