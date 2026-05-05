import { createVaultMetadata } from './createVaultMetadata';
import { supabase } from './supabase';
import { uploadVaultMetadata } from './uploadVaultMetadata';

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

export async function prepareVaultMint(record: VaultRecord) {
  const imageUrl = record.original_image_url || record.image_url;

  if (!record.id) {
    throw new Error('Missing Vault record ID.');
  }

  if (!imageUrl) {
    throw new Error('No image found for this Vault record.');
  }

  // 1. Create the public proof metadata JSON
  const metadata = createVaultMetadata(record, imageUrl);

  // 2. Upload metadata JSON to Supabase Storage
  const metadataUrl = await uploadVaultMetadata(record.id, metadata);

  if (!metadataUrl) {
    throw new Error('Could not create Vault proof URL.');
  }

  // 3. Save proof URL back to vault_records
  const { error } = await supabase
    .from('vault_records')
    .update({
      metadata_url: metadataUrl,
      mint_status: 'pending',
    })
    .eq('id', record.id);

  if (error) {
    throw error;
  }

  // 4. Return proof URL to app
  return metadataUrl;
}