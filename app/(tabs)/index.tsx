import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
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
  is_vaulted?: boolean | null;
  user_id?: string | null;
};

type ProfileItem = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

type ProfileMap = Record<string, ProfileItem>;

const PRIMARY = '#F2C94C';
const BG = '#081E33';
const CARD = '#102C47';
const TEXT = '#F5F7FA';
const MUTED = '#A5B3C2';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const PAGE_SIZE = 20;

export default function MountsHomeScreen() {
  const router = useRouter();

  const listRef = useRef<FlatList<MountItem> | null>(null);
  const backToTopOpacity = useRef(new Animated.Value(0)).current;
  const highFiveScale = useRef(new Animated.Value(1)).current;
  const shareCardRef = useRef<ViewShot | null>(null);

  const [mounts, setMounts] = useState<MountItem[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [selectedMount, setSelectedMount] = useState<MountItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastMountedAt, setLastMountedAt] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [reactedCatchIds, setReactedCatchIds] = useState<Record<string, boolean>>({});
  const [shareItem, setShareItem] = useState<MountItem | null>(null);

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

  const getCurrentUserId = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) throw new Error('User not logged in');

    return user.id;
  };

  const fetchProfilesForMounts = async (mountedCatches: MountItem[]) => {
    const userIds = [
      ...new Set(
        mountedCatches
          .map((item) => item.user_id)
          .filter((id): id is string => !!id)
      ),
    ];

    if (userIds.length === 0) return {};

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', userIds);

    if (error) {
      console.log('Profiles load error:', error);
      return {};
    }

    const profileMap: ProfileMap = {};

    ((data || []) as ProfileItem[]).forEach((profile) => {
      profileMap[profile.id] = profile;
    });

    return profileMap;
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
        }

        return;
      }

      const mountedCatches = (mountsData || []) as MountItem[];
      const profileMap = await fetchProfilesForMounts(mountedCatches);

      if (reset) {
        setMounts(mountedCatches);
        setProfiles(profileMap);
      } else {
        setMounts((prev) => [...prev, ...mountedCatches]);
        setProfiles((prev) => ({
          ...prev,
          ...profileMap,
        }));
      }

      if (mountedCatches.length > 0) {
        setLastMountedAt(
          mountedCatches[mountedCatches.length - 1].mounted_at || null
        );
      }

      setHasMore(mountedCatches.length === PAGE_SIZE);
    } catch (error) {
      console.log('Load mounts error:', error);

      if (reset) {
        setMounts([]);
        setProfiles({});
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

  const toggleReaction = async (catchId: string) => {
    try {
      const userId = await getCurrentUserId();
      const alreadyReacted = !!reactedCatchIds[catchId];

      setReactedCatchIds((prev) => ({
        ...prev,
        [catchId]: !alreadyReacted,
      }));

      if (alreadyReacted) {
        await supabase
          .from('catch_reactions')
          .delete()
          .eq('catch_id', catchId)
          .eq('user_id', userId);
      } else {
        await supabase.from('catch_reactions').upsert({
          catch_id: catchId,
          user_id: userId,
          reaction_type: 'nice',
        });
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error: any) {
      console.log('Reaction error:', error);
      Alert.alert('Could not react', error?.message || 'Please try again.');
    }
  };

  const handleHighFive = async (catchId: string) => {
    try {
      Animated.sequence([
        Animated.timing(highFiveScale, {
          toValue: 1.15,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.spring(highFiveScale, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
      ]).start();

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await toggleReaction(catchId);
    } catch (e) {
      console.log('High five error', e);
    }
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

    return (
      <LinearGradient
        colors={
          item.is_vaulted
            ? ['rgba(242,201,76,0.95)', 'rgba(201,164,58,0.45)', 'rgba(242,201,76,0.18)']
            : ['transparent', 'transparent']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.cardGradientWrap,
          item.is_vaulted && styles.vaultedCardGradientWrap,
        ]}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              {item.is_vaulted && (
                <View style={styles.headerVaultBadge}>
                  <Text style={styles.headerVaultText}>🔒 VAULTED</Text>
                </View>
              )}
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
                  resizeMode="contain"
                />
              </TouchableOpacity>

              {item.is_vaulted && (
                <LinearGradient
                  pointerEvents="none"
                  colors={['transparent', 'rgba(255,255,255,0.15)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              )}

              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => shareMount(item)}
                activeOpacity={0.85}
              >
                <Text style={styles.shareIcon}>↗</Text>
              </TouchableOpacity>
            </View>
          )}

          <View
            style={[
              styles.cardBody,
              item.is_vaulted && styles.vaultedCardBody,
            ]}
          >
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

            <View style={styles.cardFooterRow}>
              <View style={styles.footerLeft}>
                <View style={styles.mountedFooterRow}>
                  <MaterialIcons name="emoji-events" size={15} color={PRIMARY} />
                  <Text style={styles.mountedFooterText}>Mounted on ReelWall</Text>
                </View>

                {!!mountedDate && (
                  <Text style={styles.mountedFooterDate}>
                    {` ${mountedDate}`}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => handleHighFive(item.id)}
              >
                <Animated.View
                  style={[
                    styles.niceButton,
                    reactedCatchIds[item.id] && styles.niceButtonActive,
                    {
                      transform: [{ scale: highFiveScale }],
                    },
                  ]}
                >
                  <Text style={styles.niceButtonEmoji}>✋</Text>
                  <Text
                    style={[
                      styles.niceButtonText,
                      reactedCatchIds[item.id] && styles.niceButtonTextActive,
                    ]}
                  >
                    {reactedCatchIds[item.id] ? 'High Five ✓' : 'High Five'}
                  </Text>
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </LinearGradient>
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
            <LinearGradient
              colors={[BG, BG, BG]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.topHero}
            >
              

              <LinearGradient
                pointerEvents="none"
                colors={[
                  'rgba(8,30,51,0.96)',
                  'rgba(8,30,51,0.82)',
                  'rgba(8,30,51,0.00)',
                ]}
                locations={[0, 0.58, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.heroLogoShield}
              />

              <TouchableOpacity
                style={styles.profileTopButton}
                onPress={() => router.push('/profile')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="person-circle-outline"
                  size={25}
                  color={PRIMARY}
                />
                <Text style={styles.profileTopLabel}>Profile</Text>
              </TouchableOpacity>

              <View style={styles.heroLogoWrap}>
                <Image
                  source={require('../../assets/logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.subtitle}>
                Every Fish Has a <Text style={styles.subtitleHighlight}>Story</Text>
              </Text>

              <View style={styles.flowPill}>
                <View style={styles.flowStep}>
                  <Ionicons name="camera" size={13} color={MUTED} />
                  <Text style={styles.flowText}>Capture</Text>
                </View>

                <Text style={styles.flowArrow}>→</Text>

                <View style={styles.flowStep}>
                  <MaterialIcons name="emoji-events" size={14} color={PRIMARY} />
                  <Text style={styles.flowTextHighlight}>Mount</Text>
                </View>

                <Text style={styles.flowArrow}>→</Text>

                <View style={styles.flowStep}>
                  <Ionicons name="lock-closed" size={13} color={MUTED} />
                  <Text style={styles.flowText}>Vault</Text>
                </View>
              </View>
            </LinearGradient>

            <LinearGradient
              colors={[
                'rgba(8,30,51,0.00)',
                'rgba(8,30,51,0.62)',
                'rgba(16,44,71,0.14)',
              ]}
              locations={[0, 0.42, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.mountsHeader}
            >
              <Text style={styles.mountsTitle}>REELWALL</Text>

              <Text style={styles.mountsSubtitle}>
                Mounted by the fishing community.
              </Text>
            </LinearGradient>

            <View style={styles.mountsBottomRow}>
              <Text style={styles.mountsBottomText}>Latest Mounts</Text>

              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.livePillText}>Live</Text>
              </View>
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

      <Modal visible={!!selectedMount} animationType="fade" transparent={false}>
        <SafeAreaView style={styles.fullscreenWrap}>
          <TouchableOpacity
            style={styles.fullscreenClose}
            onPress={() => setSelectedMount(null)}
          >
            <Text style={styles.fullscreenCloseText}>Close</Text>
          </TouchableOpacity>

          {selectedMount && (
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
                  source={{ uri: getPublicImageUrl(selectedMount.image_url) }}
                  style={styles.fullscreenImage}
                  resizeMode="contain"
                />
              </ScrollView>

              {(selectedMount.note ||
                selectedMount.catch_date ||
                selectedMount.place_name ||
                selectedMount.region_name) && (
                <View style={styles.fullscreenStoryPanel}>
                  {!!selectedMount.catch_date && (
                    <Text style={styles.fullscreenDate}>
                      {selectedMount.catch_date}
                    </Text>
                  )}

                  {!!(selectedMount.place_name || selectedMount.region_name) && (
                    <Text style={styles.fullscreenLocation}>
                      {selectedMount.place_name || selectedMount.region_name}
                    </Text>
                  )}

                  {!!selectedMount.note && (
                    <>
                      <Text style={styles.fullscreenStoryTitle}>Story</Text>

                      <ScrollView
                        style={styles.fullscreenStoryScroll}
                        showsVerticalScrollIndicator
                      >
                        <Text style={styles.fullscreenStory}>
                          {selectedMount.note}
                        </Text>
                      </ScrollView>
                    </>
                  )}
                </View>
              )}
            </>
          )}
        </SafeAreaView>
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
              <View style={styles.shareImageWrap}>
                <Image
                  source={{ uri: getPublicImageUrl(shareItem.image_url) }}
                  style={styles.shareCardPremiumImage}
                  resizeMode="contain"
                />
              </View>

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

  headerLeft: {
    flex: 1,
    justifyContent: 'center',
  },

  shareImageWrap: {
    width: '100%',
    height: '100%',
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
  },

  cardGradientWrap: {
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 18,
    borderRadius: 26,
    padding: 0,
  },

  vaultedCardGradientWrap: {
    padding: 2,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },

  headerVaultBadge: {
    alignSelf: 'flex-start',
    backgroundColor: BG,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },

  headerVaultText: {
    color: PRIMARY,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  vaultedCardBody: {
    backgroundColor: 'rgba(242,201,76,0.08)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(242,201,76,0.18)',
  },

  topHero: {
    backgroundColor: BG,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 14,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
  },

  

  heroLogoShield: {
    position: 'absolute',
    top: 0,
    left: 40,
    right: 40,
    height: 130,
    zIndex: 1,
  },

  profileTopButton: {
    position: 'absolute',
    top: 14,
    right: 18,
    zIndex: 6,
    alignItems: 'center',
    transform: [{ scale: 0.72 }],
  },

  profileTopLabel: {
    color: '#B8C4D1',
    fontSize: 13,
    fontWeight: '900',
    marginTop: -1,
  },

  heroLogoWrap: {
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: -8,
    paddingHorizontal: 18,
    paddingVertical: 2,
    backgroundColor: 'rgba(8,30,51,0.92)',
    borderRadius: 26,
  },

  logo: {
    width: 142,
    height: 104,
  },

  subtitle: {
    zIndex: 4,
    fontSize: 19,
    color: TEXT,
    fontWeight: '900',
    marginTop: 2,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.2,
  },

  subtitleHighlight: {
    color: PRIMARY,
  },

  mountsHeader: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },

  mountsTitle: {
    color: TEXT,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 5,
    textAlign: 'center',
  },

  mountsSubtitle: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    maxWidth: 350,
    textAlign: 'center',
  },

  mountsBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
    marginBottom: 6,
    paddingTop: 12,
    paddingBottom: 0,
    paddingHorizontal: 22,
  },

  mountsBottomText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242,201,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.28)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
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
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  flowPill: {
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(4,18,31,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 7,
  },

  flowStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },

  flowText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '900',
  },

  flowTextHighlight: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: '900',
  },

  flowArrow: {
    color: MUTED,
    fontSize: 11,
    marginHorizontal: 8,
    opacity: 0.58,
  },

  niceButtonActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  niceButtonTextActive: {
    color: '#0A2540',
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 24,
    overflow: 'hidden',
  },

  cardHeader: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: BG,
    padding: 10,
  },

  image: {
    width: '100%',
    height: 320,
    backgroundColor: BG,
    borderRadius: 14,
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

  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 14,
  },

  footerLeft: {
    flex: 1,
    paddingRight: 12,
  },

  mountedFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  mountedFooterText: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 5,
  },

  mountedFooterDate: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },

  niceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  niceButtonEmoji: {
    fontSize: 13,
    marginRight: 4,
  },

  niceButtonText: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: '900',
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

  fullscreenImage: {
    width: '100%',
    height: '100%',
  },

  fullscreenClose: {
    position: 'absolute',
    top: 54,
    right: 20,
    zIndex: 20,
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

  fullscreenZoomContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG,
    paddingBottom: 190,
  },

  fullscreenDate: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 4,
  },

  fullscreenLocation: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },

  fullscreenStory: {
    color: TEXT,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },

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
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
    textTransform: 'uppercase',
  },

  fullscreenStoryScroll: {
    marginTop: 2,
  },

  fullscreenImageContent: {
    minHeight: SCREEN_HEIGHT * 0.62,
    justifyContent: 'center',
    alignItems: 'center',
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