import { supabase } from './supabase';

const CATCHES_BUCKET = 'catches';

function getStoragePathFromPublicUrl(url?: string | null) {
  if (!url) return null;

  try {
    const marker = `/storage/v1/object/public/${CATCHES_BUCKET}/`;
    const idx = url.indexOf(marker);

    if (idx === -1) return null;

    return decodeURIComponent(url.substring(idx + marker.length));
  } catch {
    return null;
  }
}

export async function deleteCatchEverywhere(catchId: string, imageUrl?: string | null) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('User not logged in');
  }

  const imagePath = getStoragePathFromPublicUrl(imageUrl);

  const { error: linkDeleteError } = await supabase
    .from('collection_catches')
    .delete()
    .eq('catch_id', catchId);

  if (linkDeleteError) {
    throw linkDeleteError;
  }

  const { error: catchDeleteError } = await supabase
    .from('catches')
    .delete()
    .eq('id', catchId)
    .eq('user_id', user.id);

  if (catchDeleteError) {
    throw catchDeleteError;
  }

  if (imagePath) {
    const { error: storageDeleteError } = await supabase.storage
      .from(CATCHES_BUCKET)
      .remove([imagePath]);

    if (storageDeleteError) {
      console.log('Storage delete warning:', storageDeleteError);
    }
  }
}

export async function removeCatchFromCollectionOnly(
  collectionId: string,
  catchId: string
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('User not logged in');
  }

  const { error } = await supabase
    .from('collection_catches')
    .delete()
    .eq('collection_id', collectionId)
    .eq('catch_id', catchId);

  if (error) {
    throw error;
  }
}
