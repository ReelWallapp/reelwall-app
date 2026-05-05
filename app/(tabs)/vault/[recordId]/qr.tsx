import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

const PRIMARY = '#F2C94C';
const BG = '#081E33';
const TEXT = '#F5F7FA';
const MUTED = '#A5B3C2';

export default function VaultQRScreen() {
  const { recordId } = useLocalSearchParams<{ recordId: string }>();

  // 🔗 IMPORTANT: this is your verification URL
  const verificationUrl = `http://localhost:8081/vault/${recordId}`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Verified Record</Text>

        <Text style={styles.subtitle}>
          Scan to verify this catch
        </Text>

        <View style={styles.qrWrap}>
          <QRCode
            value={verificationUrl}
            size={220}
            color="#000"
            backgroundColor="#fff"
          />
        </View>

        <Text style={styles.urlText}>
          reelwall.app/vault/{recordId}
        </Text>

        <Text style={styles.note}>
          This record can be verified by anyone who scans this code.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: TEXT,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
  },
  subtitle: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 28,
  },
  qrWrap: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 20,
    marginBottom: 22,
  },
  urlText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  note: {
    color: MUTED,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});