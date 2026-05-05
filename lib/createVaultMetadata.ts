type VaultRecord = {
  id: string;
  image_url?: string | null;
  original_image_url?: string | null;
  story?: string | null;
  catch_date?: string | null;
  created_at?: string | null;
  place_name?: string | null;
  region_name?: string | null;
  is_personal_best?: boolean | null;
};

const APP_URL = 'https://www.reelwall.app';

export function createVaultMetadata(record: VaultRecord, imageUrl: string) {
  const shortId = record.id.slice(0, 8).toUpperCase();

  return {
    name: `LiveWell Vault Record #${shortId}`,
    description: record.story?.trim() || 'A preserved catch from ReelWall.',
    image: imageUrl,
    external_url: APP_URL,
    attributes: [
      {
        trait_type: 'Record ID',
        value: `LWV-${shortId}`,
      },
      {
        trait_type: 'Catch Date',
        value: record.catch_date || record.created_at || 'Unknown',
      },
      {
        trait_type: 'Location',
        value: record.place_name || record.region_name || 'Location private',
      },
      {
        trait_type: 'Personal Best',
        value: record.is_personal_best ? 'Yes' : 'No',
      },
      {
        trait_type: 'Source',
        value: 'ReelWall',
      },
    ],
  };
}