import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const PROFILE_NAME_KEY = 'reelwall_profile_name';
const PROFILE_PHOTO_KEY = 'reelwall_profile_photo';
const PROFILE_LOCATION_KEY = 'reelwall_profile_location';
const PROFILE_BOAT_KEY = 'reelwall_profile_boat';
const PROFILE_SPECIES_KEY = 'reelwall_profile_species';

export const ensureProfileExistsAndSyncLocal = async () => {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log('No logged in user for profile sync');
      return null;
    }

    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.log('Profile lookup error:', profileError);
      return null;
    }

    const localName = (await AsyncStorage.getItem(PROFILE_NAME_KEY)) || '';
    const localPhoto = (await AsyncStorage.getItem(PROFILE_PHOTO_KEY)) || '';
    const localLocation = (await AsyncStorage.getItem(PROFILE_LOCATION_KEY)) || '';
    const localBoat = (await AsyncStorage.getItem(PROFILE_BOAT_KEY)) || '';
    const localSpecies = (await AsyncStorage.getItem(PROFILE_SPECIES_KEY)) || '';

    if (!existingProfile) {
      const emailPrefix = user.email?.split('@')[0] || 'angler';

      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          username: emailPrefix,
          display_name: localName || emailPrefix,
          avatar_url: localPhoto || null,
          location: localLocation || null,
          boat: localBoat || null,
          species: localSpecies || null,
        })
        .select('*')
        .single();

      if (insertError) {
        console.log('Profile create error:', insertError);
        return null;
      }

      return inserted;
    }

    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name:
          existingProfile.display_name ||
          localName ||
          existingProfile.username ||
          'Your ReelWall',
        avatar_url: existingProfile.avatar_url || localPhoto || null,
        location: existingProfile.location || localLocation || null,
        boat: existingProfile.boat || localBoat || null,
        species: existingProfile.species || localSpecies || null,
      })
      .eq('id', user.id)
      .select('*')
      .single();

    if (updateError) {
      console.log('Profile update error:', updateError);
      return existingProfile;
    }

    return updated;
  } catch (error) {
    console.log('ensureProfileExistsAndSyncLocal error:', error);
    return null;
  }
};
