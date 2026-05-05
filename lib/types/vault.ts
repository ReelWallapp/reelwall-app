export type VaultStatus = 'preserved' | 'securing' | 'secured' | 'failed';

export type NftStatus = 'none' | 'eligible' | 'minting' | 'minted' | 'failed';

export type CatchItem = {
  id: string;
  image_url?: string | null;
  note?: string | null;
  place_name?: string | null;
  region_name?: string | null;
  created_at?: string | null;
  mounted_at?: string | null;
  catch_date?: string | null;
  is_public?: boolean | null;
  is_vaulted?: boolean | null;
  is_personal_best?: boolean | null;
  user_id?: string | null;
};

export type VaultRecord = {
  id: string;
  catch_id?: string | null;
  user_id?: string | null;

  image_url?: string | null;
  story?: string | null;
  catch_date?: string | null;
  place_name?: string | null;
  region_name?: string | null;
  created_at?: string | null;

  metadata_url?: string | null;
  arweave_image_url?: string | null;
  arweave_metadata_url?: string | null;

  vault_status?: VaultStatus | null;
  secured_at?: string | null;

  // Old field kept temporarily so your current database does not break.
  mint_status?: string | null;

  // Future NFT fields. We are not using these yet.
  nft_status?: NftStatus | null;
  mint_address?: string | null;
  transaction_signature?: string | null;
  minted_at?: string | null;

  is_personal_best?: boolean | null;
};