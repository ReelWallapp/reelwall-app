import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { supabase } from '../../lib/supabase';

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

const STORAGE_KEY = 'reelwall_catches';
const DELETED_CATCH_IDS_KEY = 'reelwall_deleted_catch_ids';

export default function Home() {
  const [catches, setCatches] = useState<CatchItem[]>([]);
  const [selectedCatch, setSelectedCatch] = useState<CatchItem | null>(null);
  const [fullscreenCatch, setFullscreenCatch] = useState<CatchItem | null>(null);

  const [noteDraft, setNoteDraft] = useState('');
  const [locationDraft, setLocationDraft] = useState('');
  const [dateDraft, setDateDraft] = useState('');

  const [refreshing, setRefreshing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [shareItem, setShareItem] = useState<CatchItem | null>(null);
  const shareCardRef = useRef<ViewShot | null>(null);

  const router = useRouter();
  const [isDemoUser, setIsDemoUser] = useState(false);

  const getDeletedCatchIds = async () => {
    try {
      const raw = await AsyncStorage.getItem(DELETED_CATCH_IDS_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  };

  

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

  const checkIfDemoUser = async () => {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('profiles')
      .select('is_demo')
      .eq('id', userId)
      .single();

    if (error) {
      console.log('Demo check error:', error);
      return;
    }

    setIsDemoUser(!!data?.is_demo);
  } catch (error) {
    console.log('Demo check failed:', error);
  }
};

  const getPublicImageUrl = (value?: string | null) => {
    if (!value) return '';

    if (value.startsWith('file://')) return value;

    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }

    const cleanPath = value.replace(/^\/+/, '').replace(/^catches\//, '');

    return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catches/${cleanPath}`;
  };

  const mapRowToCatch = (item: any): CatchItem => ({
    id: String(item.id),
    uri: getPublicImageUrl(item.image_url),
    createdAt: item.created_at,
    catchDate: item.catch_date || undefined,
    placeName: item.place_name || undefined,
    regionName: item.region_name || undefined,
    weatherTemp: item.weather_temp ?? undefined,
    weatherDescription: item.weather_description || undefined,
    note: item.note || '',
    isPersonalBest: item.is_personal_best ?? false,
    isVaulted: item.is_vaulted ?? false,
    source: item.source || 'camera',
    userId: item.user_id || undefined,
  });

  const getCurrentUserId = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) throw new Error('User not logged in');

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
useFocusEffect(
  useCallback(() => {
    loadCatches();
    checkIfDemoUser();
  }, [])
);
  useFocusEffect(
    useCallback(() => {
      loadCatches();
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

  const getDisplayedLocation = (item: CatchItem) => {
    return normalizeLocationText(item.placeName || item.regionName);
  };

  const getDisplayedWeather = (item: CatchItem) => {
    if (item.source === 'upload') return '';

    if (item.weatherTemp !== undefined && item.weatherDescription) {
      return `${item.weatherTemp}°C • ${item.weatherDescription}`;
    }

    if (item.weatherTemp !== undefined) return `${item.weatherTemp}°C`;
    if (item.weatherDescription) return item.weatherDescription;

    return '';
  };

  const getDisplayedDate = (item: CatchItem) => {
    if (!item.catchDate) return '';

    try {
      const d = new Date(item.catchDate);
      if (Number.isNaN(d.getTime())) return item.catchDate;

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
      setShareItem(item);

      await new Promise((resolve) => setTimeout(resolve, 500));

      const imageUri = await (shareCardRef.current as any)?.capture?.();

      if (!imageUri) {
        Alert.alert('Could not prepare share image');
        return;
      }

      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        Alert.alert('Sharing is not available on this device');
        return;
      }

      await Sharing.shareAsync(imageUri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Share your ReelWall catch',
      });
    } catch (error) {
      console.log('Share error:', error);
      Alert.alert('Could not share this catch');
    } finally {
      setShareItem(null);
    }
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

      Keyboard.dismiss();

      setTimeout(() => {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }, 100);
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

  const mountCatch = async () => {
  if (!selectedCatch) return;

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      Alert.alert('Sign in required', 'Please sign in to mount catches.');
      return;
    }

    const { error } = await supabase
      .from('catches')
      .update({
        is_public: true,
        mounted_at: new Date().toISOString(),
      })
      .eq('id', selectedCatch.id)
      .eq('user_id', user.id);

    if (error) throw error;

    Alert.alert('Mounted!', 'Your catch is now on ReelWall.');
  } catch (error: any) {
    console.log('Mount error:', error);
    Alert.alert('Error', error?.message || 'Could not mount catch');
  }
};

const deleteCatch = () => {
    if (!selectedCatch) return;

    Alert.alert('Delete catch?', 'This will remove this catch from your wall.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const userId = await getCurrentUserId();
            const catchId = String(selectedCatch.id);

            if (selectedCatch.uri) {
              const path = selectedCatch.uri.replace(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catches/`,
                ''
              );

              await supabase.storage.from('catches').remove([path]);
            }

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
    ]);
  };

  const renderEditBadge = (item: CatchItem) => (
    <TouchableOpacity
      style={styles.editButton}
      onPress={(e) => {
        e.stopPropagation();
        setSelectedCatch(item);
      }}
      activeOpacity={0.85}
    >
      <Text style={styles.editText}>Edit</Text>
    </TouchableOpacity>
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
        <View style={styles.privateStudioHeader}>
          <TouchableOpacity
            style={styles.profileTopButton}
            onPress={() => router.push('/profile')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="person-circle-outline"
              size={30}
              color="#F2C94C"
            />
            <Text style={styles.profileTopLabel}>Profile</Text>
          </TouchableOpacity>

          <View style={styles.privateStudioCopy}>
            <View style={styles.privateStudioPill}>
              <Text style={styles.privateStudioPillText}>MY WALL</Text>
            </View>

            <Text style={styles.privateStudioTitle}>Build Your Legacy</Text>

            <Text style={styles.privateStudioSubtitle}>
              Where your stories begin. Build collections, mount stories, and vault the moments that last.
            </Text>
          </View>
        </View>

        <View style={styles.privateStudioBottomRow}>
          <Text style={styles.privateStudioBottomText}>LATEST MOMENTS</Text>

          <View style={styles.privatePill}>
            <View style={styles.privateDot} />
            <Text style={styles.privatePillText}>Private</Text>
          </View>
        </View>

        {catches.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.placeholder}>
              <Text style={styles.placeholderTitle}>No catches yet</Text>
              <Text style={styles.placeholderText}>
                Capture or upload your first catch. Add the story, then mount it when it is ready.
              </Text>
            </View>
          </View>
        ) : (
          <>
            {latest && (
              <View style={styles.section}>
                <View style={styles.headerDivider} />
                

                <TouchableOpacity
  activeOpacity={0.9}
  onPress={() => setFullscreenCatch(latest)}
  style={styles.featuredCard}
>
                  <Image
                    source={{ uri: latest.uri }}
                    style={styles.featuredImage}
                    resizeMode="contain"
                  />
                  <View style={styles.featuredOverlay} />

                  {renderEditBadge(latest)}

                  <TouchableOpacity
                    style={styles.shareButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      shareCatch(latest);
                    }}
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
  <View style={{
    position: 'absolute',
    top: 48,
    left: 16,
    backgroundColor: 'rgba(8,30,51,0.92)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#F2C94C',
  }}>
    <Text style={{ color: '#F2C94C', fontSize: 11, fontWeight: '900' }}>
      🔒 VAULTED
    </Text>
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
                      onPress={() => setFullscreenCatch(item)}
                      activeOpacity={0.9}
                    >
                      <View style={styles.imageWrap}>
                        <Image
                          source={{ uri: item.uri }}
                          style={styles.gridImage}
                          resizeMode="cover"
                        />
                        <View style={styles.imageOverlay} />

                        {renderEditBadge(item)}

                        <TouchableOpacity
                          style={styles.shareButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            shareCatch(item);
                          }}
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
    <Text style={{ color: '#F2C94C', fontSize: 10, fontWeight: '900' }}>
      🔒 VAULTED
    </Text>
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

      <Modal visible={!!fullscreenCatch} animationType="fade" transparent={false}>
  <SafeAreaView style={styles.fullscreenWrap}>
    <TouchableOpacity
      style={styles.fullscreenClose}
      onPress={() => setFullscreenCatch(null)}
    >
      <Text style={styles.fullscreenCloseText}>Close</Text>
    </TouchableOpacity>

    {fullscreenCatch && (
      <>
        <ScrollView
          style={styles.fullscreenZoomScroll}
          contentContainerStyle={styles.fullscreenZoomContent}
          maximumZoomScale={4}
          minimumZoomScale={1}
          bouncesZoom
          pinchGestureEnabled
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          centerContent
        >
          <Image
            source={{ uri: fullscreenCatch.uri }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
        </ScrollView>

        {!!fullscreenCatch.note && (
          <View style={styles.fullscreenStoryPanel}>
            <Text style={styles.fullscreenStoryTitle}>Story</Text>

            <ScrollView showsVerticalScrollIndicator>
              <Text style={styles.fullscreenStory}>
                {fullscreenCatch.note}
              </Text>
            </ScrollView>
          </View>
        )}
      </>
    )}
  </SafeAreaView>
</Modal>

      <Modal visible={!!selectedCatch} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.detailContainer}>
          {selectedCatch && (
            <KeyboardAvoidingView
              style={styles.detailFlex}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
              <View style={styles.detailFlex}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitle}>Catch Details</Text>

                  <View style={styles.detailHeaderActions}>
                    <TouchableOpacity
                      style={[
                        styles.headerSaveButton,
                        saveSuccess && styles.headerSaveButtonSaved,
                      ]}
                      onPress={saveAll}
                    >
                      <Text style={styles.headerSaveButtonText}>
                        {saveSuccess ? 'Saved ✓' : 'Save'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.closeDetailButton} onPress={() => setSelectedCatch(null)}>
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
                    <Image
                      source={{ uri: selectedCatch.uri }}
                      style={styles.detailImage}
                      resizeMode="contain"
                    />
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
                    <Text style={styles.editSectionTitle}>Edit Catch</Text>

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
                      spellCheck={false}
                      editable
                      returnKeyType="done"
                      blurOnSubmit
                      keyboardAppearance="dark"
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
                      Add a date only if you want it shown on your wall.
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
                      spellCheck={false}
                      editable
                      returnKeyType="done"
                      blurOnSubmit
                      keyboardAppearance="dark"
                    />

                    <Text style={styles.inputLabel}>Story / Note</Text>
                    <TextInput
                      value={noteDraft}
                      onChangeText={(text) => {
                        setNoteDraft(text);
                        if (saveSuccess) setSaveSuccess(false);
                      }}
                      placeholder="Tell the story..."
                      placeholderTextColor="#7D8FA3"
                      multiline
                      style={styles.noteInput}
                      editable
                      autoCorrect={false}
                      spellCheck={false}
                      autoComplete="off"
                      textContentType="none"
                      importantForAutofill="no"
                      keyboardAppearance="dark"
                    />
                  </View>

                  {saveSuccess && (
                    <Text style={styles.saveSuccessText}>
                      Changes saved successfully ✓
                    </Text>
                  )}

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
                          Mark this as one of your standout catches.
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

                  <View style={styles.mountActionCard}>
  <View style={styles.mountActionHeader}>
    <View style={styles.mountIconCircle}>
      <Ionicons name="trophy" size={20} color="#0A2540" />
    </View>

    <View style={styles.mountActionCopy}>
      <Text style={styles.mountActionTitle}>Ready for the wall?</Text>
      <Text style={styles.mountActionText}>
        Share this catch to ReelWall as a mounted trophy.
      </Text>
    </View>
  </View>

  <TouchableOpacity
  style={styles.mountButton}
  onPress={mountCatch}
>
  <Text style={styles.mountButtonText}>
    Mount to ReelWall
  </Text>
</TouchableOpacity>
</View>

{/* VAULT INFO BLOCK */}
<View style={styles.vaultInfoCard}>
  <View style={styles.mountActionHeader}>
    <View style={styles.mountIconCircle}>
      <Text style={{ fontSize: 18 }}>🔒</Text>
    </View>

    <View style={styles.mountActionCopy}>
      <Text style={styles.mountActionTitle}>
        Preserve it later in Vault
      </Text>
      <Text style={styles.mountActionText}>
        Once this catch is mounted to ReelWall, go to the Vault tab and choose it as one of your preserved records.
      </Text>
    </View>
  </View>

  <TouchableOpacity
    style={styles.vaultInfoButton}
    onPress={() => {
      setSelectedCatch(null);
      setTimeout(() => {
        router.push('/vault' as any);
      }, 250);
    }}
    activeOpacity={0.85}
  >
    <Text style={styles.vaultInfoButtonText}>
      Go to Vault
    </Text>
  </TouchableOpacity>
</View>

<View style={styles.dangerZone}>
                    <Text style={styles.dangerZoneLabel}>CATCH & RELEASE</Text>

                    <TouchableOpacity style={styles.bottomDeleteButton} onPress={deleteCatch}>
                      <Text style={styles.bottomDeleteButtonText}>Delete Catch</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          )}
        </SafeAreaView>
      </Modal>

      <View style={styles.hiddenShareWrap} pointerEvents="none">
        {shareItem && (
          <ViewShot ref={shareCardRef} options={{ format: 'jpg', quality: 0.85 }}>
            <View style={styles.shareCard}>
              <Image
                source={{ uri: shareItem.uri }}
                style={styles.shareCardImage}
                resizeMode="cover"
              />

              <View style={styles.shareCardMeta}>
                {getDisplayedDate(shareItem) ? (
                  <Text style={styles.shareCardDate}>{getDisplayedDate(shareItem)}</Text>
                ) : null}

                {getDisplayedLocation(shareItem) ? (
                  <Text style={styles.shareCardLocation}>
                    {getDisplayedLocation(shareItem)}
                  </Text>
                ) : null}

                <Text style={styles.shareCardNote}>
                  {shareItem.note?.trim() || 'A fish worth remembering.'}
                </Text>

                <Text style={styles.shareCardBrand}>REELWALL</Text>
              </View>
            </View>
          </ViewShot>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#081E33' },
  detailFlex: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

fullscreenStoryPanel: {
  position: 'absolute',
  left: 14,
  right: 14,
  bottom: 28,
  maxHeight: '30%',
  backgroundColor: 'rgba(16,44,71,0.96)',
  borderRadius: 22,
  padding: 16,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.12)',
},

fullscreenStoryTitle: {
  color: '#F2C94C',
  fontSize: 13,
  fontWeight: '900',
  marginBottom: 8,
  textTransform: 'uppercase',
},

fullscreenStory: {
  color: '#F5F7FA',
  fontSize: 15,
  lineHeight: 22,
  fontWeight: '600',
},
featuredVaultedCard: {
  borderWidth: 2,
  borderColor: '#F2C94C',
  shadowColor: '#F2C94C',
  shadowOpacity: 0.45,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 0 },
  elevation: 8,
},
imageMeta: {
  position: 'absolute',
  bottom: 16,
  left: 16,
  right: 16,
},

imageDate: {
  color: '#F2C94C',
  fontSize: 13,
  fontWeight: '800',
  marginBottom: 4,
},

featuredDate: {
  color: '#F2C94C',
  fontSize: 14,
  fontWeight: '900',
},
vaultInfoCard: {
  backgroundColor: '#102C47',
  borderRadius: 22,
  padding: 16,
  marginBottom: 18,
  borderWidth: 1,
  borderColor: 'rgba(242,201,76,0.18)',
},

vaultInfoButton: {
  backgroundColor: '#163554',
  paddingVertical: 14,
  borderRadius: 18,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: 'rgba(242,201,76,0.28)',
},

vaultInfoButtonText: {
  color: '#F2C94C',
  fontWeight: '900',
  fontSize: 15,
},

  topHero: {
    backgroundColor: '#081E33',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 14,
    overflow: 'hidden',
    position: 'relative',
  },

  heroGlow: {
    position: 'absolute',
    top: -90,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(242,201,76,0.03)',
  },

  heroLogoShield: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 250,
    height: 320,
    zIndex: 1,
  },

  heroSideImage: {
    position: 'absolute',
    top: -10,
    right: 200,
    width: 520,
    height: 360,
    opacity: 0.92,
  },

  heroImageTopFade: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '100%',
    height: 80,
  },

  heroImageFade: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '100%',
    height: 360,
  },

  heroImageBottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
  },

  heroTopRow: {
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  profileTopButton: {
    position: 'absolute',
    top: 22,
    right: 18,
    zIndex: 6,
    alignItems: 'center',
    paddingTop: 2,
    transform: [{ scale: 0.82 }],
  },

  profileTopLabel: {
    color: '#B8C4D1',
    fontSize: 10,
    fontWeight: '900',
    marginTop: -1,
  },

  logo: {
    width: 148,
    height: 112,
    marginLeft: -8,
    marginTop: -4,
    marginBottom: -10,
    backgroundColor: '#081E33',
  },

  subtitle: {
    zIndex: 3,
    fontSize: 22,
    color: '#F5F7FA',
    fontWeight: '900',
    marginTop: 2,
    marginBottom: 12,
    marginLeft: 6,
    letterSpacing: -0.5,
  },

  subtitleHighlight: {
    color: '#F2C94C',
  },

  flowPill: {
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: 'rgba(4,18,31,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },

  flowStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  flowText: {
    color: '#A5B3C2',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4,
  },

  flowTextHighlight: {
    color: '#F2C94C',
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 4,
  },

  flowArrow: {
    color: '#A5B3C2',
    marginHorizontal: 8,
    opacity: 0.42,
  },

  privateStudioHeader: {
    position: 'relative',
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    minHeight: 172,
    backgroundColor: '#081E33',
  },




  privateStudioCopy: {
    zIndex: 3,
    paddingTop: 0,
    maxWidth: '76%',
  },

  privateStudioPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(242,201,76,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.20)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },

  privateStudioPillText: {
    color: '#F2C94C',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },

 privateStudioTitle: {
  color: '#F5F7FA',
  fontSize: 28,
  fontWeight: '900',
  lineHeight: 30,
  marginBottom: 6,
  letterSpacing: -1,
  textShadowColor: 'rgba(0,0,0,0.28)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
},

  privateStudioSubtitle: {
    color: '#A5B3C2',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    maxWidth: '92%',
  },

  privateStudioBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 10,
    marginBottom: 8,
  },

  privateStudioBottomText: {
    color: '#F2C94C',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },

  privatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242,201,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.20)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  privateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F2C94C',
    marginRight: 6,
  },

  privatePillText: {
    color: '#F2C94C',
    fontSize: 12,
    fontWeight: '900',
  },

  wallHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  wallEyebrow: {
    color: '#F2C94C',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.7,
    marginBottom: 7,
  },
  wallTitle: {
    color: '#F5F7FA',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  wallSubtitle: {
    color: '#A5B3C2',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 8,
  },
  wallFlowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 14,
    opacity: 0.85,
  },
  wallFlowText: {
    color: '#A5B3C2',
    fontSize: 12,
    fontWeight: '800',
  },
  wallFlowHighlight: {
    color: '#F2C94C',
    fontSize: 12,
    fontWeight: '900',
  },
  wallFlowArrow: {
    color: '#A5B3C2',
    fontSize: 12,
    marginHorizontal: 6,
    opacity: 0.55,
  },

  profileRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },

  section: { marginTop: 0, marginBottom: 12 },
  sectionTitle: {
    color: '#F5F7FA',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  headerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 40,
    marginTop: 8,
    marginBottom: 6,
  },

  emptyWrap: { flex: 1, paddingHorizontal: 20 },
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
    backgroundColor: '#081E33',
  },
  featuredImage: {
    width: '100%',
    height: 340,
    backgroundColor: '#081E33',
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
    backgroundColor: 'rgba(242,201,76,0.96)',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  featuredPbIcon: {
    color: '#0A2540',
    fontSize: 11,
    fontWeight: '900',
    marginRight: 6,
  },
  featuredPbText: {
    color: '#0A2540',
    fontSize: 12,
    fontWeight: '800',
  },

  vaultButtonDisabled: {
  backgroundColor: '#5A6B7D',
  opacity: 0.65,
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

  grid: { paddingHorizontal: 16 },
  row: { justifyContent: 'space-between', marginBottom: 12 },
  card: { width: '48.5%', marginBottom: 4 },
  imageWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#081E33',
    minHeight: 180,
  },
  gridImage: { width: '100%', height: 180, backgroundColor: '#081E33' },
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
  editText: { color: '#F2C94C', fontSize: 12, fontWeight: '800' },
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
  shareIcon: { color: '#F2C94C', fontSize: 14, fontWeight: '800' },
  cardPbBadge: {
    position: 'absolute',
    top: 48,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242,201,76,0.96)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  cardPbIcon: { color: '#0A2540', fontSize: 9, fontWeight: '900', marginRight: 4 },
  cardPbText: { color: '#0A2540', fontSize: 10, fontWeight: '800' },
  cardVaultBadge: {
  position: 'absolute',
  bottom: 10,
  right: 10,
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'rgba(8,30,51,0.92)',
  borderRadius: 999,
  paddingVertical: 5,
  paddingHorizontal: 9,
  borderWidth: 1,
  borderColor: 'rgba(242,201,76,0.75)',
  shadowColor: '#F2C94C',
  shadowOpacity: 0.35,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 0 },
  elevation: 5,
},
  
  imageLocation: { color: '#E3EAF0', fontSize: 12, fontWeight: '500' },
  cardBottom: { paddingTop: 8, paddingHorizontal: 4, minHeight: 24 },
  weatherText: { color: '#F2C94C', fontSize: 11, fontWeight: '700' },
  notePreview: {
    color: '#E6EDF3',
    fontSize: 11,
    marginTop: 4,
    opacity: 0.9,
  },

  fullscreenWrap: { flex: 1, backgroundColor: '#081E33' },
  fullscreenZoomScroll: { flex: 1, backgroundColor: '#081E33' },
  fullscreenZoomContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#081E33',
  },
  fullscreenImage: { width: '100%', height: '100%' },
  fullscreenClose: {
    position: 'absolute',
    top: 54,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(8,30,51,0.85)',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.45)',
  },
  fullscreenCloseText: { color: '#F5F7FA', fontWeight: '800' },

  detailContainer: { flex: 1, backgroundColor: '#081E33' },
  detailHeader: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailHeaderActions: { flexDirection: 'row' },
  detailTitle: { color: '#F5F7FA', fontSize: 24, fontWeight: '800' },
  headerSaveButton: {
    backgroundColor: '#F2C94C',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginRight: 10,
  },
  headerSaveButtonSaved: { backgroundColor: '#2ECC71' },
  headerSaveButtonText: { color: '#0A2540', fontWeight: '800' },
  closeDetailButton: {
    backgroundColor: '#163554',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  closeDetailText: { color: '#F5F7FA', fontWeight: '700' },
  detailContent: { padding: 20, paddingBottom: 180 },
  detailImageWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#081E33',
  },
  detailImage: { width: '100%', height: 340, backgroundColor: '#081E33' },
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
    backgroundColor: 'rgba(242,201,76,0.96)',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  detailPbIcon: { color: '#0A2540', fontSize: 11, fontWeight: '900', marginRight: 6 },
  detailPbText: { color: '#0A2540', fontSize: 12, fontWeight: '800' },
  detailImageMeta: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  detailImageDate: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  detailImageLocation: { color: '#E3EAF0', fontSize: 13, fontWeight: '500' },

  editCard: {
    backgroundColor: '#102C47',
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
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
  quickDateText: { color: '#F2C94C', fontSize: 12, fontWeight: '700' },
  noteInput: {
    backgroundColor: '#081E33',
    borderRadius: 16,
    color: '#F5F7FA',
    minHeight: 130,
    maxHeight: 180,
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
  pbRow: { flexDirection: 'row', alignItems: 'center' },
  pbTextWrap: { flex: 1 },
  pbTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  pbTitleIcon: { color: '#F2C94C', fontSize: 15, fontWeight: '900', marginRight: 8 },
  pbTitle: { color: '#F5F7FA', fontSize: 18, fontWeight: '800' },
  pbSubtitle: {
    color: '#A5B3C2',
    fontSize: 14,
    lineHeight: 20,
    paddingRight: 12,
  },
  saveSuccessText: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },

  mountActionCard: {
    backgroundColor: '#102C47',
    borderRadius: 22,
    padding: 16,
    marginTop: 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.24)',
  },
  mountActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  mountIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F2C94C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  mountActionCopy: { flex: 1 },
  mountActionTitle: {
    color: '#F5F7FA',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 3,
  },
  mountActionText: {
    color: '#A5B3C2',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  mountButton: {
    backgroundColor: '#F2C94C',
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: 'center',
  },
  mountButtonText: {
    color: '#0A2540',
    fontWeight: '900',
    fontSize: 15,
  },

  dangerZone: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 18,
    marginTop: 4,
    marginBottom: 30,
  },
  dangerZoneLabel: {
    color: '#8FA3B8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  bottomDeleteButton: {
    backgroundColor: '#5A1F1F',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  bottomDeleteButtonText: {
    color: '#FFD7D7',
    fontWeight: '800',
    fontSize: 15,
  },

  hiddenShareWrap: {
    position: 'absolute',
    left: -10000,
    top: 0,
    width: 390,
  },
  shareCard: {
    width: '100%',
    overflow: 'hidden',
    alignSelf: 'center',
    backgroundColor: '#102C47',
  },
  shareCardImage: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: '#081E33',
  },
  shareCardMeta: {
    backgroundColor: '#102C47',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  shareCardDate: {
    color: '#F2C94C',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  shareCardLocation: {
    color: '#A5B3C2',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  shareCardNote: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 12,
  },
  shareCardBrand: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    color: '#F2C94C',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    opacity: 0.9,
  },
});