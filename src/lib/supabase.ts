import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

/**
 * Upload a file or blob to Supabase Storage and return the public URL.
 * Requires a public bucket named `bucketName` in your Supabase project.
 * Setup: Supabase dashboard → Storage → New bucket → "hive-attachments" → Public
 */
export async function uploadToStorage(
  bucketName: string,
  path: string,
  file: Blob | File,
): Promise<string> {
  const contentType = file instanceof File ? file.type : 'application/octet-stream';
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(path, file, { contentType, upsert: false });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(data.path);
  return publicUrl;
}
