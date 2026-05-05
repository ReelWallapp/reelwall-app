import { supabase } from '@/lib/supabase';
import { VaultRecord } from '@/lib/types/vault';
import { formatDate, getLocation, getPublicImageUrl } from '@/lib/vaultFormatters';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ViewShot from 'react-native-view-shot';

const PRIMARY = '#F2C94C';
const BG = '#081E33';
const CARD = '#102C47';
const TEXT = '#F5F7FA';
const MUTED = '#A5B3C2';

export default function VaultDetailScreen() {
  const router = useRouter();
  const { recordId } = useLocalSearchParams<{ recordId: string }>();

  const certificateRef = useRef<ViewShot | null>(null);

  const [record, setRecord] = useState<VaultRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const verificationUrl = `https://reelwall.app/v/${recordId}`;

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
      console.log('Vault detail error:', error);
      Alert.alert('Could not load record', 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecord();
  }, [recordId]);

  useEffect(() => {
    if (!record) return;

    const isSecured =
      record.vault_status === 'secured' ||
      record.mint_status === 'minted';

    if (isSecured) return;

    const timer = setTimeout(() => {
      loadRecord();
    }, 4000);

    return () => clearTimeout(timer);
  }, [record]);

  const shareRecord = async () => {
    try {
      await Share.share({
        message: `View this verified LiveWell Vault record:\n${verificationUrl}`,
      });
    } catch (error) {
      console.log('Share record error:', error);
      Alert.alert('Could not share record');
    }
  };

  const shareCertificateImage = async () => {
    if (!record) return;

    try {
      setWorking(true);

      await new Promise((resolve) => setTimeout(resolve, 800));

      const imageUri = await (certificateRef.current as any)?.capture?.();

      if (!imageUri) {
        Alert.alert('Could not generate certificate image');
        return;
      }

      // iMessage usually behaves better with React Native's native Share sheet.
      if (Platform.OS === 'ios') {
        try {
          await Share.share({
            url: imageUri,
            message: `LiveWell Vault certificate\n${verificationUrl}`,
          });
          return;
        } catch (nativeShareError) {
          console.log('Native image share failed, trying Expo Sharing:', nativeShareError);
        }
      }

      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        Alert.alert('Sharing is not available on this device');
        return;
      }

      await Sharing.shareAsync(imageUri, {
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
        dialogTitle: 'Share LiveWell Vault certificate',
      });
    } catch (error: any) {
      console.log('Share certificate image error:', error);
      Alert.alert('Could not share certificate image', error?.message || 'Please try again.');
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={PRIMARY} />
          <Text style={styles.loadingText}>Opening Vault record...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!record) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <Text style={styles.emptyTitle}>Record not found</Text>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topGlow} />
        <View style={styles.goldGlow} />

        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.brandText}>LIVEWELL VAULT</Text>
          <Text style={styles.title}>Certificate of Record</Text>
          <Text style={styles.subtitle}>A preserved catch from ReelWall</Text>

          <View style={[styles.vaultStatusPill, isSecured && styles.vaultStatusPillSecured]}>
            {isSecured ? (
              <Text style={styles.vaultStatusPillText}>✓ Secured in Vault</Text>
            ) : (
              <View style={styles.vaultStatusLoadingRow}>
                <ActivityIndicator size="small" color={PRIMARY} />
                <Text style={[styles.vaultStatusPillText, { marginLeft: 8 }]}>
                  Securing record...
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.permanentLabel}>Permanent • Verified Record</Text>
        </View>

        <ViewShot
          ref={certificateRef}
          options={{
            format: 'jpg',
            quality: 1,
            fileName: `livewell-vault-${record.id}`,
          }}
        >
          <View style={styles.certificateCard}>
            <View style={styles.certificateBorder}>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>🔒 LIVEWELL VAULTED</Text>
              </View>

              <View style={styles.imageFrame}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.heroImage} resizeMode="contain" />
                ) : (
                  <View style={styles.heroFallback}>
                    <MaterialIcons name="emoji-events" size={72} color={PRIMARY} />
                  </View>
                )}
              </View>

              <Text style={styles.recordTitle}>Preserved Catch</Text>
              <Text style={styles.recordDate}>Preserved {preservedDate}</Text>

              <View style={styles.goldDivider} />

              <View style={styles.certStatement}>
                <Text style={styles.certStatementLabel}>The Story</Text>
                <Text style={styles.certStatementText}>{story}</Text>
              </View>

              <View style={styles.detailsGrid}>
                <View style={styles.detailBox}>
                  <Text style={styles.detailLabel}>Location</Text>
                  <Text style={styles.detailValue}>{location}</Text>
                </View>

                <View style={styles.detailBox}>
                  <Text style={styles.detailLabel}>Catch Date</Text>
                  <Text style={styles.detailValue}>{catchDate}</Text>
                </View>

                <View style={styles.detailBoxFull}>
                  <Text style={styles.detailLabel}>Source</Text>
                  <Text style={styles.detailValue}>Mounted on ReelWall</Text>
                </View>
              </View>

              {record.is_personal_best && (
                <View style={styles.pbBadge}>
                  <Text style={styles.pbText}>★ PERSONAL BEST</Text>
                </View>
              )}
            </View>
          </View>
        </ViewShot>

        <View style={styles.lockedCard}>
          <Text style={styles.lockedTitle}>Permanently Preserved</Text>
          <Text style={styles.lockedText}>
            This record is locked as part of LiveWell Vault and represents the catch as it was
            preserved.
          </Text>
        </View>

        <TouchableOpacity activeOpacity={0.86} style={styles.primaryButton} onPress={shareRecord}>
          <Text style={styles.primaryButtonText}>Share Record Link</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.86}
          style={styles.primaryButton}
          onPress={shareCertificateImage}
          disabled={working}
        >
          {working ? (
            <ActivityIndicator color={BG} />
          ) : (
            <Text style={styles.primaryButtonText}>Share Certificate Image</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.86}
          style={styles.secondaryButton}
          onPress={() => router.push(`/vault/${recordId}/qr` as any)}
        >
          <Text style={styles.secondaryButtonText}>View QR Code</Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>Verified by LiveWell Vault</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    paddingBottom: 44,
    paddingHorizontal: 20,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyTitle: {
    color: TEXT,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 16,
  },
  topGlow: {
    position: 'absolute',
    top: -70,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(28, 70, 108, 0.3)',
  },
  goldGlow: {
    position: 'absolute',
    top: 240,
    right: -90,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: 'rgba(242, 201, 76, 0.12)',
  },
  header: {
    paddingTop: 16,
    paddingBottom: 22,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(8,30,51,0.82)',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.35)',
    marginBottom: 22,
  },
  backButtonText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '900',
  },
  brandText: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  vaultStatusPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(242, 201, 76, 0.1)',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: 'rgba(242, 201, 76, 0.35)',
    marginTop: 12,
  },
  vaultStatusPillSecured: {
    backgroundColor: 'rgba(242, 201, 76, 0.16)',
    borderColor: PRIMARY,
  },
  vaultStatusPillText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  vaultStatusLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  permanentLabel: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 12,
    letterSpacing: 0.4,
  },
  title: {
    color: TEXT,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '700',
  },
  certificateCard: {
    backgroundColor: 'rgba(242,201,76,0.12)',
    borderRadius: 28,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.45)',
    shadowColor: PRIMARY,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
    marginBottom: 18,
  },
  certificateBorder: {
    backgroundColor: CARD,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.28)',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: BG,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: PRIMARY,
    marginBottom: 14,
  },
  statusBadgeText: {
    color: PRIMARY,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  imageFrame: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(242,201,76,0.55)',
    backgroundColor: BG,
    marginBottom: 18,
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroFallback: {
    width: '100%',
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG,
  },
  recordTitle: {
    color: TEXT,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 5,
  },
  recordDate: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: '800',
  },
  goldDivider: {
    width: 52,
    height: 3,
    borderRadius: 99,
    backgroundColor: PRIMARY,
    marginTop: 16,
    marginBottom: 16,
  },
  certStatement: {
    backgroundColor: 'rgba(242,201,76,0.08)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.14)',
  },
  certStatementLabel: {
    color: PRIMARY,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  certStatementText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailBox: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: BG,
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  detailBoxFull: {
    width: '100%',
    backgroundColor: BG,
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  detailLabel: {
    color: PRIMARY,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  detailValue: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  pbBadge: {
    alignSelf: 'flex-start',
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginTop: 14,
  },
  pbText: {
    color: BG,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  lockedCard: {
    backgroundColor: 'rgba(242, 201, 76, 0.1)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(242, 201, 76, 0.2)',
    marginBottom: 18,
  },
  lockedTitle: {
    color: TEXT,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 6,
  },
  lockedText: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
  },
  primaryButton: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: BG,
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    backgroundColor: CARD,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 18,
  },
  secondaryButtonText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '800',
  },
  footerNote: {
    color: '#8FA3B8',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
});