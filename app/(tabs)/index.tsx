import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

type LocationVisibility = 'exact' | 'approximate' | 'hidden';

type CatchItem = {
  id: string;
  uri: string;
  createdAt: string;
  catchDate?: string;
  placeName?: string;
  regionName?: string;
  weatherTemp?: number;
  weatherDescription?: string;
  note?: string;
  isPersonalBest?: boolean;
  isVaulted?: boolean;
  source?: 'camera' | 'upload';
  userId?: string;
};

type PrivacySettings = {
  profileVisibility: 'public' | 'private';
  locationVisibility: LocationVisibility;
};

const STORAGE_KEY = 'reelwall_catches';
const SETTINGS_KEY = 'reelwall_privacy_settings';
const DELETED_CATCH_IDS_KEY = 'reelwall_deleted_catch_ids';

export default function Home() {
  const [catches, setCatches] = useState<CatchItem[]>([]);
  const [selectedCatch, setSelectedCatch] = useState<CatchItem | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [locationDraft, setLocationDraft] = useState('');
  const [dateDraft, setDateDraft] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    profileVisibility: 'private',
    locationVisibility: 'hidden',
  });

  const getDeletedCatchIds = async () => {
  try {
    const raw = await AsyncStorage.getItem(DELETED_CATCH_IDS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

const DELETED_CATCH_IDS_KEY = 'reelwall_deleted_catch_ids';




const saveDeletedCatchIds = async (ids: string[]) => {
  await AsyncStorage.setItem(DELETED_CATCH_IDS_KEY, JSON.stringify(ids));
};

const filterDeletedCatches = (items: CatchItem[], deletedIds: string[]) => {
  if (!deletedIds.length) return items;
  const deletedSet = new Set(deletedIds);
  return items.filter((item) => !deletedSet.has(String(item.id)));
};

  const sortCatchesNewestFirst = (items: CatchItem[]) => {
    return [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  };

  const mapRowToCatch = (item: any): CatchItem => ({
    id: String(item.id),
    uri: item.image_url,
    createdAt: item.created_at,
    catchDate: item.catch_date || undefined,
    placeName: item.place_name || undefined,
    regionName: item.region_name || undefined,
    weatherTemp: item.weather_temp ?? undefined,
    weatherDescription: item.weather_description || undefined,
    note: item.note || '',
    isPersonalBest: item.is_personal_best ?? false,
    isVaulted: item.is_vaulted ?? item.is_personal_best ?? false,
    source: item.source || 'camera',
    userId: item.user_id || undefined,
  });

  const getCurrentUserId = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new Error('User not logged in');
    }

    return user.id;
  };

  const loadCatches = async () => {
  try {
    const userId = await getCurrentUserId();
    const deletedIds = await getDeletedCatchIds();

    const { data, error } = await supabase
      .from('catches')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const mapped: CatchItem[] = (data || []).map(mapRowToCatch);
    const filtered = filterDeletedCatches(mapped, deletedIds);
    const sorted = sortCatchesNewestFirst(filtered);

    setCatches(sorted);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  } catch (error) {
    console.log('Load catches error:', error);

    try {
      const deletedIds = await getDeletedCatchIds();
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: CatchItem[] = saved ? JSON.parse(saved) : [];
      const filtered = filterDeletedCatches(parsed, deletedIds);
      setCatches(sortCatchesNewestFirst(filtered));
    } catch (storageError) {
      console.log('Fallback storage load error:', storageError);
      setCatches([]);
    }
  }
};

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) {
        setPrivacySettings(JSON.parse(saved));
      }
    } catch (error) {
      console.log('Load settings error:', error);
    }
  };

  useEffect(() => {
    loadCatches();
    loadSettings();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCatches();
      loadSettings();
    }, [])
  );

  useEffect(() => {
    if (selectedCatch) {
      setNoteDraft(selectedCatch.note || '');
      setLocationDraft(selectedCatch.placeName || '');
      setDateDraft(selectedCatch.catchDate || '');
      setSaveSuccess(false);
    } else {
      setNoteDraft('');
      setLocationDraft('');
      setDateDraft('');
      setSaveSuccess(false);
    }
  }, [selectedCatch]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadCatches();
      await loadSettings();
    } finally {
      setRefreshing(false);
    }
  };

  const normalizeLocationText = (value?: string) => {
    if (!value) return '';
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ');
  };

  const getApproximateLocation = (item: CatchItem) => {
    const normalizedRegion = normalizeLocationText(item.regionName);
    if (normalizedRegion) return normalizedRegion;

    const normalizedPlace = normalizeLocationText(item.placeName);
    if (!normalizedPlace) return '';

    const parts = normalizedPlace
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    return parts.length > 1 ? parts[parts.length - 1] : normalizedPlace;
  };

  const getDisplayedLocation = (item: CatchItem) => {
    if (privacySettings.locationVisibility === 'hidden') {
      return '';
    }

    if (privacySettings.locationVisibility === 'approximate') {
      return getApproximateLocation(item);
    }

    return normalizeLocationText(item.placeName);
  };

  const getDisplayedWeather = (item: CatchItem) => {
    if (item.source === 'upload') {
      return '';
    }

    if (item.weatherTemp !== undefined && item.weatherDescription) {
      return `${item.weatherTemp}°C • ${item.weatherDescription}`;
    }

    if (item.weatherTemp !== undefined) {
      return `${item.weatherTemp}°C`;
    }

    if (item.weatherDescription) {
      return item.weatherDescription;
    }

    return '';
  };

  const getDisplayedDate = (item: CatchItem) => {
    if (!item.catchDate) return '';

    try {
      const d = new Date(item.catchDate);
      if (Number.isNaN(d.getTime())) {
        return item.catchDate;
      }

      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return item.catchDate;
    }
  };

  const shareCatch = async (item: CatchItem) => {
    try {
      const location = getDisplayedLocation(item);
      const date = getDisplayedDate(item);

      const messageParts = [
        item.note?.trim(),
        date ? `Caught on ${date}` : '',
        location ? `Location: ${location}` : '',
        'Check out my catch on ReelWall 🎣',
      ].filter(Boolean);

      await Share.share({
        message: messageParts.join('\n'),
        url: item.uri,
      });
    } catch (error) {
      console.log('Share error:', error);
      Alert.alert('Could not share this catch');
    }
  };

  const openCatch = (item: CatchItem) => {
    setSelectedCatch(item);
  };

  const closeCatch = () => {
    setSelectedCatch(null);
  };

  const saveAll = async () => {
    if (!selectedCatch) return;

    try {
      const userId = await getCurrentUserId();
      const trimmedLocation = locationDraft.trim();
      const trimmedDate = dateDraft.trim();

      const { data, error } = await supabase
        .from('catches')
        .update({
          note: noteDraft,
          catch_date: trimmedDate || null,
          place_name: trimmedLocation || null,
        })
        .eq('id', selectedCatch.id)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) throw error;

      const updatedCatch = mapRowToCatch(data);

      const updated = sortCatchesNewestFirst(
        catches.map((item) => (item.id === selectedCatch.id ? updatedCatch : item))
      );

      setCatches(updated);
      setSelectedCatch(updatedCatch);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      setSaveSuccess(true);
      Keyboard.dismiss();
    } catch (error) {
      console.log('Save all error:', error);
      Alert.alert('Could not save changes');
    }
  };

  const togglePersonalBest = async (value: boolean) => {
    if (!selectedCatch) return;

    try {
      const userId = await getCurrentUserId();

      const { data, error } = await supabase
        .from('catches')
        .update({
          is_personal_best: value,
        })
        .eq('id', selectedCatch.id)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) throw error;

      const updatedCatch = mapRowToCatch(data);
      const updated = sortCatchesNewestFirst(
        catches.map((item) => (item.id === selectedCatch.id ? updatedCatch : item))
      );

      setCatches(updated);
      setSelectedCatch(updatedCatch);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.log('Toggle PB error:', error);
      Alert.alert('Could not update personal best');
    }
  };

 const deleteCatch = () => {
  if (!selectedCatch) return;

  Alert.alert(
    'Delete catch from wall?',
    'This will remove this catch from your wall.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const userId = await getCurrentUserId();
            const catchId = String(selectedCatch.id);

            const deletedIds = await getDeletedCatchIds();
            const nextDeletedIds = Array.from(new Set([...deletedIds, catchId]));
            await saveDeletedCatchIds(nextDeletedIds);

            const { error } = await supabase
              .from('catches')
              .delete()
              .eq('id', catchId)
              .eq('user_id', userId);

            if (error) throw error;

            const updated = catches.filter((item) => String(item.id) !== catchId);
            setCatches(updated);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            setSelectedCatch(null);
          } catch (error: any) {
            console.log('Delete error:', error);
            Alert.alert('Delete failed', error?.message || 'Try again');
          }
        },
      },
    ]
  );
};
  const renderEditBadge = () => (
  <View style={styles.editButton}>
    <Text style={styles.editText}>Edit</Text>
  </View>
);

  const latest = catches[0];
  const rest = catches.slice(1);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topHeader}>
          <Text style={styles.eyebrow}>YOUR DIGITAL TROPHY WALL</Text>

          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.subtitle}>Every Catch Has a Story</Text>

          <View style={styles.statusRow}>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>🎣 {catches.length} Catches</Text>
            </View>

            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {privacySettings.profileVisibility === 'public'
                  ? '🌍 Public Wall'
                  : '🔒 Private Wall'}
              </Text>
            </View>

            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {privacySettings.locationVisibility === 'exact'
                  ? '📍 Location Saved'
                  : privacySettings.locationVisibility === 'approximate'
                    ? '📍 Approx Location'
                    : '📍 Location Hidden'}
              </Text>
            </View>
          </View>
        </View>

        {catches.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.placeholder}>
              <Text style={styles.placeholderTitle}>No catches yet</Text>
              <Text style={styles.placeholderText}>
                Use the camera or upload to add your first memory.
              </Text>
            </View>
          </View>
        ) : (
          <>
            {latest && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Latest Catches</Text>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => openCatch(latest)}
                  style={styles.featuredCard}
                >
                  <Image source={{ uri: latest.uri }} style={styles.featuredImage} />
                  <View style={styles.featuredOverlay} />

                  {renderEditBadge()}

                  <TouchableOpacity
                    style={styles.shareButton}
                    onPress={() => shareCatch(latest)}
                  >
                    <Text style={styles.shareIcon}>↗</Text>
                  </TouchableOpacity>

                  <View style={styles.featuredMeta}>
                    {latest.isPersonalBest && (
                      <View style={styles.featuredPbBadge}>
                        <Text style={styles.featuredPbIcon}>★</Text>
                        <Text style={styles.featuredPbText}>Personal Best</Text>
                      </View>
                    )}
                    {latest.isVaulted && (
                      <View style={styles.vaultBadge}>
                        <Text style={styles.vaultIcon}>🔒</Text>
                        <Text style={styles.vaultText}>LiveWell Vault</Text>
                      </View>
                    )}

                    {getDisplayedDate(latest) ? (
                      <Text style={styles.featuredDate}>{getDisplayedDate(latest)}</Text>
                    ) : null}

                    {getDisplayedLocation(latest) ? (
                      <Text style={styles.featuredLocation} numberOfLines={1}>
                        {getDisplayedLocation(latest)}
                      </Text>
                    ) : null}

                    {getDisplayedWeather(latest) ? (
                      <Text style={styles.featuredWeather}>{getDisplayedWeather(latest)}</Text>
                    ) : null}

                    {latest.note ? (
                      <Text style={styles.featuredNote} numberOfLines={2}>
                        {latest.note}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {rest.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your Trophy Wall</Text>

                <FlatList
                  data={rest}
                  keyExtractor={(item) => item.id}
                  numColumns={2}
                  scrollEnabled={false}
                  contentContainerStyle={styles.grid}
                  columnWrapperStyle={styles.row}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.card}
                      onPress={() => openCatch(item)}
                      activeOpacity={0.9}
                    >
                      <View style={styles.imageWrap}>
                        <Image source={{ uri: item.uri }} style={styles.gridImage} />
                        <View style={styles.imageOverlay} />

                        {renderEditBadge()}

                        <TouchableOpacity
                          style={styles.shareButton}
                          onPress={() => shareCatch(item)}
                        >
                          <Text style={styles.shareIcon}>↗</Text>
                        </TouchableOpacity>

                        {item.isPersonalBest && (
                          <View style={styles.cardPbBadge}>
                            <Text style={styles.cardPbIcon}>★</Text>
                            <Text style={styles.cardPbText}>PB</Text>
                          </View>
                        )}
                        {item.isVaulted && (
                          <View style={styles.cardVaultBadge}>
                            <Text style={styles.cardVaultIcon}>🔒</Text>
                            <Text style={styles.cardVaultText}>Vault</Text>
                          </View>
                        )}

                        <View style={styles.imageMeta}>
                          {getDisplayedDate(item) ? (
                            <Text style={styles.imageDate}>{getDisplayedDate(item)}</Text>
                          ) : null}

                          {getDisplayedLocation(item) ? (
                            <Text style={styles.imageLocation} numberOfLines={1}>
                              {getDisplayedLocation(item)}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.cardBottom}>
                        {getDisplayedWeather(item) ? (
                          <Text style={styles.weatherText}>{getDisplayedWeather(item)}</Text>
                        ) : null}

                        {!!item.note && (
                          <Text style={styles.notePreview} numberOfLines={1}>
                            {item.note}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={!!selectedCatch} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.detailContainer}>
          {selectedCatch && (
            <KeyboardAvoidingView
              style={styles.detailFlex}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={0}
            >
              <View style={styles.detailFlex}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitle}>Catch Detail</Text>

                  <View style={styles.detailHeaderActions}>
                    <TouchableOpacity style={styles.deleteButton} onPress={deleteCatch}>
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.closeDetailButton}
                      onPress={closeCatch}
                    >
                      <Text style={styles.closeDetailText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView
                  style={styles.detailFlex}
                  contentContainerStyle={styles.detailContent}
                  keyboardShouldPersistTaps="always"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.detailImageWrap}>
                    <Image source={{ uri: selectedCatch.uri }} style={styles.detailImage} />
                    <View style={styles.detailImageOverlay} />

                    {selectedCatch.isPersonalBest && (
                      <View style={styles.detailPbBadge}>
                        <Text style={styles.detailPbIcon}>★</Text>
                        <Text style={styles.detailPbText}>Personal Best</Text>
                      </View>
                    )}

                    <View style={styles.detailImageMeta}>
                      {getDisplayedDate(selectedCatch) ? (
                        <Text style={styles.detailImageDate}>
                          {getDisplayedDate(selectedCatch)}
                        </Text>
                      ) : null}

                      {getDisplayedLocation(selectedCatch) ? (
                        <Text style={styles.detailImageLocation}>
                          {getDisplayedLocation(selectedCatch)}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.editCard}>
                    <Text style={styles.editSectionTitle}>Edit Catch Details</Text>

                    <Text style={styles.inputLabel}>Date</Text>
                    <TextInput
                      value={dateDraft}
                      onChangeText={(text) => {
                        setDateDraft(text);
                        if (saveSuccess) setSaveSuccess(false);
                      }}
                      placeholder="Add date (optional)"
                      placeholderTextColor="#7D8FA3"
                      style={styles.metaInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable
                      returnKeyType="done"
                      blurOnSubmit
                    />

                    <TouchableOpacity
                      onPress={() => {
                        const today = new Date().toISOString().slice(0, 10);
                        setDateDraft(today);
                        if (saveSuccess) setSaveSuccess(false);
                      }}
                      style={styles.quickDateButton}
                    >
                      <Text style={styles.quickDateText}>Set Today</Text>
                    </TouchableOpacity>

                    <Text style={styles.inputHelper}>
                      Add a date only if you want it shown on the wall.
                    </Text>

                    <Text style={styles.inputLabel}>Location</Text>
                    <TextInput
                      value={locationDraft}
                      onChangeText={(text) => {
                        setLocationDraft(text);
                        if (saveSuccess) setSaveSuccess(false);
                      }}
                      placeholder="Add location (optional)"
                      placeholderTextColor="#7D8FA3"
                      style={styles.metaInput}
                      autoCorrect={false}
                      editable
                      returnKeyType="done"
                      blurOnSubmit
                    />

                    <Text style={styles.inputLabel}>Story / Note</Text>
                    <TextInput
                      value={noteDraft}
                      onChangeText={(text) => {
                        setNoteDraft(text);
                        if (saveSuccess) setSaveSuccess(false);
                      }}
                      placeholder="Tell the story ie. lures, weight, structure, who's the net person..."
                      placeholderTextColor="#7D8FA3"
                      multiline
                      style={styles.noteInput}
                      editable
                      autoCorrect
                      returnKeyType="done"
                      blurOnSubmit
                    />

                    <TouchableOpacity
                      style={[
                        styles.saveDetailsButton,
                        saveSuccess && styles.saveDetailsButtonSaved,
                      ]}
                      onPress={saveAll}
                    >
                      <Text style={styles.saveDetailsButtonText}>
                        {saveSuccess ? 'Saved ✓' : 'Save Changes'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View
                    style={[
                      styles.pbCard,
                      selectedCatch.isPersonalBest && styles.pbCardActive,
                    ]}
                  >
                    <View style={styles.pbRow}>
                      <View style={styles.pbTextWrap}>
                        <View style={styles.pbTitleRow}>
                          <Text style={styles.pbTitleIcon}>★</Text>
                          <Text style={styles.pbTitle}>Personal Best</Text>
                        </View>

                        <Text style={styles.pbSubtitle}>
                          Highlight this catch as one of your standout moments on ReelWall.
                        </Text>
                      </View>

                      <Switch
                        value={!!selectedCatch.isPersonalBest}
                        onValueChange={togglePersonalBest}
                        trackColor={{ false: '#294B6D', true: '#F2C94C' }}
                        thumbColor={selectedCatch.isPersonalBest ? '#FFFFFF' : '#F5F7FA'}
                        ios_backgroundColor="#294B6D"
                      />
                    </View>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  detailFlex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#081E33',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  topHeader: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 14,
    paddingHorizontal: 20,
  },
  logo: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    marginBottom: 8,
  },
  eyebrow: {
    color: '#F2C94C',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#A5B3C2',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 6,
  },
  statusRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  vaultBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10,37,64,0.85)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.5)',
  },
  vaultIcon: {
    color: '#F2C94C',
    fontSize: 11,
  },
  vaultText: {
    color: '#F2C94C',
    fontSize: 11,
    fontWeight: '800',
  },
  cardVaultBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10,37,64,0.85)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.5)',
  },
  cardVaultIcon: {
    color: '#F2C94C',
    fontSize: 9,
  },
  cardVaultText: {
    color: '#F2C94C',
    fontSize: 10,
    fontWeight: '800',
  },
  statusPill: {
    backgroundColor: '#12314F',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  statusPillText: {
    color: '#D7DEE6',
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    marginTop: 4,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#F5F7FA',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  emptyWrap: {
    flex: 1,
    paddingHorizontal: 20,
  },
  placeholder: {
    height: 300,
    borderRadius: 22,
    backgroundColor: '#102C47',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  placeholderTitle: {
    color: '#F5F7FA',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  placeholderText: {
    color: '#A5B3C2',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  featuredCard: {
    marginHorizontal: 20,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#102C47',
  },
  featuredImage: {
    width: '100%',
    height: 340,
    backgroundColor: '#163554',
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.26)',
  },
  featuredMeta: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  featuredPbBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(242,201,76,0.96)',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  featuredPbIcon: {
    color: '#0A2540',
    fontSize: 11,
    fontWeight: '900',
  },
  featuredPbText: {
    color: '#0A2540',
    fontSize: 12,
    fontWeight: '800',
  },
  featuredDate: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  featuredLocation: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  featuredWeather: {
    color: '#F2C94C',
    fontSize: 13,
    fontWeight: '700',
  },
  featuredNote: {
    color: '#E8EEF3',
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  grid: {
    paddingHorizontal: 16,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  card: {
    width: '48.5%',
    marginBottom: 4,
  },
  imageWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#102C47',
  },
  gridImage: {
    width: '100%',
    aspectRatio: 0.92,
    backgroundColor: '#163554',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  editButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    zIndex: 3,
  },
  editText: {
  color: '#F2C94C',
  fontSize: 12,
  fontWeight: '800',
},
  shareButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    zIndex: 3,
  },
  shareIcon: {
    color: '#F2C94C',
    fontSize: 14,
    fontWeight: '800',
  },
  cardPbBadge: {
    position: 'absolute',
    top: 48,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(242,201,76,0.96)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  cardPbIcon: {
    color: '#0A2540',
    fontSize: 9,
    fontWeight: '900',
  },
  cardPbText: {
    color: '#0A2540',
    fontSize: 10,
    fontWeight: '800',
  },
  imageMeta: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  imageDate: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  imageLocation: {
    color: '#E3EAF0',
    fontSize: 12,
    fontWeight: '500',
  },
  cardBottom: {
    paddingTop: 8,
    paddingHorizontal: 4,
    minHeight: 24,
  },
  weatherText: {
    color: '#F2C94C',
    fontSize: 11,
    fontWeight: '700',
  },
  notePreview: {
    color: '#E6EDF3',
    fontSize: 11,
    marginTop: 4,
    opacity: 0.9,
  },
  detailContainer: {
    flex: 1,
    backgroundColor: '#081E33',
  },
  detailHeader: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailHeaderActions: {
    flexDirection: 'row',
    gap: 10,
  },
  detailTitle: {
    color: '#F5F7FA',
    fontSize: 24,
    fontWeight: '800',
  },
  closeDetailButton: {
    backgroundColor: '#163554',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  closeDetailText: {
    color: '#F5F7FA',
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: '#5A1F1F',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  deleteButtonText: {
    color: '#FFD7D7',
    fontWeight: '700',
  },
  detailContent: {
    padding: 20,
    paddingBottom: 28,
  },
  detailImageWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#102C47',
  },
  detailImage: {
    width: '100%',
    height: 340,
    backgroundColor: '#163554',
  },
  detailImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  detailPbBadge: {
    position: 'absolute',
    top: 58,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(242,201,76,0.96)',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  detailPbIcon: {
    color: '#0A2540',
    fontSize: 11,
    fontWeight: '900',
  },
  detailPbText: {
    color: '#0A2540',
    fontSize: 12,
    fontWeight: '800',
  },
  detailImageMeta: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  detailImageDate: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  detailImageLocation: {
    color: '#E3EAF0',
    fontSize: 13,
    fontWeight: '500',
  },
  editCard: {
    backgroundColor: '#102C47',
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  editSectionTitle: {
    color: '#F5F7FA',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  inputLabel: {
    color: '#F5F7FA',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 10,
  },
  inputHelper: {
    color: '#8FA3B8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 2,
  },
  metaInput: {
    backgroundColor: '#081E33',
    borderRadius: 16,
    color: '#F5F7FA',
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  quickDateButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#163554',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  quickDateText: {
    color: '#F2C94C',
    fontSize: 12,
    fontWeight: '700',
  },
  saveDetailsButton: {
    backgroundColor: '#F2C94C',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 14,
  },
  saveDetailsButtonSaved: {
    backgroundColor: '#1C466C',
  },
  saveDetailsButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  noteInput: {
    backgroundColor: '#081E33',
    borderRadius: 16,
    color: '#F5F7FA',
    minHeight: 90,
    maxHeight: 120,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 15,
    lineHeight: 20,
  },
  pbCard: {
    backgroundColor: '#102C47',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  pbCardActive: {
    borderColor: 'rgba(242,201,76,0.45)',
    backgroundColor: '#12314F',
  },
  pbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pbTextWrap: {
    flex: 1,
  },
  pbTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  pbTitleIcon: {
    color: '#F2C94C',
    fontSize: 15,
    fontWeight: '900',
  },
  pbTitle: {
    color: '#F5F7FA',
    fontSize: 18,
    fontWeight: '800',
  },
  pbSubtitle: {
    color: '#A5B3C2',
    fontSize: 14,
    lineHeight: 20,
    paddingRight: 12,
  },
});
