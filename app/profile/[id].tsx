import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    FlatList,
    Image,
    Modal,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

type MountItem = {
  id: string;
  image_url?: string | null;
  note?: string | null;
  place_name?: string | null;
  region_name?: string | null;
  mounted_at?: string | null;
  catch_date?: string | null;
  is_personal_best?: boolean | null;
};

type ProfileItem = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  location?: string | null;
  species?: string | null;
  favorite_technique?: string | null;
  boat?: string | null;
};

const PRIMARY = '#F2C94C';
const BG = '#081E33';
const CARD = '#102C47';
const TEXT = '#F5F7FA';
const MUTED = '#A5B3C2';

export default function PublicProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [profile, setProfile] = useState<ProfileItem | null>(null);
  const [mounts, setMounts] = useState<MountItem[]>([]);
  const [selectedMount, setSelectedMount] = useState<MountItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const getPublicImageUrl = (value?: string | null) => {
    if (!value) return '';

    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }

    const cleanPath = value.replace(/^\/+/, '').replace(/^catches\//, '');

    return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catches/${cleanPath}`;
  };

  const loadProfile = async () => {
    if (!id) return;

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select(
        'id, username, display_name, avatar_url, location, species, favorite_technique, boat'
      )
      .eq('id', id)
      .single();

    if (profileError) {
      console.log('Public profile load error:', profileError);
      setProfile(null);
    } else {
      setProfile(profileData as ProfileItem);
    }

    const { data: mountsData, error: mountsError } = await supabase
      .from('catches')
      .select('*')
      .eq('user_id', id)
      .eq('is_public', true)
      .order('mounted_at', { ascending: false });

    if (mountsError) {
      console.log('Public profile mounts load error:', mountsError);
      setMounts([]);
      return;
    }

    setMounts((mountsData || []) as MountItem[]);
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const displayName =
    profile?.display_name || profile?.username || 'Angler';

  const username = profile?.username ? `@${profile.username}` : '';

  const pbCount = mounts.filter((item) => item.is_personal_best).length;

  const renderMount = ({ item }: { item: MountItem }) => {
    const imageUrl = getPublicImageUrl(item.image_url);
    const location = item.place_name || item.region_name || '';

    return (
      <TouchableOpacity
        style={styles.gridItem}
        activeOpacity={0.9}
        onPress={() => setSelectedMount(item)}
      >
        <Image source={{ uri: imageUrl }} style={styles.gridImage} />

        {item.is_personal_best && (
          <View style={styles.pbBadge}>
            <Text style={styles.pbText}>★ PB</Text>
          </View>
        )}

        <View style={styles.gridOverlay}>
          {!!item.catch_date && (
            <Text style={styles.gridDate} numberOfLines={1}>
              {item.catch_date}
            </Text>
          )}

          {!!location && (
            <Text style={styles.gridLocation} numberOfLines={1}>
              {location}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={mounts}
        keyExtractor={(item) => item.id}
        renderItem={renderMount}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PRIMARY}
          />
        }
        ListHeaderComponent={
          <>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.85}
            >
              <Ionicons name="chevron-back" size={18} color={TEXT} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                {profile?.avatar_url ? (
                  <Image
                    source={{ uri: getPublicImageUrl(profile.avatar_url) }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarInitial}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>

              <Text style={styles.profileName}>{displayName}</Text>

              {!!username && <Text style={styles.username}>{username}</Text>}

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{mounts.length}</Text>
                  <Text style={styles.statLabel}>Mounts</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{pbCount}</Text>
                  <Text style={styles.statLabel}>PBs</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>About the Angler</Text>

              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Location</Text>
                <Text style={styles.profileValue}>
                  {profile?.location || 'Not set'}
                </Text>
              </View>

              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Target Species</Text>
                <Text style={styles.profileValue}>
                  {profile?.species || 'Not set'}
                </Text>
              </View>

              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Favorite Technique</Text>
                <Text style={styles.profileValue}>
                  {profile?.favorite_technique || 'Not set'}
                </Text>
              </View>

              <View style={styles.profileRowNoBorder}>
                <Text style={styles.profileLabel}>Boat</Text>
                <Text style={styles.profileValue}>
                  {profile?.boat || 'Not set'}
                </Text>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Mounted Catches</Text>
              <Text style={styles.sectionSubtitle}>
                Public catches from this angler
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No public mounts yet</Text>
            <Text style={styles.emptyText}>
              This angler has not mounted any public catches.
            </Text>
          </View>
        }
      />

      <Modal visible={!!selectedMount} animationType="fade" transparent>
        <View style={styles.fullscreenWrap}>
          <TouchableOpacity
            style={styles.fullscreenClose}
            onPress={() => setSelectedMount(null)}
          >
            <Text style={styles.fullscreenCloseText}>Close</Text>
          </TouchableOpacity>

          {selectedMount && (
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
                source={{ uri: getPublicImageUrl(selectedMount.image_url) }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            </ScrollView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  content: {
    padding: 20,
    paddingBottom: 120,
  },

  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    gap: 4,
    marginBottom: 18,
  },

  backText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
  },

  profileHeader: {
    alignItems: 'center',
    marginBottom: 22,
  },

  avatar: {
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: CARD,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.35)',
  },

  avatarImage: {
    width: '100%',
    height: '100%',
  },

  avatarInitial: {
    color: PRIMARY,
    fontSize: 42,
    fontWeight: '900',
  },

  profileName: {
    color: TEXT,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },

  username: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 6,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },

  statBox: {
    width: 120,
    backgroundColor: CARD,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },

  statNumber: {
    color: PRIMARY,
    fontSize: 24,
    fontWeight: '900',
  },

  statLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  infoCard: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },

  infoTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
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
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    paddingRight: 12,
  },

  profileValue: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },

  sectionHeader: {
    marginBottom: 12,
  },

  sectionTitle: {
    color: TEXT,
    fontSize: 22,
    fontWeight: '900',
  },

  sectionSubtitle: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },

  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  gridItem: {
    width: '48.5%',
    height: 190,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: CARD,
  },

  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: CARD,
  },

  pbBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  pbText: {
    color: '#0A2540',
    fontSize: 10,
    fontWeight: '900',
  },

  gridOverlay: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
  },

  gridDate: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },

  gridLocation: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: '800',
  },

  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 22,
    padding: 24,
    marginTop: 6,
  },

  emptyTitle: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
  },

  emptyText: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 22,
  },

  fullscreenWrap: {
    flex: 1,
    backgroundColor: BG,
  },

  fullscreenZoomScroll: {
    flex: 1,
    backgroundColor: BG,
  },

  fullscreenZoomContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG,
  },

  fullscreenImage: {
    width: '100%',
    height: '100%',
  },

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

  fullscreenCloseText: {
    color: TEXT,
    fontWeight: '800',
  },
});