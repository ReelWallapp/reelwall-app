import { supabase } from './supabase';

export async function uploadVaultMetadata(recordId: string, metadata: object) {
  const json = JSON.stringify(metadata, null, 2);
  const filePath = `vault-metadata/${recordId}.json`;

  const { error } = await supabase.storage
    .from('vault-metadata')
    .upload(filePath, json, {
      contentType: 'application/json',
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from('vault-metadata')
    .getPublicUrl(filePath);

  return data.publicUrl;
}