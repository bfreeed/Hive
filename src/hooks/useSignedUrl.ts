import { useState, useEffect } from 'react';
import { getSignedUrl } from '../lib/supabase';

/**
 * Resolves a Supabase Storage path or legacy public URL to a signed URL.
 * Returns the original URL immediately (so nothing breaks while loading),
 * then swaps to the signed URL once resolved.
 */
export function useSignedUrl(urlOrPath: string | undefined): string {
  const [signedUrl, setSignedUrl] = useState(urlOrPath ?? '');

  useEffect(() => {
    if (!urlOrPath) return;
    // External URLs or blob: URLs don't need signing
    if (!urlOrPath.includes('supabase.co') && !urlOrPath.startsWith('blob:') === false) {
      setSignedUrl(urlOrPath);
      return;
    }
    if (urlOrPath.startsWith('blob:')) {
      setSignedUrl(urlOrPath);
      return;
    }
    let cancelled = false;
    getSignedUrl(urlOrPath).then(url => {
      if (!cancelled) setSignedUrl(url);
    });
    return () => { cancelled = true; };
  }, [urlOrPath]);

  return signedUrl;
}
