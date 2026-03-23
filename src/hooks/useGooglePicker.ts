import { useState, useCallback, useEffect, useRef } from 'react';

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

let preloadPromise: Promise<void> | null = null;
function preloadGoogleScripts(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = loadScript('https://apis.google.com/js/api.js')
    .then(() => new Promise<void>((res) => window.gapi.load('picker', res)))
    .catch(() => { preloadPromise = null; });
  return preloadPromise!;
}

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
  const apiKeyRef = useRef('');

  useEffect(() => {
    preloadGoogleScripts().catch(() => {});
  }, []);

  const openPicker = useCallback((token: string) => {
    const apiKey = apiKeyRef.current;
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
          onPickRef.current({ id: d.id, name: d.name, mimeType: d.mimeType, url: d.url });
        }
        setLoading(false);
      })
      .build()
      .setVisible(true);
  }, []);

  const open = useCallback(() => {
    const clientId = localStorage.getItem('google_client_id')?.trim();
    const apiKey = localStorage.getItem('google_api_key')?.trim();
    if (!clientId || !apiKey) {
      alert('Add your Google Client ID and API Key in Settings first.');
      return;
    }
    apiKeyRef.current = apiKey;
    setLoading(true);

    if (cachedToken && Date.now() < tokenExpiry - 60000) {
      openPicker(cachedToken);
      return;
    }

    // Open OAuth popup directly — window.open() is synchronous from the click
    // handler, so the browser never blocks it. Bypasses GIS token client which
    // does async work internally before opening, losing the user gesture context.
    const redirectUri = `${window.location.origin}/oauth.html`;
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      prompt: 'select_account',
    });

    const popup = window.open(authUrl, 'google-oauth', 'width=500,height=600');
    if (!popup) {
      setLoading(false);
      alert('Popup was blocked — please allow popups for this site in browser settings.');
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'google-oauth-callback') return;
      window.removeEventListener('message', handleMessage);
      clearInterval(closedCheck);
      const params = new URLSearchParams((event.data.hash || '').substring(1));
      const token = params.get('access_token');
      if (token) {
        const expiresIn = parseInt(params.get('expires_in') || '3600');
        cachedToken = token;
        tokenExpiry = Date.now() + expiresIn * 1000;
        openPicker(token);
      } else {
        setLoading(false);
        alert('Google Drive: authorization failed or cancelled.');
      }
    };

    window.addEventListener('message', handleMessage);

    // If user closes the popup without completing auth, clean up
    const closedCheck = setInterval(() => {
      if (popup.closed) {
        clearInterval(closedCheck);
        window.removeEventListener('message', handleMessage);
        setLoading(false);
      }
    }, 500);
  }, [openPicker]);

  return { open, loading };
}
