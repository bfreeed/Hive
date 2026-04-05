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
  // Blob.type is always populated (e.g. 'audio/webm;codecs=opus'); File extends Blob so this covers both
  const contentType = file.type || 'application/octet-stream';
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(path, file, { contentType, upsert: false });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(data.path);
  return publicUrl;
}

/**
 * Get a signed URL for a Supabase Storage file.
 * Accepts either a full public URL or a storage path.
 */
export async function getSignedUrl(urlOrPath: string): Promise<string> {
  // Extract bucket and path from a full Supabase URL
  const match = urlOrPath.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
  if (match) {
    const [, bucket, path] = match;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return urlOrPath;
    return data.signedUrl;
  }
  // If it's not a recognizable storage URL, return as-is
  return urlOrPath;
}
