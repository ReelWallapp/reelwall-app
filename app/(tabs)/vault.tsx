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
              source={require('../../assets/livewell-vault-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>Preserve What Matters Most.</Text>

          <Text style={styles.subtitle}>
            LiveWell Vault is where your most meaningful catches will live beyond
            the moment — protected, permanent, and part of your legacy.
          </Text>

          <View style={styles.heroCard}>
            <Text style={styles.heroBadge}>COMING SOON</Text>

            <Text style={styles.heroTitle}>Introducing LiveWell Vault</Text>

            <Text style={styles.heroText}>
              Select catches from your ReelWall will be elevated into a permanent
              record — preserved as a digital heirloom and showcased as part of
              your personal fishing legacy.
            </Text>

            <View style={styles.featureList}>
              <View style={styles.featureRow}>
                <Text style={styles.featureIcon}>🔒</Text>
                <Text style={styles.featureText}>
                  Preserve your most meaningful catches
                </Text>
              </View>

              <View style={styles.featureRow}>
                <Text style={styles.featureIcon}>🏆</Text>
                <Text style={styles.featureText}>
                  Highlight milestone and personal best moments
                </Text>
              </View>

              <View style={styles.featureRow}>
                <Text style={styles.featureIcon}>🌊</Text>
                <Text style={styles.featureText}>
                  Build a lasting digital legacy through ReelWall
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoBadge}>WHY IT MATTERS</Text>
            <Text style={styles.infoTitle}>More than a catch. A legacy.</Text>
            <Text style={styles.infoText}>
              ReelWall helps you save the catch and keep the story. LiveWell Vault
              will take that one step further by giving your most important moments
              a place that feels permanent, protected, and worth passing on.
            </Text>
          </View>

          <View style={styles.footerNote}>
            <Text style={styles.footerNoteText}>
              LiveWell Vault is being built carefully to feel simple, meaningful,
              and seamless inside ReelWall.
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
    paddingBottom: 36,
  },
  topGlow: {
    position: 'absolute',
    top: -20,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(28, 70, 108, 0.18)',
  },
  bottomGlow: {
    position: 'absolute',
    top: 180,
    right: -30,
    width: 140,
    height: 140,
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
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  logo: {
    width: 70,
    height: 70,
  },
  title: {
    color: '#F5F7FA',
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: '#A5B3C2',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  heroCard: {
    backgroundColor: '#102C47',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(242, 201, 76, 0.25)',
    marginBottom: 16,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2C94C',
    color: '#0A2540',
    fontSize: 11,
    fontWeight: '800',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginBottom: 14,
  },
  heroTitle: {
    color: '#F5F7FA',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  heroText: {
    color: '#A5B3C2',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  featureList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  featureIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  featureText: {
    flex: 1,
    color: '#E6EDF3',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
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