import React from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function VaultScreen() {
  const hasRecords = false;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topGlow} />
        <View style={styles.bottomGlow} />

        <View style={styles.content}>
          <Text style={styles.eyebrow}>LIVEWELL VAULT</Text>

          <View style={styles.logoWrap}>
            <Image
              source={require('./assets/LiveWell Vault logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>Your Fishing Legacy, Preserved.</Text>

          <Text style={styles.subtitle}>
            LiveWell Vault is where your most meaningful fishing experiences become lasting,
            verifiable records — protected by LiveWell and ready to share when
            it matters.
          </Text>

          <View style={styles.taglineWrap}>
            <Text style={styles.taglinePrimary}>
              You didn’t lose it during the fight
            </Text>
            <Text style={styles.taglineSecondary}>Don’t lose it now</Text>
          </View>

          <View style={styles.statusCard}>
            <View style={styles.statusCopy}>
              <Text style={styles.statusLabel}>MY LIVEWELL VAULT</Text>
              <Text style={styles.statusTitle}>
                {hasRecords ? 'Verified Records' : 'Vault Ready'}
              </Text>
              <Text style={styles.statusText}>
                {hasRecords
                  ? 'Your preserved catches are secured and ready to view or share.'
                  : 'Start by selecting a meaningful catch from your ReelWall once Vault access opens.'}
              </Text>
            </View>

            <View style={styles.recordCountWrap}>
              <Text style={styles.recordCount}>0</Text>
              <Text style={styles.recordCountLabel}>Records</Text>
            </View>
          </View>

          <View style={styles.disabledButton}>
            <Text style={styles.disabledButtonText}>Select from ReelWall</Text>
            <Text style={styles.disabledButtonSubtext}>Coming Soon</Text>
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
                    source={require('./assets/reelwall-vault-hook-lock.png')}
                    style={styles.vaultLogo}
                    resizeMode="contain"
                  />
                </View>

                <Text style={styles.emptyTitle}>No records yet</Text>

                <Text style={styles.emptyText}>
                  Your photos and catch details are already securely stored in
                  ReelWall. LiveWell Vault will add another layer of protection
                  for the moments you want to preserve as lasting records.
                </Text>

                <View style={styles.trustPill}>
                  <Text style={styles.trustPillText}>
                    🔒 Already secured. Vault protection coming soon.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.recordCard}>
                <View style={styles.recordTopRow}>
                  <View>
                    <Text style={styles.recordTitle}>Lake Trout — 32&quot;</Text>
                    <Text style={styles.recordSubtitle}>
                      Preserved from your ReelWall
                    </Text>
                  </View>

                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedBadgeText}>Verified</Text>
                  </View>
                </View>

                <View style={styles.recordActions}>
                  <View style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>View</Text>
                  </View>

                  <View style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Share QR</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoBadge}>WHY IT MATTERS</Text>
            <Text style={styles.infoTitle}>More than a catch. A legacy.</Text>
            <Text style={styles.infoText}>
              ReelWall helps you save the catch and keep the story. LiveWell
              Vault gives your most important moments a place that feels
              permanent, protected, and worth passing on.
            </Text>
          </View>

          <View style={styles.proofCard}>
            <Text style={styles.proofTitle}>An added layer of confidence</Text>
            <Text style={styles.proofText}>
              Nothing is moving away from your ReelWall. Your catches, photos,
              and stories remain safely stored. LiveWell Vault is being built as
              an additional layer for the catches you want to protect, verify,
              and share as part of your fishing legacy.
            </Text>
          </View>

          <View style={styles.footerNote}>
            <Text style={styles.footerNoteText}>
              Vault access is coming soon. Until then, keep building your
              ReelWall with the moments that matter most.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#081E33',
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
  disabledButton: {
    backgroundColor: 'rgba(242, 201, 76, 0.38)',
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 22,
    borderWidth: 1,
    borderColor: 'rgba(242, 201, 76, 0.18)',
  },
  disabledButtonText: {
    color: 'rgba(10, 37, 64, 0.72)',
    fontSize: 15,
    fontWeight: '900',
  },
  disabledButtonSubtext: {
    color: 'rgba(10, 37, 64, 0.62)',
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
  recordCard: {
    backgroundColor: '#102C47',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(242, 201, 76, 0.18)',
  },
  recordTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  recordTitle: {
    color: '#F5F7FA',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 5,
  },
  recordSubtitle: {
    color: '#A5B3C2',
    fontSize: 13,
    lineHeight: 19,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.14)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  verifiedBadgeText: {
    color: '#8BE28B',
    fontSize: 11,
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
});