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
    'Vault records are designed to be permanent. Once secured, this record may remain even if you delete your account.',
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
            <Text style={styles.secondaryButtonText}>View</Text>
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
        <View style={styles.topGlow} />
        <View style={styles.bottomGlow} />

        <View style={styles.content}>
          <Text style={styles.eyebrow}>LIVEWELL VAULT</Text>

          <View style={styles.logoWrap}>
            <Image
              source={require('../assets/LiveWell Vault logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>Your Best Moments, Preserved.</Text>

          <Text style={styles.subtitle}>
            The memories worth keeping live here — secured, protected, and ready
            when it matters.
          </Text>

          <View style={styles.taglineWrap}>
            <Text style={styles.taglinePrimary}>You earned the moment</Text>
            <Text style={styles.taglineSecondary}>Now preserve it</Text>
          </View>

          <View style={styles.statusCard}>
            <View style={styles.statusCopy}>
              <Text style={styles.statusLabel}>MY VAULT</Text>

              <Text style={styles.statusTitle}>
                {hasRecords ? 'Vaulted Records' : 'Vault Ready'}
              </Text>

              <Text style={styles.statusText}>
                {hasRecords
                  ? 'Your most meaningful moments are preserved and ready to view or share.'
                  : 'Choose from your mounted ReelWall catches and preserve the ones that matter most.'}
              </Text>
            </View>

            <View style={styles.recordCountWrap}>
              <Text style={styles.recordCount}>{vaultRecords.length}</Text>
              <Text style={styles.recordCountLabel}>of {VAULT_LIMIT}</Text>
            </View>
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

          <Text style={styles.promoText}>Early access: first 3 on us</Text>

          <View style={styles.vaultSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Vault Records</Text>
              <Text style={styles.sectionMeta}>Private by default</Text>
            </View>

            {!hasRecords ? (
              <View style={styles.emptyCard}>
                <View style={styles.vaultLogoWrap}>
                  <Image
                    source={require('../assets/LiveWell Vault logo.png')}
                    style={styles.vaultLogo}
                    resizeMode="contain"
                  />
                </View>

                <Text style={styles.emptyTitle}>Nothing vaulted yet</Text>

                <Text style={styles.emptyText}>
                  Your ReelWall holds the moments you chose to mount. Vault is
                  where the ones that matter most are preserved for good.
                </Text>

                <View style={styles.trustPill}>
                  <Text style={styles.trustPillText}>
                    🔒 Secure. Private. Built to last.
                  </Text>
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
              ReelWall is where your best moments become part of your story.
              Vault is where you preserve the ones you never want to lose.
            </Text>
          </View>

          <View style={styles.proofCard}>
            <Text style={styles.proofTitle}>Built on your ReelWall</Text>
            <Text style={styles.proofText}>
              Nothing changes about your ReelWall. Your photos, stories, and
              mounted moments stay exactly where they are. Vault is an added
              layer — for the moments you want to protect, preserve, and carry
              forward.
            </Text>
          </View>

          <View style={styles.footerNote}>
            <Text style={styles.footerNoteText}>
              Choose carefully. Your first 3 Vault records should be the catches
              that truly matter.
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
  topGlow: {
    position: 'absolute',
    top: -20,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(28, 70, 108, 0.22)',
  },
  bottomGlow: {
    position: 'absolute',
    top: 220,
    right: -40,
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: 'rgba(242, 201, 76, 0.08)',
  },
  promoText: {
    color: 'rgba(242, 201, 76, 0.7)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: -14,
    marginBottom: 22,
    letterSpacing: 0.5,
    textAlign: 'center',
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