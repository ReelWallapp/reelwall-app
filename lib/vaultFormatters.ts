// lib/vaultFormatters.ts

export const getPublicImageUrl = (value?: string | null) => {
  if (!value) return '';

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  const cleanPath = value.replace(/^\/+/, '').replace(/^catches\//, '');

  return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catches/${cleanPath}`;
};

export const formatDate = (value?: string | null, style: 'short' | 'long' = 'short') => {
  if (!value) return '';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString(undefined, {
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const getLocation = (item: {
  place_name?: string | null;
  region_name?: string | null;
}) => {
  return item.place_name || item.region_name || 'Location private';
};