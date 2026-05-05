import { supabase } from '@/lib/supabase';
import { VaultRecord } from '@/lib/types/vault';
import { formatDate, getLocation, getPublicImageUrl } from '@/lib/vaultFormatters';
import { MaterialIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const PRIMARY = '#F2C94C';
const BG = '#081E33';
const CARD = '#102C47';
const TEXT = '#F5F7FA';
const MUTED = '#A5B3C2';

export default function PublicVaultVerificationScreen() {
  const router = useRouter();
  const { recordId } = useLocalSearchParams<{ recordId: string }>();

  const [record, setRecord] = useState<VaultRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRecord = async () => {
    if (!recordId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('vault_records')
        .select('*')
        .eq('id', recordId)
        .single();

      if (error) throw error;

      setRecord(data as VaultRecord);
    } catch (error) {
      console.log('Public verification load error:', error);
      setRecord(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecord();
  }, [recordId]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.centerWrap}>
            <ActivityIndicator color={PRIMARY} />
            <Text style={styles.loadingText}>Verifying record...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (!record) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.centerWrap}>
            <Text style={styles.errorTitle}>Record not found</Text>
            <Text style={styles.errorText}>This Vault record could not be verified.</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const imageUrl = getPublicImageUrl(record.image_url);
  const location = getLocation(record);

  const catchDate = record.catch_date
    ? formatDate(record.catch_date, 'long')
    : 'Catch date not provided';

  const preservedDate = record.created_at
    ? formatDate(record.created_at, 'long')
    : 'Date preserved';

  const story = record.story?.trim() || 'A catch worth preserving.';

  const isSecured =
    record.vault_status === 'secured' ||
    record.mint_status === 'minted';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.topGlow} />
          <View style={styles.goldGlow} />

          <View style={styles.heroHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.brandPill}>
              <MaterialIcons name="verified" size={15} color={PRIMARY} />
              <Text style={styles.brandPillText}>LIVEWELL VAULT</Text>
            </View>

            <Text style={styles.title}>Verified Record</Text>
            <Text style={styles.subtitle}>
              A permanent catch record secured through LiveWell Vault.
            </Text>

            <View style={[styles.statusPill, isSecured && styles.statusPillVerified]}>
              <Text style={styles.statusText}>
                {isSecured ? '✓ Verified Record' : 'Securing Record'}
              </Text>
            </View>
          </View>

          <View style={styles.outerGoldFrame}>
            <View style={styles.card}>
              <View style={styles.certTopRow}>
                <Text style={styles.certEyebrow}>Certificate of Record</Text>
                <Text style={styles.certSeal}>VAULT</Text>
              </View>

              <View style={styles.imageFrame}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
                ) : (
                  <MaterialIcons name="emoji-events" size={72} color={PRIMARY} />
                )}
              </View>

              <Text style={styles.recordTitle}>Preserved Catch</Text>
              <Text style={styles.recordDate}>Preserved: {preservedDate}</Text>

              <View style={styles.divider} />

              <View style={styles.storyBox}>
                <Text style={styles.label}>The Story</Text>
                <Text style={styles.story}>{story}</Text>
              </View>

              <View style={styles.detailGrid}>
                <View style={styles.detailBoxHalf}>
                  <Text style={styles.label}>Catch Date</Text>
                  <Text style={styles.value}>{catchDate}</Text>
                </View>

                <View style={styles.detailBoxHalf}>
                  <Text style={styles.label}>Location</Text>
                  <Text style={styles.value}>{location}</Text>
                </View>
              </View>

              <View style={styles.detailBox}>
                <Text style={styles.label}>Record ID</Text>
                <Text style={styles.valueSmall}>{record.id}</Text>
              </View>

              <View style={styles.permanentBox}>
                <Text style={styles.permanentTitle}>Permanent • Verified</Text>
                <Text style={styles.permanentText}>
                  This record represents the catch as it was preserved in LiveWell Vault.
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.footer}>Verified by LiveWell Vault</Text>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 52,
  },
  topGlow: {
    position: 'absolute',
    top: -80,
    left: -90,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: 'rgba(28, 70, 108, 0.35)',
  },
  goldGlow: {
    position: 'absolute',
    top: 220,
    right: -100,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(242, 201, 76, 0.13)',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: MUTED,
    marginTop: 12,
    fontWeight: '700',
  },
  errorTitle: {
    color: TEXT,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  errorText: {
    color: MUTED,
    fontSize: 14,
    textAlign: 'center',
  },
  heroHeader: {
    paddingTop: 20,
    paddingBottom: 22,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(8,30,51,0.85)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.35)',
    marginBottom: 16,
  },
  backButtonText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '900',
  },
  brandPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242,201,76,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.28)',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
    marginBottom: 14,
  },
  brandPillText: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginLeft: 7,
  },
  title: {
    color: TEXT,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  subtitle: {
    color: MUTED,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    maxWidth: 340,
    marginBottom: 16,
  },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(242,201,76,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.35)',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  statusPillVerified: {
    backgroundColor: 'rgba(242,201,76,0.16)',
    borderColor: PRIMARY,
  },
  statusText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  outerGoldFrame: {
    borderRadius: 30,
    padding: 4,
    backgroundColor: 'rgba(242,201,76,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.45)',
    shadowColor: PRIMARY,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.28)',
  },
  certTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  certEyebrow: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  certSeal: {
    color: BG,
    backgroundColor: PRIMARY,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 9,
    overflow: 'hidden',
  },
  imageFrame: {
    height: 320,
    backgroundColor: BG,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 18,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  recordTitle: {
    color: TEXT,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 5,
  },
  recordDate: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: '800',
  },
  divider: {
    width: 52,
    height: 3,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    marginTop: 16,
    marginBottom: 16,
  },
  storyBox: {
    backgroundColor: 'rgba(242,201,76,0.08)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.14)',
    marginBottom: 12,
  },
  detailGrid: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  detailBoxHalf: {
    flex: 1,
    backgroundColor: BG,
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginRight: 10,
  },
  detailBox: {
    backgroundColor: BG,
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 10,
  },
  label: {
    color: PRIMARY,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  story: {
    color: TEXT,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  value: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  valueSmall: {
    color: TEXT,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  permanentBox: {
    backgroundColor: 'rgba(242,201,76,0.1)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.18)',
    marginTop: 4,
  },
  permanentTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 5,
  },
  permanentText: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  footer: {
    color: MUTED,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 18,
  },
});