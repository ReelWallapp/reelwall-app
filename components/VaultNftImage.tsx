import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

type VaultRecord = {
  image_url?: string | null;
};

export default function VaultNftImage({ record }: { record: VaultRecord }) {
  const imageUrl = record.image_url || '';

  return (
    <View style={styles.container}>
      {!!imageUrl && (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="contain"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 1024,
    height: 1024,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },

  image: {
    width: '100%',
    height: '100%',
  },
});