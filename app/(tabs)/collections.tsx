import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const STORAGE_KEY = 'reelwall_catches';
const DELETED_CATCH_IDS_KEY = 'reelwall_deleted_catch_ids';

type CatchItem = {
  id: string;
  image_url?: string | null;
  note?: string | null;
  place_name?: string | null;
  region_name?: string | null;
  created_at?: string | null;
  catch_date?: string | null;
  date?: string | null;
  caught_at?: string | null;
  is_personal_best?: boolean | null;
  is_public?: boolean | null;
  mounted_at?: string | null;
  user_id?: string | null;
  source?: 'camera' | 'upload';
};

type LocalCatchItem = {
  id: string;
  uri: string;
  createdAt: string;
  catchDate?: string;
  caughtAt?: string;
  date?: string;
  placeName?: string;
  regionName?: string;
  weatherTemp?: number;
  weatherDescription?: string;
  note?: string;
  isPersonalBest?: boolean;
  source?: 'camera' | 'upload';
};

type CollectionItem = {
  id: string;
  title: string;
  description?: string | null;
  cover_image_url?: string | null;
  created_at?: string | null;
  is_public?: boolean | null;
  user_id?: string | null;
  catchIds: string[];
};

type CollectionCatchLink = {
  collection_id: string;
  catch_id: string;
};

const PRIMARY = '#F2C94C';
const BG = '#081E33';
const CARD = '#102C47';
const CARD_DARK = '#0B2238';
const CARD_ALT = '#163554';
const TEXT = '#F5F7FA';
const MUTED = '#B6C6D7';
const MUTED_2 = '#9FB0C2';
const SUCCESS = '#35D07F';
const DANGER = '#E86C6C';

function getPublicImageUrl(value?: string | null) {
  if (!value) return '';

  if (value.startsWith('file://')) return '';

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  const cleanPath = value.replace(/^\/+/, '').replace(/^catches\//, '');

  return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catches/${cleanPath}`;
}

function mapLocalCatchToRow(item: LocalCatchItem): CatchItem {
  return {
    id: String(item.id),
    image_url: item.uri || null,
    note: item.note || '',
    place_name: item.placeName || null,
    region_name: item.regionName || null,
    created_at: item.createdAt || null,
    catch_date: item.catchDate || item.date || item.caughtAt || item.createdAt || null,
    caught_at: item.caughtAt || null,
    date: item.date || null,
    is_personal_best: item.isPersonalBest ?? false,
    source: item.source || 'camera',
  };
}

function getCatchDisplayDate(item?: CatchItem | null) {
  if (!item) return '';

  return item.catch_date || item.caught_at || item.date || item.created_at || '';
}

function getCollectionUrl(collectionId: string) {
  return `https://www.reelwall.app/collections/${collectionId}`;
}

async function handleViewOnWeb(collection: CollectionItem) {
  if (!collection.is_public) {
    Alert.alert('Private Collection', 'Make this collection public to view it on the web.');
    return;
  }

  const url = getCollectionUrl(collection.id);

  try {
    await WebBrowser.openBrowserAsync(url);
  } catch (error) {
    Alert.alert('Could not open collection', url);
  }
}

async function handleShareCollection(collection: CollectionItem) {
  if (!collection.is_public) {
    Alert.alert('Private Collection', 'Make this collection public to share it.');
    return;
  }

  const url = getCollectionUrl(collection.id);

  try {
    await Share.share({
      message: `Check out this ReelWall collection\n\n${url}`,
      url,
    });
  } catch (e) {}
}

async function getDeletedCatchIds() {
  try {
    const raw = await AsyncStorage.getItem(DELETED_CATCH_IDS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function filterDeletedCatches(items: CatchItem[], deletedIds: string[]) {
  if (!deletedIds.length) return items;
  const deletedSet = new Set(deletedIds.map(String));
  return items.filter((item) => !deletedSet.has(String(item.id)));
}

export default function CollectionsScreen() {
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [catches, setCatches] = useState<CatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftIsPublic, setDraftIsPublic] = useState(false);

  const [selectedCollection, setSelectedCollection] = useState<CollectionItem | null>(null);
  const [manageSearch, setManageSearch] = useState('');
  const [manageSource, setManageSource] = useState<'all' | 'mounted'>('all');
  const [savingCatchId, setSavingCatchId] = useState<string | null>(null);

  const [showCollectionPhotosModal, setShowCollectionPhotosModal] = useState(false);
  const [galleryCollection, setGalleryCollection] = useState<CollectionItem | null>(null);

  const [shareCollectionItem, setShareCollectionItem] = useState<CollectionItem | null>(null);
  const collectionShareCardRef = useRef<View | null>(null);

  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);
  const [fullscreenLoading, setFullscreenLoading] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('collections-screen-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catches' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collection_catches' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collections' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const catchesById = useMemo(() => {
    const map = new Map<string, CatchItem>();
    catches.forEach((item) => map.set(item.id, item));
    return map;
  }, [catches]);

  const selectedCollectionFresh = useMemo(() => {
    if (!selectedCollection) return null;
    return collections.find((item) => item.id === selectedCollection.id) || null;
  }, [collections, selectedCollection]);

  const galleryCollectionFresh = useMemo(() => {
    if (!galleryCollection) return null;
    return collections.find((item) => item.id === galleryCollection.id) || null;
  }, [collections, galleryCollection]);

  const filteredManageCatches = useMemo(() => {
    const q = manageSearch.trim().toLowerCase();

    const sourceFiltered =
      manageSource === 'mounted'
        ? catches.filter((item) => !!item.is_public || !!item.mounted_at)
        : catches;

    if (!q) return sourceFiltered;

    return sourceFiltered.filter((item) => {
      const values = [
        item.place_name || '',
        item.region_name || '',
        item.note || '',
        formatDate(getCatchDisplayDate(item)),
      ].join(' ');

      return values.toLowerCase().includes(q);
    });
  }, [catches, manageSearch, manageSource]);

  const galleryPhotos = useMemo(() => {
    if (!galleryCollectionFresh) return [];

    return galleryCollectionFresh.catchIds
      .map((id) => catchesById.get(id))
      .filter(Boolean) as CatchItem[];
  }, [galleryCollectionFresh, catchesById]);

  function formatDate(value?: string | null) {
    if (!value) return '';

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) {
      return value;
    }

    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getCatchLabel(item: CatchItem) {
    if (item.place_name) return item.place_name;
    if (item.region_name) return item.region_name;
    if (item.note) return item.note;
    return 'Catch';
  }

  function resetDrafts() {
    setDraftTitle('');
    setDraftDescription('');
    setDraftIsPublic(false);
  }

  function openCollectionPhotos(collection: CollectionItem) {
    setShowCollectionPhotosModal(true);

    requestAnimationFrame(() => {
      setGalleryCollection(collection);
    });
  }

  function closeCollectionPhotos() {
    closeFullscreenImage();
    setGalleryCollection(null);
    setShowCollectionPhotosModal(false);
  }

  function openFullscreenImage(imageUrl?: string | null) {
    if (!imageUrl) return;

    setShowFullscreenOverlay(true);
    setFullscreenLoading(true);

    requestAnimationFrame(() => {
      setFullscreenImageUrl(imageUrl);
    });
  }

  function closeFullscreenImage() {
    setShowFullscreenOverlay(false);
    setFullscreenImageUrl(null);
    setFullscreenLoading(false);
  }

  async function loadData() {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setCollections([]);
        setCatches([]);
        return;
      }

      const deletedIds = await getDeletedCatchIds();

      const { data: collectionRows, error: collectionError } = await supabase
        .from('collections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (collectionError) throw collectionError;

      const typedCollections =
        ((collectionRows || []) as Omit<CollectionItem, 'catchIds'>[]).map((item) => ({
          ...item,
          catchIds: [],
        }));

      const collectionIds = typedCollections.map((item) => item.id);

      let linkRows: CollectionCatchLink[] = [];

      if (collectionIds.length > 0) {
        const { data: collectionLinks, error: linksError } = await supabase
          .from('collection_catches')
          .select('collection_id, catch_id')
          .in('collection_id', collectionIds);

        if (linksError) throw linksError;

        linkRows = (collectionLinks || []) as CollectionCatchLink[];
      }

      const { data: allCatchRows, error: allCatchError } = await supabase
        .from('catches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (allCatchError) throw allCatchError;

      const supabaseCatchRows = (allCatchRows || []) as CatchItem[];
      const catchRows = filterDeletedCatches(supabaseCatchRows, deletedIds);
      const validCatchIdSet = new Set(catchRows.map((item) => String(item.id)));

      const nextCollections = typedCollections.map((collection) => ({
        ...collection,
        catchIds: linkRows
          .filter(
            (link) =>
              link.collection_id === collection.id &&
              validCatchIdSet.has(String(link.catch_id))
          )
          .map((link) => String(link.catch_id)),
      }));

      setCollections(nextCollections);
      setCatches(catchRows);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not load collections.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
  }

  async function updateCollectionVisibility(collectionId: string, isPublic: boolean) {
    const { error } = await supabase
      .from('collections')
      .update({ is_public: isPublic })
      .eq('id', collectionId);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    await loadData();
  }

  async function createCollection() {
    const trimmedTitle = draftTitle.trim();

    if (!trimmedTitle) {
      Alert.alert('Missing title', 'Please enter a collection name.');
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      Alert.alert('Error', 'User not logged in');
      return;
    }

    const { error } = await supabase.from('collections').insert([
      {
        user_id: user.id,
        title: trimmedTitle,
        description: draftDescription.trim() || null,
        cover_image_url: null,
        is_public: draftIsPublic,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    resetDrafts();
    setShowCreateModal(false);
    await loadData();
  }

  async function deleteCollection(collectionId: string) {
    Alert.alert('Delete collection?', 'This removes the collection, but not the catches inside it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase
              .from('collection_catches')
              .delete()
              .eq('collection_id', collectionId);

            const { error } = await supabase
              .from('collections')
              .delete()
              .eq('id', collectionId);

            if (error) throw error;

            if (selectedCollection?.id === collectionId) {
              setSelectedCollection(null);
            }

            if (galleryCollection?.id === collectionId) {
              closeCollectionPhotos();
            }

            await loadData();
          } catch (error: any) {
            Alert.alert('Error', error?.message || 'Could not delete collection');
          }
        },
      },
    ]);
  }

  async function updateCollectionCoverFromCatch(collectionId: string, imageUrl?: string | null) {
    if (!imageUrl) {
      await loadData();
      return;
    }

    const { error } = await supabase
      .from('collections')
      .update({ cover_image_url: imageUrl })
      .eq('id', collectionId);

    if (error) {}

    await loadData();
  }

  async function addCatchToCollection(collectionId: string, catchId: string) {
    const collection = collections.find((item) => item.id === collectionId);
    if (!collection) return;

    if (collection.catchIds.includes(catchId)) {
      return;
    }

    const catchItem = catchesById.get(catchId);
    setSavingCatchId(catchId);

    const { error } = await supabase.from('collection_catches').insert([
      {
        collection_id: collectionId,
        catch_id: catchId,
      },
    ]);

    if (error) {
      Alert.alert('Error', error.message);
      setSavingCatchId(null);
      return;
    }

    if (!collection.cover_image_url && catchItem?.image_url) {
      if (catchItem.image_url.startsWith('file://')) {
        await loadData();
        setSavingCatchId(null);
        return;
      }

      const publicUrl = getPublicImageUrl(catchItem.image_url);

      const cleanPath = publicUrl.includes('/public/catches/')
        ? publicUrl.split('/public/catches/')[1]
        : publicUrl;

      await updateCollectionCoverFromCatch(collectionId, cleanPath);
    } else {
      await loadData();
    }

    setSavingCatchId(null);
  }

  async function removeCatchFromCollection(collectionId: string, catchId: string) {
    Alert.alert('Remove from Collection', 'This catch will stay on your wall.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        onPress: async () => {
          try {
            setSavingCatchId(catchId);

            const { error } = await supabase
              .from('collection_catches')
              .delete()
              .eq('collection_id', collectionId)
              .eq('catch_id', catchId);

            if (error) throw error;

            await loadData();
          } catch (error: any) {
            console.log('Remove catch link error:', error);
            Alert.alert('Error', error?.message || 'Could not remove catch.');
          } finally {
            setSavingCatchId(null);
          }
        },
      },
    ]);
  }

  async function toggleCatchInCollection(collectionId: string, catchId: string) {
    const collection = collections.find((item) => item.id === collectionId);
    if (!collection) return;

    const isAdded = collection.catchIds.includes(catchId);

    if (isAdded) {
      await removeCatchFromCollection(collectionId, catchId);
    } else {
      await addCatchToCollection(collectionId, catchId);
    }
  }

  function openManageModal(collection: CollectionItem) {
    setManageSearch('');
    setManageSource('all');
    setSelectedCollection(collection);
  }

  function closeManageModal() {
    setSelectedCollection(null);
    setManageSearch('');
    setManageSource('all');
    setSavingCatchId(null);
  }

  function renderCollectionCard({ item }: { item: CollectionItem }) {
    const linkedCatches = item.catchIds
      .map((id) => catchesById.get(id))
      .filter(Boolean) as CatchItem[];

    const coverImage = getPublicImageUrl(item.cover_image_url || linkedCatches[0]?.image_url || '');
    const photoCount = linkedCatches.length;

    const meta = [
      `${photoCount} ${photoCount === 1 ? 'catch' : 'catches'}`,
      item.is_public ? 'Public Web Collection' : 'Private Collection',
      formatDate(item.created_at),
    ]
      .filter(Boolean)
      .join(' • ');

    return (
      <View style={styles.collectionCard}>
        <TouchableOpacity
          style={styles.heroWrap}
          activeOpacity={0.92}
          onPress={() => openCollectionPhotos(item)}
        >
          {coverImage ? (
            <Image source={{ uri: coverImage }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroFallback}>
              <Text style={styles.heroFallbackText}>Add catches to build this collection</Text>
            </View>
          )}

          <View style={styles.heroOverlay} />

          <View style={styles.heroTextWrap}>
            <View style={styles.heroBottomBadges}>
              <View style={[styles.visibilityBadge, !item.is_public && styles.visibilityBadgePrivate]}>
                <Text style={[styles.visibilityBadgeText, !item.is_public && styles.visibilityBadgeTextPrivate]}>
                  {item.is_public ? 'PUBLIC' : 'PRIVATE'}
                </Text>
              </View>
            </View>

            <Text style={styles.collectionTitle}>{item.title}</Text>

            {!!item.description && (
              <Text style={styles.collectionDescription} numberOfLines={2}>
                {item.description}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <Text style={styles.metaLine}>{meta}</Text>
        <Text style={styles.tapHint}>Tap image to view collection photos</Text>

        <View style={styles.cardActionRow}>
          <TouchableOpacity
            style={styles.manageButton}
            onPress={() => openManageModal(item)}
            activeOpacity={0.88}
          >
            <Text style={styles.manageButtonText}>Manage</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => handleViewOnWeb(item)}
            activeOpacity={0.88}
          >
            <Text style={styles.secondaryButtonText}>Web</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => handleShareCollection(item)}
            activeOpacity={0.88}
          >
            <Text style={styles.secondaryButtonText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderManageCatchItem({ item }: { item: CatchItem }) {
    if (!selectedCollectionFresh) return null;

    const added = selectedCollectionFresh.catchIds.includes(item.id);
    const busy = savingCatchId === item.id;

    return (
      <TouchableOpacity
        style={[styles.manageCatchCard, added && styles.manageCatchCardAdded]}
        activeOpacity={0.9}
        disabled={busy}
        onPress={() => toggleCatchInCollection(selectedCollectionFresh.id, item.id)}
      >
        {!!item.image_url ? (
          <Image source={{ uri: getPublicImageUrl(item.image_url) }} style={styles.manageCatchImage} />
        ) : (
          <View style={styles.manageCatchFallback}>
            <Text style={styles.manageCatchFallbackText}>No photo</Text>
          </View>
        )}

        <View style={styles.manageCatchOverlay} />

        {!!item.is_personal_best && (
          <View style={styles.pbBadge}>
            <Text style={styles.pbBadgeText}>PB</Text>
          </View>
        )}

        {!!item.mounted_at || !!item.is_public ? (
          <View style={styles.mountedBadge}>
            <Text style={styles.mountedBadgeText}>Mounted</Text>
          </View>
        ) : null}

        <View style={styles.manageCatchBottom}>
          <Text style={styles.manageCatchTitle} numberOfLines={1}>
            {getCatchLabel(item)}
          </Text>

          <Text style={styles.manageCatchDate} numberOfLines={1}>
            {formatDate(getCatchDisplayDate(item)) || ' '}
          </Text>

          <View style={[styles.manageStatusPill, added && styles.manageStatusPillAdded]}>
            <Text
              style={[
                styles.manageStatusPillText,
                added && styles.manageStatusPillTextAdded,
              ]}
            >
              {busy ? 'Saving...' : added ? 'In Collection' : 'Add'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  function renderGalleryPhoto({ item }: { item: CatchItem }) {
    return (
      <TouchableOpacity
        style={styles.galleryPhotoCard}
        activeOpacity={0.92}
        onPress={() => openFullscreenImage(getPublicImageUrl(item.image_url))}
      >
        {!!item.image_url ? (
          <Image source={{ uri: getPublicImageUrl(item.image_url) }} style={styles.galleryPhotoImage} />
        ) : (
          <View style={styles.galleryPhotoFallback}>
            <Text style={styles.galleryPhotoFallbackText}>No photo</Text>
          </View>
        )}

        <View style={styles.galleryPhotoOverlay} />

        <View style={styles.galleryPhotoBottom}>
          <Text style={styles.galleryPhotoTitle} numberOfLines={1}>
            {getCatchLabel(item)}
          </Text>

          {!!formatDate(getCatchDisplayDate(item)) && (
            <Text style={styles.galleryPhotoDate} numberOfLines={1}>
              {formatDate(getCatchDisplayDate(item))}
            </Text>
          )}
        </View>

        {!!item.is_personal_best && (
          <View style={styles.pbBadge}>
            <Text style={styles.pbBadgeText}>PB</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={collections}
        keyExtractor={(item) => item.id}
        renderItem={renderCollectionCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>FISH'N MEMORIES</Text>
            <Text style={styles.title}>Collections</Text>
            <Text style={styles.subtitle}>
              Build collections around your trips, species, seasons, crews, and memories.

Keep them private — or share.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setShowCreateModal(true)}
              activeOpacity={0.88}
            >
              <Text style={styles.primaryButtonText}>Start a Collection</Text>
            </TouchableOpacity>

            <View style={styles.pageSummaryRow}>
              <View style={styles.pageSummaryCard}>
                <Text style={styles.pageSummaryNumber}>{collections.length}</Text>
                <Text style={styles.pageSummaryLabel}>Collections</Text>
              </View>

              <View style={styles.pageSummaryCard}>
                <Text style={styles.pageSummaryNumber}>{catches.length}</Text>
                <Text style={styles.pageSummaryLabel}>Moments</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No collections yet</Text>
              <Text style={styles.emptyStateText}>
                Start a collection to organize catches around a trip, story, season, or trophy moment.
              </Text>
            </View>
          ) : null
        }
      />

      <Modal visible={showCreateModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>New Collection</Text>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    resetDrafts();
                    setShowCreateModal(false);
                  }}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                value={draftTitle}
                onChangeText={setDraftTitle}
                placeholder="Fall Muskies"
                placeholderTextColor="#7D8FA3"
                style={styles.input}
                returnKeyType="next"
              />

              <Text style={styles.inputLabel}>Story</Text>
              <TextInput
                value={draftDescription}
                onChangeText={setDraftDescription}
                placeholder="Big fish, cold mornings, and the ones worth remembering."
                placeholderTextColor="#7D8FA3"
                style={[styles.input, styles.textArea]}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.inputLabel}>Visibility</Text>

              <View style={styles.visibilitySelector}>
                <TouchableOpacity
                  style={[
                    styles.visibilityOption,
                    !draftIsPublic && styles.visibilityOptionActive,
                  ]}
                  onPress={() => setDraftIsPublic(false)}
                  activeOpacity={0.88}
                >
                  <Text
                    style={[
                      styles.visibilityOptionTitle,
                      !draftIsPublic && styles.visibilityOptionTitleActive,
                    ]}
                  >
                    Private
                  </Text>
                  <Text
                    style={[
                      styles.visibilityOptionText,
                      !draftIsPublic && styles.visibilityOptionTextActive,
                    ]}
                  >
                    Only you can see it
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.visibilityOption,
                    draftIsPublic && styles.visibilityOptionActive,
                  ]}
                  onPress={() => setDraftIsPublic(true)}
                  activeOpacity={0.88}
                >
                  <Text
                    style={[
                      styles.visibilityOptionTitle,
                      draftIsPublic && styles.visibilityOptionTitleActive,
                    ]}
                  >
                    Public
                  </Text>
                  <Text
                    style={[
                      styles.visibilityOptionText,
                      draftIsPublic && styles.visibilityOptionTextActive,
                    ]}
                  >
                    Show on web wall
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.visibilityHelp}>
                Private collections stay in the app. Public collections can be viewed and shared from your ReelWall web page.
              </Text>

              <TouchableOpacity style={styles.createButton} onPress={createCollection}>
                <Text style={styles.createButtonText}>Create Collection</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!selectedCollectionFresh} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.manageModalShell}>
            <View style={styles.manageModalCard}>
              <View style={styles.modalHeaderRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.modalTitleSmall}>Manage Collection</Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedCollectionFresh?.title || ''}
                  </Text>
                </View>

                <TouchableOpacity style={styles.closeButton} onPress={closeManageModal}>
                  <Text style={styles.closeButtonText}>Done</Text>
                </TouchableOpacity>
              </View>

              {selectedCollectionFresh && (
                <View style={styles.manageVisibilityCard}>
                  <Text style={styles.manageVisibilityLabel}>Visibility</Text>

                  <View style={styles.visibilitySelector}>
                    <TouchableOpacity
                      style={[
                        styles.visibilityOption,
                        !selectedCollectionFresh.is_public && styles.visibilityOptionActive,
                      ]}
                      onPress={() =>
                        updateCollectionVisibility(selectedCollectionFresh.id, false)
                      }
                      activeOpacity={0.88}
                    >
                      <Text
                        style={[
                          styles.visibilityOptionTitle,
                          !selectedCollectionFresh.is_public &&
                            styles.visibilityOptionTitleActive,
                        ]}
                      >
                        Private
                      </Text>
                      <Text
                        style={[
                          styles.visibilityOptionText,
                          !selectedCollectionFresh.is_public &&
                            styles.visibilityOptionTextActive,
                        ]}
                      >
                        App only
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.visibilityOption,
                        !!selectedCollectionFresh.is_public && styles.visibilityOptionActive,
                      ]}
                      onPress={() =>
                        updateCollectionVisibility(selectedCollectionFresh.id, true)
                      }
                      activeOpacity={0.88}
                    >
                      <Text
                        style={[
                          styles.visibilityOptionTitle,
                          !!selectedCollectionFresh.is_public &&
                            styles.visibilityOptionTitleActive,
                        ]}
                      >
                        Public
                      </Text>
                      <Text
                        style={[
                          styles.visibilityOptionText,
                          !!selectedCollectionFresh.is_public &&
                            styles.visibilityOptionTextActive,
                        ]}
                      >
                        Web wall
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.manageSourceRow}>
                <TouchableOpacity
                  style={[
                    styles.manageSourcePill,
                    manageSource === 'all' && styles.manageSourcePillActive,
                  ]}
                  onPress={() => setManageSource('all')}
                  activeOpacity={0.88}
                >
                  <Text
                    style={[
                      styles.manageSourcePillText,
                      manageSource === 'all' && styles.manageSourcePillTextActive,
                    ]}
                  >
                    All Catches
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.manageSourcePill,
                    manageSource === 'mounted' && styles.manageSourcePillActive,
                  ]}
                  onPress={() => setManageSource('mounted')}
                  activeOpacity={0.88}
                >
                  <Text
                    style={[
                      styles.manageSourcePillText,
                      manageSource === 'mounted' && styles.manageSourcePillTextActive,
                    ]}
                  >
                    Mounted
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.manageTopActions}>
                <TextInput
                  value={manageSearch}
                  onChangeText={setManageSearch}
                  placeholder="Search catches..."
                  placeholderTextColor="#7D8FA3"
                  style={styles.searchInput}
                />
              </View>

              <View style={styles.manageStatsRow}>
                <View style={styles.manageStatPill}>
                  <Text style={styles.manageStatPillText}>
                    {selectedCollectionFresh?.catchIds.length || 0} selected
                  </Text>
                </View>

                <View style={styles.manageStatPill}>
                  <Text style={styles.manageStatPillText}>
                    {filteredManageCatches.length} shown
                  </Text>
                </View>
              </View>

              {filteredManageCatches.length === 0 ? (
                <View style={styles.emptyInlineState}>
                  <Text style={styles.emptyInlineTitle}>No catches here</Text>
                  <Text style={styles.emptyInlineText}>
                    {manageSource === 'mounted'
                      ? 'Mount catches to ReelWall first, then add them here.'
                      : 'Try a different search term.'}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredManageCatches}
                  extraData={{
                    catchesCount: filteredManageCatches.length,
                    selectedIds: selectedCollectionFresh?.catchIds.join(',') || '',
                    savingCatchId,
                    manageSource,
                  }}
                  keyExtractor={(item) => item.id}
                  numColumns={2}
                  renderItem={renderManageCatchItem}
                  columnWrapperStyle={styles.manageGridRow}
                  contentContainerStyle={styles.manageGrid}
                  ListFooterComponent={
  selectedCollectionFresh ? (
    <TouchableOpacity
      style={styles.deleteCollectionButtonBottom}
      onPress={() => deleteCollection(selectedCollectionFresh.id)}
      activeOpacity={0.88}
    >
      <Text style={styles.deleteCollectionButtonText}>
        Delete Collection
      </Text>
    </TouchableOpacity>
  ) : null
}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  initialNumToRender={8}
                  maxToRenderPerBatch={8}
                  windowSize={6}
                  removeClippedSubviews={Platform.OS === 'android'}
                />
              )}

              
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showCollectionPhotosModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.galleryModalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.modalTitleSmall}>Collection Photos</Text>
                <Text style={styles.modalSubtitle}>
                  {galleryCollectionFresh?.title || ''}
                </Text>
              </View>

              <TouchableOpacity style={styles.closeButton} onPress={closeCollectionPhotos}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            {galleryPhotos.length ? (
              <FlatList
                data={galleryPhotos}
                keyExtractor={(item) => item.id}
                numColumns={2}
                renderItem={renderGalleryPhoto}
                columnWrapperStyle={styles.manageGridRow}
                contentContainerStyle={styles.manageGrid}
                showsVerticalScrollIndicator={false}
                initialNumToRender={6}
                maxToRenderPerBatch={6}
                windowSize={5}
                removeClippedSubviews={Platform.OS === 'android'}
                updateCellsBatchingPeriod={50}
              />
            ) : (
              <View style={styles.emptyInlineState}>
                <Text style={styles.emptyInlineTitle}>No photos yet</Text>
                <Text style={styles.emptyInlineText}>
                  Add catches to build this collection.
                </Text>
              </View>
            )}

            {showFullscreenOverlay && (
              <View style={styles.fullscreenOverlay}>
                <TouchableOpacity
                  style={styles.fullscreenCloseButton}
                  onPress={closeFullscreenImage}
                  activeOpacity={0.88}
                >
                  <Text style={styles.fullscreenCloseButtonText}>Close</Text>
                </TouchableOpacity>

                {fullscreenLoading && (
                  <View style={styles.fullscreenLoadingWrap}>
                    <Text style={styles.fullscreenLoadingText}>Loading photo...</Text>
                  </View>
                )}

                {!!fullscreenImageUrl && (
                  <ScrollView
                    style={styles.fullscreenZoomScroll}
                    contentContainerStyle={styles.fullscreenZoomContent}
                    maximumZoomScale={3}
                    minimumZoomScale={1}
                    bouncesZoom
                    pinchGestureEnabled
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    centerContent
                  >
                    <Image
                      source={{ uri: fullscreenImageUrl }}
                      style={styles.fullscreenZoomImage}
                      resizeMode="contain"
                      onLoadStart={() => setFullscreenLoading(true)}
                      onLoadEnd={() => setFullscreenLoading(false)}
                    />
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      <View style={styles.hiddenCollectionShareWrap} pointerEvents="none">
        {shareCollectionItem && (
          <View
            ref={collectionShareCardRef}
            collapsable={false}
            style={styles.collectionShareCard}
          >
            <Image
              source={{
                uri: getPublicImageUrl(
                  shareCollectionItem.cover_image_url ||
                    catchesById.get(shareCollectionItem.catchIds[0])?.image_url ||
                    ''
                ),
              }}
              style={styles.collectionShareImage}
            />

            <View style={styles.collectionShareMeta}>
              <Text style={styles.collectionShareEyebrow}>REELWALL COLLECTION</Text>

              <Text style={styles.collectionShareTitle}>
                {shareCollectionItem.title}
              </Text>

              {!!shareCollectionItem.description && (
                <Text style={styles.collectionShareDescription} numberOfLines={3}>
                  {shareCollectionItem.description}
                </Text>
              )}

              <Text style={styles.collectionShareStats}>
                {shareCollectionItem.catchIds.length}{' '}
                {shareCollectionItem.catchIds.length === 1 ? 'catch' : 'catches'} • Public Collection
              </Text>

              <Text style={styles.collectionShareBrand}>
                A MOMENT WORTH REMEMBERING • REELWALL 🎣
              </Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  secondaryButton: {
    backgroundColor: CARD_DARK,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButtonText: {
    color: TEXT,
    fontWeight: '800',
    fontSize: 13,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },

  eyebrow: {
    color: PRIMARY,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 6,
    fontSize: 11,
  },

  title: {
    color: TEXT,
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: -0.4,
  },

  subtitle: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
    maxWidth: 365,
    fontWeight: '600',
  },

  fullscreenZoomScroll: {
    width: '100%',
    height: '100%',
  },

  fullscreenZoomContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  fullscreenZoomImage: {
    width: '100%',
    height: '100%',
  },

  primaryButton: {
    backgroundColor: PRIMARY,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 999,
  },

  primaryButtonText: {
    color: '#0A2540',
    fontWeight: '900',
    fontSize: 15,
  },

  pageSummaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },

  pageSummaryCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
  },

  pageSummaryNumber: {
    color: PRIMARY,
    fontSize: 24,
    fontWeight: '900',
  },

  pageSummaryLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 18,
  },

  collectionCard: {
    backgroundColor: CARD,
    borderRadius: 26,
    padding: 14,
  },

  heroWrap: {
    position: 'relative',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: CARD_ALT,
  },

  heroImage: {
    width: '100%',
    height: 220,
    backgroundColor: BG,
  },

  heroFallback: {
    width: '100%',
    height: 220,
    backgroundColor: CARD_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroFallbackText: {
    color: MUTED_2,
    fontWeight: '700',
    fontSize: 11,
  },

  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.24)',
  },

  heroTextWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },

  heroBottomBadges: {
    flexDirection: 'row',
    marginBottom: 8,
  },

  visibilityBadge: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },

  visibilityBadgePrivate: {
    backgroundColor: 'rgba(16,44,71,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.45)',
  },

  visibilityBadgeText: {
    color: '#0A2540',
    fontSize: 10,
    fontWeight: '900',
  },

  visibilityBadgeTextPrivate: {
    color: PRIMARY,
  },

  collectionTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 6,
  },

  collectionDescription: {
    color: '#E3EBF3',
    fontSize: 15,
    lineHeight: 20,
  },

  metaLine: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 14,
    marginBottom: 6,
  },

  tapHint: {
    color: MUTED,
    fontSize: 12,
    marginBottom: 14,
  },

  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  manageButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  manageButtonText: {
    color: '#0A2540',
    fontWeight: '900',
    fontSize: 13,
  },

  pbBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(242,201,76,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },

  pbBadgeText: {
    color: '#0A2540',
    fontSize: 10,
    fontWeight: '900',
  },

  mountedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },

  mountedBadgeText: {
    color: PRIMARY,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  emptyInlineState: {
    backgroundColor: CARD_DARK,
    borderRadius: 18,
    padding: 16,
  },

  emptyInlineTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },

  emptyInlineText: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 21,
  },

  emptyState: {
    backgroundColor: CARD,
    padding: 22,
    borderRadius: 22,
    alignItems: 'center',
    marginTop: 8,
  },

  emptyStateTitle: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
  },

  emptyStateText: {
    color: MUTED,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 15,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 20,
  },

  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  modalCard: {
    backgroundColor: CARD,
    borderRadius: 28,
    padding: 20,
    marginVertical: 24,
  },

  manageModalShell: {
    flex: 1,
    justifyContent: 'center',
  },

  manageModalCard: {
    backgroundColor: CARD,
    borderRadius: 28,
    padding: 18,
    flex: 1,
    maxHeight: '92%',
  },

  galleryModalCard: {
    backgroundColor: CARD,
    borderRadius: 28,
    padding: 18,
    flex: 1,
    marginTop: 40,
    marginBottom: 20,
    overflow: 'hidden',
  },

  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },

  modalTitle: {
    color: TEXT,
    fontSize: 28,
    fontWeight: '900',
  },

  modalTitleSmall: {
    color: TEXT,
    fontSize: 24,
    fontWeight: '900',
  },

  modalSubtitle: {
    color: MUTED,
    marginTop: 4,
    fontSize: 14,
  },

  closeButton: {
    backgroundColor: '#17385A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },

  closeButtonText: {
    color: TEXT,
    fontWeight: '800',
    fontSize: 14,
  },

  inputLabel: {
    color: TEXT,
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 8,
    marginTop: 8,
  },

  input: {
    backgroundColor: BG,
    color: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 10,
  },

  textArea: {
    minHeight: 120,
  },

  visibilitySelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },

 visibilityOption: {
  flex: 1, // or width: 110 if you're using fixed width
  backgroundColor: CARD_DARK,
  borderRadius: 999,
  paddingVertical: 8,
  paddingHorizontal: 10,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.07)',
  alignItems: 'center',       // ✅ horizontal center
  justifyContent: 'center',   // ✅ vertical center
},

  visibilityOptionActive: {
    borderColor: 'rgba(242,201,76,0.75)',
    backgroundColor: 'rgba(242,201,76,0.12)',
  },

  visibilityOptionTitle: {
  color: TEXT,
  fontSize: 12,
  fontWeight: '900',
  textAlign: 'center',        // ✅ ensures text itself is centered
},

  visibilityOptionTitleActive: {
    color: 'none',
  },

  visibilityOptionText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },

  visibilityOptionTextActive: {
    color: '#E8D68D',
  },

  visibilityHelp: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 18,
  },

  manageVisibilityCard: {
  backgroundColor: 'transparent',
  marginBottom: 8,
},

manageVisibilityLabel: {
  color: MUTED,
  fontSize: 11,
  fontWeight: '900',
  marginBottom: 6,
  textTransform: 'uppercase',
},

  manageSourceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },

  manageSourcePill: {
    flex: 1,
    backgroundColor: CARD_DARK,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  manageSourcePillActive: {
    backgroundColor: 'rgba(242,201,76,0.13)',
    borderColor: 'rgba(242,201,76,0.65)',
  },

  manageSourcePillText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '900',
  },

  manageSourcePillTextActive: {
    color: PRIMARY,
  },

  createButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
  },

  createButtonText: {
    color: '#0A2540',
    fontWeight: '900',
    fontSize: 16,
  },

  manageTopActions: {
    marginBottom: 12,
  },

  searchInput: {
    backgroundColor: BG,
    color: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 10,
  },

  deleteCollectionButtonBottom: {
  marginTop: 18,
  marginBottom: 24,
  backgroundColor: 'rgba(232,108,108,0.14)',
  borderWidth: 1,
  borderColor: 'rgba(232,108,108,0.4)',
  paddingVertical: 14,
  borderRadius: 16,
  alignItems: 'center',
},

  deleteCollectionButtonText: {
    color: DANGER,
    fontWeight: '800',
    fontSize: 13,
  },

  manageStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },

  manageStatPill: {
    backgroundColor: CARD_DARK,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  manageStatPillText: {
    color: TEXT,
    fontWeight: '800',
    fontSize: 12,
  },

  manageGrid: {
    paddingBottom: 20,
  },

  manageGridRow: {
    gap: 12,
    marginBottom: 12,
  },

  manageCatchCard: {
    flex: 1,
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: CARD_DARK,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },

  manageCatchCardAdded: {
    borderColor: SUCCESS,
  },

  manageCatchImage: {
    width: '100%',
    height: '100%',
  },

  manageCatchFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_DARK,
  },

  manageCatchFallbackText: {
    color: MUTED_2,
    fontWeight: '700',
  },

  manageCatchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },

  manageCatchBottom: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
  },

  manageCatchTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },

  manageCatchDate: {
    color: '#DDE7F0',
    fontSize: 11,
    marginTop: 4,
    marginBottom: 8,
  },

  manageStatusPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(242,201,76,0.96)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  manageStatusPillAdded: {
    backgroundColor: 'rgba(53,208,127,0.96)',
  },

  manageStatusPillText: {
    color: '#0A2540',
    fontWeight: '900',
    fontSize: 11,
  },

  manageStatusPillTextAdded: {
    color: '#062919',
  },

  galleryPhotoCard: {
    flex: 1,
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: CARD_DARK,
  },

  galleryPhotoImage: {
    width: '100%',
    height: '100%',
  },

  galleryPhotoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_DARK,
  },

  galleryPhotoFallbackText: {
    color: MUTED_2,
    fontWeight: '700',
  },

  galleryPhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },

  galleryPhotoBottom: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
  },

  galleryPhotoTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },

  galleryPhotoDate: {
    color: '#DDE7F0',
    fontSize: 11,
    marginTop: 4,
  },

  fullscreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 20,
  },

  fullscreenCloseButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 30,
    backgroundColor: PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },

  fullscreenCloseButtonText: {
    color: '#0A2540',
    fontWeight: '900',
    fontSize: 14,
  },

  fullscreenLoadingWrap: {
    position: 'absolute',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    zIndex: 25,
  },

  fullscreenLoadingText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  hiddenCollectionShareWrap: {
    position: 'absolute',
    left: -10000,
    top: 0,
    width: 390,
  },

  collectionShareCard: {
    width: 390,
    backgroundColor: '#102C47',
    overflow: 'hidden',
  },

  collectionShareImage: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
    backgroundColor: '#081E33',
  },

  collectionShareMeta: {
    backgroundColor: '#102C47',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
  },

  collectionShareEyebrow: {
    color: '#F2C94C',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 8,
  },

  collectionShareTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 8,
  },

  collectionShareDescription: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    marginBottom: 12,
  },

  collectionShareStats: {
    color: '#B6C6D7',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 14,
  },

  collectionShareBrand: {
    color: '#F2C94C',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
});