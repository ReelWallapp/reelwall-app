import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

type VaultRecord = {
  id: string;
  image_url?: string | null;
  story?: string | null;
  place_name?: string | null;
  region_name?: string | null;
  catch_date?: string | null;
  created_at?: string | null;
  is_personal_best?: boolean | null;
};

export default function VaultCertificateImage({ record }: { record: VaultRecord }) {
  const imageUrl = record.image_url || '';
  const location = record.place_name || record.region_name || 'Location private';
  const date = formatDate(record.catch_date || record.created_at);
  const story = record.story?.trim() || 'A catch worth preserving.';
  const shortRecordId = record.id.slice(0, 8).toUpperCase();

  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        {!!imageUrl && (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.date}>{date}</Text>

          {record.is_personal_best && (
            <View style={styles.pbBadge}>
              <Text style={styles.pbText}>PERSONAL BEST</Text>
            </View>
          )}
        </View>

        <Text numberOfLines={1} style={styles.location}>
          {location}
        </Text>

        <Text numberOfLines={3} style={styles.story}>
          {story}
        </Text>

        <View style={styles.footer}>
          <Text style={styles.recordId}>LWV-{shortRecordId}</Text>
          <Text style={styles.verified}>Vault Record</Text>
        </View>
      </View>
    </View>
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'Date preserved';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  card: {
    width: 390,
    height: 488,
    backgroundColor: '#081E33',
    overflow: 'hidden',
  },

  imageWrap: {
  width: '100%',
  height: 330,
  backgroundColor: '#000', // 👈 makes contain look clean
  justifyContent: 'center',
  alignItems: 'center',
  },

  image: {
    width: '100%',
    height: '100%',
  },

  info: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: '#081E33',
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },

  date: {
    color: '#F5F7FA',
    fontSize: 15,
    fontWeight: '900',
  },

  location: {
    color: '#F2C94C',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },

  story: {
    color: '#DCE6F0',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },

  pbBadge: {
    backgroundColor: '#F2C94C',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },

  pbText: {
    color: '#081E33',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  recordId: {
    color: '#8FA3B8',
    fontSize: 9,
    fontWeight: '800',
  },

  verified: {
    color: '#8FA3B8',
    fontSize: 9,
    fontWeight: '800',
  },
});