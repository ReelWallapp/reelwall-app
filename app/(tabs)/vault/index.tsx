import { supabase } from '@/lib/supabase';
import { CatchItem, VaultRecord } from '@/lib/types/vault';
import { formatDate, getLocation, getPublicImageUrl } from '@/lib/vaultFormatters';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

const VAULT_LIMIT = 3;

export default function VaultScreen() {
  const router = useRouter();

  const [mountedCatches, setMountedCatches] = useState<CatchItem[]>([]);
  const [vaultRecords, setVaultRecords] = useState<VaultRecord[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preservingId, setPreservingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const hasRecords = vaultRecords.length > 0;
  const vaultsRemaining = Math.max(VAULT_LIMIT - vaultRecords.length, 0);

  const getCurrentUserId = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) throw new Error('User not logged in');

    return user.id;
  };

  const getVaultStatusLabel = (item: VaultRecord) => {
    if (item.vault_status === 'secured') return 'Secured';
    if (item.mint_status === 'minted') return 'Secured';

    return 'Securing';
  };

  const loadVaultData = async () => {
    try {
      setLoading(true);

      const userId = await getCurrentUserId();

      const { data: catchesData, error: catchesError } = await supabase
        .from('catches')
        .select('*')
        .eq('user_id', userId)
        .eq('is_public', true)
        .order('mounted_at', { ascending: false, nullsFirst: false });

      if (catchesError) throw catchesError;

      const { data: vaultData, error: vaultError } = await supabase
        .from('vault_records')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (vaultError) throw vaultError;

      setMountedCatches((catchesData || []) as CatchItem[]);
      setVaultRecords((vaultData || []) as VaultRecord[]);
    } catch (error: any) {
      console.log('Vault load error:', error);
      Alert.alert('Could not load Vault', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadVaultData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVaultData();
    setRefreshing(false);
  };

  const openPicker = () => {
    if (vaultRecords.length >= VAULT_LIMIT) {
      Alert.alert(
        'Vault limit reached',
        'You have used your 3 free Vault records. Vault is for the catches that matter most.'
      );
      return;
    }

    if (mountedCatches.length === 0) {
      Alert.alert(
        'No mounted catches yet',
        'Mount a catch to ReelWall first, then come back to preserve it in LiveWell Vault.'
      );
      return;
    }

    setPickerOpen(true);
  };

  const openVaultOrPreserve = async (item: CatchItem) => {
    if (item.is_vaulted) {
      const userId = await getCurrentUserId();

      const { data, error } = await supabase
        .from('vault_records')
        .select('id')
        .eq('user_id', userId)
        .eq('catch_id', item.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        Alert.alert('Could not open certificate', error.message);
        return;
      }

      if (data?.id) {
        setPickerOpen(false);
        router.push(`/vault/${data.id}` as any);
        return;
      }
    }

    Alert.alert(
      'Preserve this record?',
      'Vault creates a preserved snapshot of this moment — including the image, story, date, and details as they are right now.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Preserve',
          style: 'default',
          onPress: () => preserveCatch(item),
        },
      ]
    );
  };

  const preserveCatch = async (item: CatchItem) => {
    try {
      setPreservingId(item.id);

      const userId = await getCurrentUserId();

      const { data: existingRecord, error: existingError } = await supabase
        .from('vault_records')
        .select('id')
        .eq('user_id', userId)
        .eq('catch_id', item.id)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingRecord?.id) {
        setPickerOpen(false);
        router.push(`/vault/${existingRecord.id}` as any);
        return;
      }

      const { data: vaultRecord, error: vaultError } = await supabase
        .from('vault_records')
        .insert({
          catch_id: item.id,
          user_id: userId,
          image_url: item.image_url,
          story: item.note,
          catch_date: item.catch_date,
          place_name: item.place_name,
          region_name: item.region_name,
          mint_status: 'pending',
        })
        .select('*')
        .single();

      if (vaultError) throw vaultError;

      const { error: catchUpdateError } = await supabase
        .from('catches')
        .update({ is_vaulted: true })
        .eq('id', item.id)
        .eq('user_id', userId);

      if (catchUpdateError) throw catchUpdateError;

      setMountedCatches((prev) =>
        prev.map((catchItem) =>
          catchItem.id === item.id ? { ...catchItem, is_vaulted: true } : catchItem
        )
      );

      setVaultRecords((prev) => [vaultRecord as VaultRecord, ...prev]);

      setPickerOpen(false);

      router.push(`/vault/${vaultRecord.id}` as any);

      supabase.functions
        .invoke('secure-vault-record', {
          body: { recordId: vaultRecord.id },
        })
        .then(({ error }) => {
          if (error) {
            console.log('Auto-secure Vault error:', error);
          }
        });
    } catch (error: any) {
      console.log('Preserve error:', error);
      Alert.alert('Error', error?.message || 'Could not preserve');
    } finally {
      setPreservingId(null);
    }
  };

  const renderMountedCatch = ({ item }: { item: CatchItem }) => {
    const imageUrl = getPublicImageUrl(item.image_url);
    const date = item.catch_date || formatDate(item.mounted_at || item.created_at);
    const location = getLocation(item);

    return (
      <TouchableOpacity
        style={[styles.pickCard, item.is_vaulted && styles.pickCardVaulted]}
        activeOpacity={0.86}
        onPress={() => openVaultOrPreserve(item)}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.pickImage} resizeMode="contain" />
        ) : (
          <View style={styles.pickImageFallback}>
            <Text style={styles.pickImageFallbackText}>No Image</Text>
          </View>
        )}

        <View style={styles.pickBody}>
          <View style={styles.pickTopRow}>
            <Text style={styles.pickTitle} numberOfLines={1}>
              {location}
            </Text>

            {item.is_vaulted && (
              <View style={styles.pickVaultedBadge}>
                <Text style={styles.pickVaultedBadgeText}>VAULTED</Text>
              </View>
            )}
          </View>

          {!!date && <Text style={styles.pickDate}>{date}</Text>}

          {!!item.note && (
            <Text style={styles.pickNote} numberOfLines={2}>
              {item.note}
            </Text>
          )}

          <View style={styles.pickAction}>
            {preservingId === item.id ? (
              <ActivityIndicator color="#081E33" />
            ) : (
              <Text style={styles.pickActionText}>
                {item.is_vaulted ? 'View Certificate' : 'Preserve This Record'}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderVaultRecord = (item: VaultRecord) => {
    const imageUrl = getPublicImageUrl(item.image_url);
    const location = getLocation(item);
    const date = item.catch_date || formatDate(item.created_at);

    return (
      <View key={item.id} style={styles.recordCard}>
        <View style={styles.recordTopRow}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.recordThumb} resizeMode="contain" />
          ) : null}

          <View style={styles.recordCopy}>
            <Text style={styles.recordTitle} numberOfLines={1}>
              {location}
            </Text>

            <Text style={styles.recordSubtitle} numberOfLines={1}>
              {date || 'Preserved from ReelWall'}
            </Text>
          </View>

          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedBadgeText}>{getVaultStatusLabel(item)}</Text>
          </View>
        </View>

        <View style={styles.recordActions}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push(`/vault/${item.id}` as any)}
          >
            <Text style={styles.secondaryButtonText}>View Certificate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push(`/vault/${item.id}/qr` as any)}
          >
            <Text style={styles.secondaryButtonText}>QR</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#F2C94C" />
          <Text style={styles.loadingText}>Opening LiveWell Vault...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F2C94C" />
        }
      >
        <View style={styles.content}>
          <Text style={styles.eyebrow}>LIVEWELL VAULT</Text>

          <View style={styles.logoWrap}>
            <Image
              source={require('../../../assets/reelwall-vault-hook-lock.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>Your Best Moments, Preserved.</Text>

          <Text style={styles.subtitle}>
            LiveWell Vault adds an extra preservation layer for the fishing memories you never want
            buried, changed, or forgotten.
          </Text>

          <View style={styles.taglineWrap}>
            <Text style={styles.taglinePrimary}>You earned the moment</Text>
            <Text style={styles.taglineSecondary}>Now preserve it</Text>
          </View>

          <View style={styles.statusCard}>
            <View style={styles.statusCopy}>
              <Text style={styles.statusLabel}>MY LIVEWELL VAULT</Text>

              <Text style={styles.statusTitle}>
                {hasRecords ? 'Vaulted Records' : 'Vault Ready'}
              </Text>

              <Text style={styles.statusText}>
                {hasRecords
                  ? 'Your most meaningful moments are preserved and ready to view or share.'
                  : 'Choose from your mounted ReelWall memories and preserve the ones that matter most.'}
              </Text>
            </View>

            <View style={styles.recordCountWrap}>
              <Text style={styles.recordCount}>{vaultRecords.length}</Text>
              <Text style={styles.recordCountLabel}>of {VAULT_LIMIT}</Text>
            </View>
          </View>

          <View style={styles.freeRecordsCard}>
            <Text style={styles.freeRecordsBadge}>EARLY ACCESS</Text>
            <Text style={styles.freeRecordsTitle}>3 Vault Records</Text>
            <Text style={styles.freeRecordsText}>
              Included for early anglers. Use them on the moments that truly matter.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              vaultRecords.length >= VAULT_LIMIT && styles.primaryButtonDisabled,
            ]}
            activeOpacity={0.86}
            onPress={openPicker}
            disabled={vaultRecords.length >= VAULT_LIMIT}
          >
            <Text style={styles.primaryButtonText}>
              {vaultRecords.length >= VAULT_LIMIT
                ? 'Vault Limit Reached'
                : 'Select from ReelWall'}
            </Text>

            <Text style={styles.primaryButtonSubtext}>
              {vaultRecords.length >= VAULT_LIMIT
                ? '3 records preserved'
                : `${vaultsRemaining} ${vaultsRemaining === 1 ? 'record' : 'records'} remaining`}
            </Text>
          </TouchableOpacity>

          <View style={styles.visualExplainerCard}>
            <Text style={styles.infoBadge}>WHAT LIVEWELL VAULT ADDS</Text>
            <Text style={styles.infoTitle}>Stored is safe. Preserved is intentional.</Text>

            <View style={styles.compareGrid}>
              <View style={styles.compareBox}>
                <Text style={styles.compareIcon}>📁</Text>
                <Text style={styles.compareTitle}>Stored</Text>
                <Text style={styles.compareText}>
                  Your regular ReelWall memories stay safe in the app, where you can edit,
                  organize, mount, and update them.
                </Text>
              </View>

              <View style={styles.compareArrowWrap}>
                <Text style={styles.compareArrow}>→</Text>
              </View>

              <View style={[styles.compareBox, styles.compareBoxGold]}>
                <Text style={styles.compareIcon}>🔒</Text>
                <Text style={styles.compareTitleGold}>LiveWell Vaulted</Text>
                <Text style={styles.compareText}>
                  Vault creates a protected snapshot of the image, story, date, and details
                  exactly as they existed when secured.
                </Text>
              </View>
            </View>

            <View style={styles.layerList}>
              <View style={styles.layerItem}>
                <View style={styles.layerIconWrap}>
  <Text style={styles.layerIcon}>1</Text>
</View>
                <View style={styles.layerCopy}>
                  <Text style={styles.layerTitle}>Snapshot created</Text>
                  <Text style={styles.layerText}>
                    The image, story, catch date, and location details are copied into a
                    dedicated Vault record.
                  </Text>
                </View>
              </View>

              <View style={styles.layerItem}>
                <View style={styles.layerIconWrap}>
  <Text style={styles.layerIcon}>2</Text>
</View>
                <View style={styles.layerCopy}>
                  <Text style={styles.layerTitle}>Certificate generated</Text>
                  <Text style={styles.layerText}>
                    Each vaulted memory gets its own certificate-style record and unique
                    record ID.
                  </Text>
                </View>
              </View>

              <View style={styles.layerItem}>
                <View style={styles.layerIconWrap}>
  <Text style={styles.layerIcon}>3</Text>
</View>
                <View style={styles.layerCopy}>
                  <Text style={styles.layerTitle}>Ready to verify and share</Text>
                  <Text style={styles.layerText}>
                    Vault records can be opened, shared, and verified through a dedicated
                    record page and QR code.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.vaultSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Vault Records</Text>
              <Text style={styles.sectionMeta}>Private by default</Text>
            </View>

            {!hasRecords ? (
              <View style={styles.emptyCard}>
                <View style={styles.vaultLogoWrap}>
                  <Image
                    source={require('../../../assets/reelwall-vault-hook-lock.png')}
                    style={styles.vaultLogo}
                    resizeMode="contain"
                  />
                </View>

                <Text style={styles.emptyTitle}>Nothing vaulted yet</Text>

                <Text style={styles.emptyText}>
                  Your ReelWall holds the moments you chose to mount. Vault is where the
                  ones that matter most become preserved records.
                </Text>

                <View style={styles.trustPill}>
                  <Text style={styles.trustPillText}>🔒 Secure. Private. Built to last.</Text>
                </View>
              </View>
            ) : (
              <View style={styles.recordsList}>{vaultRecords.map(renderVaultRecord)}</View>
            )}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoBadge}>WHY IT MATTERS</Text>
            <Text style={styles.infoTitle}>Some moments deserve more than a post.</Text>

            <Text style={styles.infoText}>
              All ReelWall angling memories are securely stored within the app.
            </Text>

            <Text style={styles.infoText}>
              LiveWell Vault goes a step further by creating a preserved record of the
              moments that matter most.
            </Text>

            <Text style={styles.infoText}>
              Unlike ordinary storage or social posts that can become buried, altered,
              compressed, or lost over time, vaulted records are built around permanence,
              verification, and long-term memory keeping.
            </Text>
          </View>

          <View style={styles.proofCard}>
            <Text style={styles.proofTitle}>Built on your ReelWall</Text>
            <Text style={styles.proofText}>
              Nothing changes about your ReelWall. Your photos, stories, and mounted
              moments stay exactly where they are. Vault is an added layer for the moments
              you want to protect, preserve, and carry forward.
            </Text>
          </View>

          <View style={styles.footerNote}>
            <Text style={styles.footerNoteText}>
              Choose carefully. Your first 3 Vault records should be the catches that
              truly matter.
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={pickerOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalEyebrow}>SELECT FROM REELWALL</Text>
              <Text style={styles.modalTitle}>Choose a mounted catch</Text>
              <Text style={styles.modalSubtitle}>
                {vaultsRemaining} {vaultsRemaining === 1 ? 'record' : 'records'} remaining
              </Text>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={() => setPickerOpen(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={mountedCatches}
            keyExtractor={(item) => item.id}
            renderItem={renderMountedCatch}
            contentContainerStyle={styles.pickList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.modalEmptyCard}>
                <Text style={styles.emptyTitle}>No mounted catches yet</Text>
                <Text style={styles.emptyText}>
                  Mount a catch to ReelWall first, then return here to preserve it.
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#081E33',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#A5B3C2',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 42,
  },
  eyebrow: {
    color: '#F2C94C',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
    textAlign: 'center',
    marginBottom: 14,
  },
  logoWrap: {
    width: 108,
    height: 108,
    alignSelf: 'center',
    borderRadius: 28,
    backgroundColor: '#102C47',
    borderWidth: 1,
    borderColor: 'rgba(242, 201, 76, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  logo: {
    width: 70,
    height: 70,
  },
  title: {
    color: '#F5F7FA',
    fontSize: 31,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.45,
  },
  subtitle: {
    color: '#A5B3C2',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  taglineWrap: {
    alignItems: 'center',
    marginBottom: 22,
  },
  taglinePrimary: {
    color: '#A5B3C2',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  taglineSecondary: {
    color: '#F2C94C',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  statusCard: {
    backgroundColor: '#102C47',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(242, 201, 76, 0.25)',
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  statusCopy: {
    flex: 1,
  },
  statusLabel: {
    color: '#F2C94C',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  statusTitle: {
    color: '#F5F7FA',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  statusText: {
    color: '#A5B3C2',
    fontSize: 14,
    lineHeight: 21,
  },
  recordCountWrap: {
    width: 74,
    height: 74,
    borderRadius: 22,
    backgroundColor: '#081E33',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordCount: {
    color: '#F5F7FA',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },
  recordCountLabel: {
    color: '#8FA3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  freeRecordsCard: {
    backgroundColor: '#0B253D',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(242, 201, 76, 0.45)',
    marginBottom: 14,
    shadowColor: '#F2C94C',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  freeRecordsBadge: {
    alignSelf: 'flex-start',
    color: '#081E33',
    backgroundColor: '#F2C94C',
    fontSize: 10,
    fontWeight: '900',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 999,
    marginBottom: 10,
    overflow: 'hidden',
  },
  freeRecordsTitle: {
    color: '#F5F7FA',
    fontSize: 21,
    fontWeight: '900',
    marginBottom: 5,
  },
  freeRecordsText: {
    color: '#A5B3C2',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#F2C94C',
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 22,
    borderWidth: 1,
    borderColor: 'rgba(242, 201, 76, 0.18)',
  },
  primaryButtonDisabled: {
    backgroundColor: 'rgba(90,107,125,0.75)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  primaryButtonText: {
    color: '#0A2540',
    fontSize: 15,
    fontWeight: '900',
  },
  primaryButtonSubtext: {
    color: 'rgba(10, 37, 64, 0.72)',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  visualExplainerCard: {
    backgroundColor: 'rgba(16, 44, 71, 0.9)',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(242, 201, 76, 0.18)',
    marginBottom: 18,
  },
  compareGrid: {
    marginTop: 12,
    marginBottom: 18,
  },
  compareBox: {
    backgroundColor: '#081E33',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  compareBoxGold: {
    borderColor: 'rgba(242, 201, 76, 0.42)',
    backgroundColor: '#0B253D',
  },
  compareArrowWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  compareArrow: {
    color: '#F2C94C',
    fontSize: 26,
    fontWeight: '900',
  },
  compareIcon: {
    fontSize: 26,
    marginBottom: 8,
  },
  compareTitle: {
    color: '#F5F7FA',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  compareTitleGold: {
    color: '#F2C94C',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  compareText: {
    color: '#A5B3C2',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  layerList: {
    gap: 12,
  },
  layerItem: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#0B253D',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  layerIconWrap: {
  width: 30,
  height: 30,
  borderRadius: 999,
  backgroundColor: '#F2C94C',
  justifyContent: 'center',
  alignItems: 'center',
  flexShrink: 0,
},
layerIcon: {
  color: '#081E33',
  fontSize: 13,
  fontWeight: '900',
  textAlign: 'center',
},
  layerCopy: {
    flex: 1,
  },
  layerTitle: {
    color: '#F5F7FA',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  layerText: {
    color: '#A5B3C2',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  vaultSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#F5F7FA',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionMeta: {
    color: '#8FA3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: 'rgba(16, 44, 71, 0.82)',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  vaultLogoWrap: {
    width: 86,
    height: 86,
    borderRadius: 26,
    backgroundColor: '#081E33',
    borderWidth: 1,
    borderColor: 'rgba(242, 201, 76, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  vaultLogo: {
    width: 76,
    height: 76,
  },
  emptyTitle: {
    color: '#F5F7FA',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyText: {
    color: '#A5B3C2',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  trustPill: {
    backgroundColor: '#163554',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  trustPillText: {
    color: '#E6EDF3',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  recordsList: {
    gap: 12,
  },
  recordCard: {
    backgroundColor: '#102C47',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(242, 201, 76, 0.24)',
  },
  recordTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  recordThumb: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#081E33',
  },
  recordCopy: {
    flex: 1,
  },
  recordTitle: {
    color: '#F5F7FA',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  recordSubtitle: {
    color: '#A5B3C2',
    fontSize: 12,
    fontWeight: '700',
  },
  verifiedBadge: {
    backgroundColor: '#081E33',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#F2C94C',
  },
  verifiedBadgeText: {
    color: '#F2C94C',
    fontSize: 10,
    fontWeight: '900',
  },
  recordActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#0B253D',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  secondaryButtonText: {
    color: '#F5F7FA',
    fontSize: 13,
    fontWeight: '800',
  },
  infoCard: {
    backgroundColor: 'rgba(16, 44, 71, 0.82)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
  },
  infoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#163554',
    color: '#F2C94C',
    fontSize: 11,
    fontWeight: '800',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginBottom: 12,
    overflow: 'hidden',
  },
  infoTitle: {
    color: '#F5F7FA',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  infoText: {
    color: '#A5B3C2',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  proofCard: {
    backgroundColor: '#0B253D',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(242, 201, 76, 0.12)',
    marginBottom: 16,
  },
  proofTitle: {
    color: '#F5F7FA',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  proofText: {
    color: '#A5B3C2',
    fontSize: 14,
    lineHeight: 22,
  },
  footerNote: {
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  footerNoteText: {
    color: '#8FA3B8',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#081E33',
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalEyebrow: {
    color: '#F2C94C',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  modalTitle: {
    color: '#F5F7FA',
    fontSize: 22,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: '#A5B3C2',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  closeButton: {
    backgroundColor: '#102C47',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.28)',
  },
  closeButtonText: {
    color: '#F5F7FA',
    fontWeight: '800',
    fontSize: 13,
  },
  pickList: {
    padding: 20,
    paddingBottom: 40,
  },
  pickCard: {
    backgroundColor: '#102C47',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  pickCardVaulted: {
    borderColor: '#F2C94C',
  },
  pickImage: {
    width: '100%',
    height: 210,
    backgroundColor: '#081E33',
  },
  pickImageFallback: {
    width: '100%',
    height: 210,
    backgroundColor: '#081E33',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickImageFallbackText: {
    color: '#A5B3C2',
    fontWeight: '700',
  },
  pickBody: {
    padding: 15,
  },
  pickTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  pickTitle: {
    flex: 1,
    color: '#F5F7FA',
    fontSize: 17,
    fontWeight: '900',
  },
  pickDate: {
    color: '#F2C94C',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  pickNote: {
    color: '#A5B3C2',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  pickVaultedBadge: {
    backgroundColor: '#081E33',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#F2C94C',
  },
  pickVaultedBadgeText: {
    color: '#F2C94C',
    fontSize: 9,
    fontWeight: '900',
  },
  pickAction: {
    backgroundColor: '#F2C94C',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pickActionText: {
    color: '#081E33',
    fontSize: 13,
    fontWeight: '900',
  },
  modalEmptyCard: {
    backgroundColor: '#102C47',
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
  },
});