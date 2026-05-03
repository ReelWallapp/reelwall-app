import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import ViewShot from 'react-native-view-shot';
import { supabase } from '../../lib/supabase';

type MountItem = {
  id: string;
  image_url?: string | null;
  note?: string | null;
  place_name?: string | null;
  region_name?: string | null;
  created_at?: string | null;
  mounted_at?: string | null;
  catch_date?: string | null;
  is_personal_best?: boolean | null;
  user_id?: string | null;
};

type ProfileItem = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

type ProfileMap = Record<string, ProfileItem>;
type KeeperCountsMap = Record<string, number>;
type KeptByMeMap = Record<string, boolean>;

type KeeperButtonProps = {
  isKept: boolean;
  onPress: () => void;
};

const PRIMARY = '#F2C94C';
const BG = '#081E33';
const CARD = '#102C47';
const TEXT = '#F5F7FA';
const MUTED = '#A5B3C2';

const PAGE_SIZE = 20;

function KeeperButton({ isKept, onPress }: KeeperButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = async () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.93,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 3,
        tension: 130,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      await Haptics.impactAsync(
        isKept
          ? Haptics.ImpactFeedbackStyle.Light
          : Haptics.ImpactFeedbackStyle.Medium
      );
    } catch (error) {
      console.log('Haptics error:', error);
    }

    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.keeperButton, isKept && styles.keeperButtonActive]}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <Text
          style={[
            styles.keeperButtonText,
            isKept && styles.keeperButtonTextActive,
          ]}
        >
          🎣 {isKept ? 'Keeper' : 'Mark Keeper'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MountsHomeScreen() {
  const router = useRouter();

  const listRef = useRef<FlatList<MountItem> | null>(null);
  const backToTopOpacity = useRef(new Animated.Value(0)).current;

  const [mounts, setMounts] = useState<MountItem[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [selectedMount, setSelectedMount] = useState<MountItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastMountedAt, setLastMountedAt] = useState<string | null>(null);

  const [keeperCounts, setKeeperCounts] = useState<KeeperCountsMap>({});
  const [keptByMe, setKeptByMe] = useState<KeptByMeMap>({});

  const [showBackToTop, setShowBackToTop] = useState(false);

  const [shareItem, setShareItem] = useState<MountItem | null>(null);
  const shareCardRef = useRef<ViewShot | null>(null);

  const getPublicImageUrl = (value?: string | null) => {
    if (!value) return '';

    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }

    const cleanPath = value.replace(/^\/+/, '').replace(/^catches\//, '');

    return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catches/${cleanPath}`;
  };

  const animateBackToTop = (visible: boolean) => {
    Animated.timing(backToTopOpacity, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const handleFeedScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const shouldShow = y > 3600;

    if (shouldShow !== showBackToTop) {
      setShowBackToTop(shouldShow);
      animateBackToTop(shouldShow);
    }
  };

  const scrollToTop = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.log('Haptics error:', error);
    }

    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const loadProfilesForMounts = async (mountedCatches: MountItem[]) => {
    const userIds = [
      ...new Set(
        mountedCatches
          .map((item) => item.user_id)
          .filter((id): id is string => !!id)
      ),
    ];

    const missingUserIds = userIds.filter((id) => !profiles[id]);

    if (missingUserIds.length === 0) {
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', missingUserIds);

    if (profilesError) {
      console.log('Profiles load error:', profilesError);
      return;
    }

    const profileMap: ProfileMap = {};

    ((profilesData || []) as ProfileItem[]).forEach((profile) => {
      profileMap[profile.id] = profile;
    });

    setProfiles((prev) => ({
      ...prev,
      ...profileMap,
    }));
  };

  const loadKeeperDataForMounts = async (mountedCatches: MountItem[]) => {
    const catchIds = mountedCatches.map((item) => item.id);

    if (catchIds.length === 0) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: reactionsData, error: reactionsError } = await supabase
      .from('catch_reactions')
      .select('catch_id, user_id')
      .eq('reaction_type', 'keeper')
      .in('catch_id', catchIds);

    if (reactionsError) {
      console.log('Keeper reactions load error:', reactionsError);
      return;
    }

    const nextCounts: KeeperCountsMap = {};
    const nextKeptByMe: KeptByMeMap = {};

    catchIds.forEach((catchId) => {
      nextCounts[catchId] = 0;
      nextKeptByMe[catchId] = false;
    });

    (reactionsData || []).forEach((reaction: any) => {
      const catchId = reaction.catch_id;

      nextCounts[catchId] = (nextCounts[catchId] || 0) + 1;

      if (user?.id && reaction.user_id === user.id) {
        nextKeptByMe[catchId] = true;
      }
    });

    setKeeperCounts((prev) => ({
      ...prev,
      ...nextCounts,
    }));

    setKeptByMe((prev) => ({
      ...prev,
      ...nextKeptByMe,
    }));
  };

  const loadMounts = async (reset = true) => {
    if (loadingMore && !reset) return;
    if (!hasMore && !reset) return;

    try {
      if (reset) {
        setHasMore(true);
        setLastMountedAt(null);
      } else {
        setLoadingMore(true);
      }

      let query = supabase
        .from('catches')
        .select('*')
        .eq('is_public', true)
        .order('mounted_at', { ascending: false, nullsFirst: false })
        .limit(PAGE_SIZE);

      if (!reset && lastMountedAt) {
        query = query.lt('mounted_at', lastMountedAt);
      }

      const { data: mountsData, error: mountsError } = await query;

      if (mountsError) {
        console.log('Mounts load error:', mountsError);

        if (reset) {
          setMounts([]);
          setProfiles({});
          setKeeperCounts({});
          setKeptByMe({});
        }

        return;
      }

      const mountedCatches = (mountsData || []) as MountItem[];

      if (reset) {
        setMounts(mountedCatches);
        setProfiles({});
        setKeeperCounts({});
        setKeptByMe({});
      } else {
        setMounts((prev) => [...prev, ...mountedCatches]);
      }

      if (mountedCatches.length > 0) {
        setLastMountedAt(
          mountedCatches[mountedCatches.length - 1].mounted_at || null
        );
      }

      setHasMore(mountedCatches.length === PAGE_SIZE);

      await loadProfilesForMounts(mountedCatches);
      await loadKeeperDataForMounts(mountedCatches);
    } catch (error) {
      console.log('Load mounts error:', error);

      if (reset) {
        setMounts([]);
        setProfiles({});
        setKeeperCounts({});
        setKeptByMe({});
      }
    } finally {
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMounts(true);
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMounts(true);
    setRefreshing(false);
  };

  const loadMoreMounts = () => {
    if (!loadingMore && hasMore && mounts.length > 0) {
      loadMounts(false);
    }
  };

  const toggleKeeper = async (item: MountItem) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to mark a catch as a Keeper.');
      return;
    }

    const catchId = item.id;
    const alreadyKept = !!keptByMe[catchId];

    setKeptByMe((prev) => ({
      ...prev,
      [catchId]: !alreadyKept,
    }));

    setKeeperCounts((prev) => ({
      ...prev,
      [catchId]: Math.max(0, (prev[catchId] || 0) + (alreadyKept ? -1 : 1)),
    }));

    try {
      if (alreadyKept) {
        const { error } = await supabase
          .from('catch_reactions')
          .delete()
          .eq('catch_id', catchId)
          .eq('user_id', user.id)
          .eq('reaction_type', 'keeper');

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('catch_reactions')
          .upsert(
            {
              catch_id: catchId,
              user_id: user.id,
              reaction_type: 'keeper',
            },
            {
              onConflict: 'catch_id,user_id,reaction_type',
            }
          );

        if (error) throw error;
      }
    } catch (error) {
      console.log('Toggle keeper error:', error);

      setKeptByMe((prev) => ({
        ...prev,
        [catchId]: alreadyKept,
      }));

      setKeeperCounts((prev) => ({
        ...prev,
        [catchId]: Math.max(0, (prev[catchId] || 0) + (alreadyKept ? 1 : -1)),
      }));

      Alert.alert('Could not update Keeper', 'Please try again.');
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '';

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';

    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getInitial = (name?: string | null) => {
    return (name || 'A').charAt(0).toUpperCase();
  };

  const getNoteFontSize = (text?: string | null) => {
    if (!text) return 12;

    const length = text.length;

    if (length < 60) return 14;
    if (length < 120) return 12;
    if (length < 180) return 11;

    return 10;
  };

  const shareMount = async (item: MountItem) => {
    try {
      setShareItem(item);

      await new Promise((resolve) => setTimeout(resolve, 700));

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
        UTI: 'public.jpeg',
        dialogTitle: 'Share this ReelWall mount',
      });
    } catch (error: any) {
      console.log('Share mount error:', error);
      Alert.alert('Could not share this mount', error?.message || 'Try again');
    } finally {
      setShareItem(null);
    }
  };

  const renderMount = ({ item }: { item: MountItem }) => {
    const imageUrl = getPublicImageUrl(item.image_url);
    const location = item.place_name || item.region_name || '';
    const mountedDate = formatDate(item.mounted_at);
    const catchDate = item.catch_date || '';

    const profile = item.user_id ? profiles[item.user_id] : undefined;
    const profileName = profile?.display_name || profile?.username || 'Angler';
    const avatarUrl = profile?.avatar_url || '';

    const keeperCount = keeperCounts[item.id] || 0;
    const isKept = !!keptByMe[item.id];

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.userText}>Mounted</Text>

            {!!mountedDate && <Text style={styles.metaText}>{mountedDate}</Text>}
          </View>

          <TouchableOpacity
            onPress={() => {
              if (item.user_id) {
                router.push(`/profile/${item.user_id}`);
              }
            }}
            activeOpacity={0.8}
            style={styles.userBlock}
          >
            {avatarUrl ? (
              <Image
                source={{ uri: getPublicImageUrl(avatarUrl) }}
                style={styles.avatarSmall}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {getInitial(profileName)}
                </Text>
              </View>
            )}

            <Text style={styles.username} numberOfLines={1}>
              {profileName}
            </Text>
          </TouchableOpacity>
        </View>

        {!!imageUrl && (
          <View style={styles.imageWrap}>
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => setSelectedMount(item)}
            >
              <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                resizeMode="cover"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => shareMount(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.shareIcon}>↗</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.cardBody}>
          {item.is_personal_best && (
            <View style={styles.pbBadge}>
              <Text style={styles.pbText}>★ Personal Best</Text>
            </View>
          )}

          {!!catchDate && <Text style={styles.catchDate}>{catchDate}</Text>}

          {!!location && <Text style={styles.location}>{location}</Text>}

          {!!item.note && (
            <Text style={styles.note} numberOfLines={3}>
              {item.note}
            </Text>
          )}

          <View style={styles.actionRow}>
            <KeeperButton isKept={isKept} onPress={() => toggleKeeper(item)} />

            <Text style={styles.keeperCountText}>
              {keeperCount === 1 ? '1 keeper' : `${keeperCount} keepers`}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const shareLocation = shareItem?.place_name || shareItem?.region_name || '';

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={listRef}
        data={mounts}
        keyExtractor={(item) => item.id}
        renderItem={renderMount}
        contentContainerStyle={styles.content}
        onEndReached={loadMoreMounts}
        onEndReachedThreshold={0.5}
        onScroll={handleFeedScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PRIMARY}
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMoreWrap}>
              <ActivityIndicator color={PRIMARY} />
            </View>
          ) : null
        }
        ListHeaderComponent={
          <>
            <View style={styles.topHeader}>
              <View style={styles.profileRow}>
                <Ionicons
                  name="person-circle-outline"
                  size={28}
                  color={PRIMARY}
                  onPress={() => router.push('/profile')}
                />
              </View>

              <Text style={styles.eyebrow}>REELWALL</Text>

              <Image
                source={require('../../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />

              <Text style={styles.subtitle}>Every Fish Has a Story</Text>
            </View>

            <View style={styles.mountsHeader}>
              <View style={styles.mountsHeaderTop}>
                <View>
                  <Text style={styles.mountsEyebrow}>COMMUNITY</Text>
                  <Text style={styles.mountsTitle}>ReelWall Mounts</Text>
                </View>

                <View style={styles.livePill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.livePillText}>Live</Text>
                </View>
              </View>

              <Text style={styles.mountsSubtitle}>Shared by anglers</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No mounts yet</Text>
            <Text style={styles.emptyText}>
              Mount a catch from your Wall and it will show up here for others
              to see.
            </Text>
          </View>
        }
      />

      {showBackToTop && (
        <Animated.View
          style={[
            styles.backToTopWrap,
            {
              opacity: backToTopOpacity,
              transform: [
                {
                  translateY: backToTopOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.backToTopButton}
            onPress={scrollToTop}
            activeOpacity={0.85}
          >
            <Ionicons name="chevron-up" size={18} color="#0A2540" />
            <Text style={styles.backToTopText}>Top</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

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
                source={{
                  uri: getPublicImageUrl(selectedMount.image_url),
                }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            </ScrollView>
          )}
        </View>
      </Modal>

      <View style={styles.hiddenShareWrap} pointerEvents="none">
        {shareItem && (
          <ViewShot
            ref={shareCardRef}
            options={{
              format: 'jpg',
              quality: 0.95,
              fileName: `reelwall-share-${shareItem.id}`,
            }}
          >
            <View style={styles.shareCardPremium}>
              <Image
                source={{ uri: getPublicImageUrl(shareItem.image_url) }}
                style={styles.shareCardPremiumImage}
                resizeMode="cover"
              />

              <View style={styles.shareCardGradient} />

              {shareItem.is_personal_best && (
                <View style={styles.shareCardPbBadge}>
                  <Text style={styles.shareCardPbText}>★ PERSONAL BEST</Text>
                </View>
              )}

              <View style={styles.shareCardPremiumMeta}>
                {shareItem.catch_date ? (
                  <Text style={styles.shareCardPremiumDate}>
                    {shareItem.catch_date}
                  </Text>
                ) : null}

                {shareLocation ? (
                  <Text style={styles.shareCardPremiumLocation}>
                    {shareLocation}
                  </Text>
                ) : null}

                <View style={styles.shareCardDivider} />

                <Text
                  numberOfLines={5}
                  style={[
                    styles.shareCardPremiumNote,
                    { fontSize: getNoteFontSize(shareItem?.note) },
                  ]}
                >
                  {shareItem.note?.trim() || 'A catch worth sharing.'}
                </Text>
              </View>

              <View style={styles.shareCardBottomBrand}>
                <Text style={styles.shareCardBottomBrandText}>
                  Mounted on ReelWall
                </Text>
              </View>
            </View>
          </ViewShot>
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

  content: {
    paddingBottom: 120,
  },

  topHeader: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 20,
  },

  profileRow: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 6,
  },

  eyebrow: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
    opacity: 0.9,
  },

  logo: {
    width: 220,
    height: 220,
    alignSelf: 'center',
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 15,
    color: MUTED,
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
  },

  mountsHeader: {
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },

  mountsHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  mountsEyebrow: {
    color: PRIMARY,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 3,
    opacity: 0.85,
  },

  mountsTitle: {
    color: TEXT,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 0.2,
  },

  mountsSubtitle: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },

  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242,201,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.28)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY,
    marginRight: 6,
  },

  livePillText: {
    color: PRIMARY,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 24,
    overflow: 'hidden',
    marginHorizontal: 18,
    marginTop: 4,
    marginBottom: 18,
  },

  cardHeader: {
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  userText: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '900',
  },

  metaText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },

  userBlock: {
    alignItems: 'center',
    maxWidth: 86,
  },

  avatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginBottom: 4,
    backgroundColor: BG,
    borderWidth: 1.5,
    borderColor: 'rgba(242,201,76,0.7)',
    shadowColor: PRIMARY,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },

  avatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginBottom: 4,
    backgroundColor: 'rgba(242,201,76,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarInitial: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '900',
  },

  username: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },

  imageWrap: {
    position: 'relative',
    backgroundColor: BG,
  },

  image: {
    width: '100%',
    height: 320,
    backgroundColor: BG,
  },

  shareButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
    zIndex: 5,
  },

  shareIcon: {
    color: PRIMARY,
    fontSize: 15,
    fontWeight: '900',
  },

  cardBody: {
    padding: 14,
  },

  catchDate: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 3,
  },

  location: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },

  note: {
    color: TEXT,
    fontSize: 14,
    lineHeight: 20,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 10,
  },

  keeperButton: {
    backgroundColor: 'rgba(242,201,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.35)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },

  keeperButtonActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  keeperButtonText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '900',
  },

  keeperButtonTextActive: {
    color: '#0A2540',
  },

  keeperCountText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'right',
  },

  pbBadge: {
    alignSelf: 'flex-start',
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },

  pbText: {
    color: '#0A2540',
    fontSize: 11,
    fontWeight: '900',
  },

  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 22,
    padding: 24,
    marginHorizontal: 20,
    marginTop: 20,
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

  loadingMoreWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backToTopWrap: {
    position: 'absolute',
    right: 18,
    bottom: 110,
    zIndex: 50,
  },

  backToTopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 13,
    shadowColor: PRIMARY,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  backToTopText: {
    color: '#0A2540',
    fontSize: 12,
    fontWeight: '900',
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

  hiddenShareWrap: {
    position: 'absolute',
    left: -10000,
    top: 0,
    width: 390,
  },

  shareCardPremium: {
    width: '100%',
    aspectRatio: 4 / 5,
    overflow: 'hidden',
    backgroundColor: BG,
    position: 'relative',
  },

  shareCardPremiumImage: {
    width: '100%',
    height: '100%',
    backgroundColor: BG,
  },

  shareCardGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.34)',
  },

  shareCardPremiumMeta: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 50,
  },

  shareCardBottomBrand: {
    position: 'absolute',
    right: 14,
    bottom: 12,
    backgroundColor: 'rgba(8,30,51,0.75)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },

  shareCardBottomBrandText: {
    color: PRIMARY,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  shareCardPbBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },

  shareCardPbText: {
    color: '#0A2540',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  shareCardPremiumDate: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  shareCardPremiumLocation: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  shareCardDivider: {
    width: 30,
    height: 2,
    borderRadius: 99,
    backgroundColor: PRIMARY,
    marginBottom: 10,
  },

  shareCardPremiumNote: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});