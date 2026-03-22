import { useState, useCallback, useRef } from 'react';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

// Cache token across hook instances for the session
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  url: string;
};

export function useGooglePicker(onPick: (file: DriveFile) => void) {
  const [loading, setLoading] = useState(false);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const open = useCallback(async () => {
    const clientId = localStorage.getItem('google_client_id')?.trim();
    const apiKey = localStorage.getItem('google_api_key')?.trim();

    if (!clientId || !apiKey) {
      alert('Add your Google Client ID and API Key in Settings first.');
      return;
    }

    setLoading(true);
    try {
      await loadScript('https://apis.google.com/js/api.js');
      await loadScript('https://accounts.google.com/gsi/client');
      await new Promise<void>((res) => window.gapi.load('picker', res));

      // Reuse cached token if still valid (tokens last 1 hour)
      const token = await (async () => {
        if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken;
        return new Promise<string>((res, rej) => {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/drive.readonly',
            callback: (r: any) => {
              if (r.error) { rej(r.error); return; }
              cachedToken = r.access_token;
              tokenExpiry = Date.now() + (r.expires_in || 3600) * 1000;
              res(r.access_token);
            },
            error_callback: (e: any) => rej(e),
            ux_mode: 'popup',
          });
          client.requestAccessToken({ prompt: 'consent' });
        });
      })();

      const docsView = new window.google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false)
        .setParent('root');

      new window.google.picker.PickerBuilder()
        .addView(docsView)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .setCallback((data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const d = data.docs[0];
            onPickRef.current({
              id: d.id,
              name: d.name,
              mimeType: d.mimeType,
              url: d.url,
            });
          }
        })
        .build()
        .setVisible(true);
    } catch (e) {
      console.error('Google Picker error:', e);
      alert('Could not open Google Drive. Check your credentials in Settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { open, loading };
}
