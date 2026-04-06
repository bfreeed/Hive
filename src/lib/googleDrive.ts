// Google Drive API v3 helper
// Uses Google Identity Services (token model — no redirect needed)

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  iconLink: string;
  size?: string; // bytes as string (not present for Google Docs/Sheets/etc.)
  owners?: { displayName: string }[];
}

export interface DriveFolder {
  id: string;
  name: string;
}

// ── Token management ──────────────────────────────────────────────
let _token: string | null = null;
let _tokenExpiry = 0;
let _tokenClient: any = null;
let _refreshTimer: ReturnType<typeof setTimeout> | null = null;
let _clientId: string | null = null;

export function setDriveToken(token: string, expiresIn: number) {
  _token = token;
  _tokenExpiry = Date.now() + expiresIn * 1000 - 60_000; // 1 min buffer
  // Schedule silent refresh at 55 min
  if (_refreshTimer) clearTimeout(_refreshTimer);
  const refreshIn = Math.max(0, expiresIn * 1000 - 5 * 60_000);
  _refreshTimer = setTimeout(() => {
    if (_clientId) silentRefresh(_clientId);
  }, refreshIn);
}

export function getDriveToken() {
  return _token && Date.now() < _tokenExpiry ? _token : null;
}

export function clearDriveToken() {
  _token = null;
  _tokenExpiry = 0;
  _tokenClient = null;
  _clientId = null;
  if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
}

function silentRefresh(clientId: string) {
  if (!_tokenClient) return;
  try {
    _tokenClient.requestAccessToken({ prompt: '' });
  } catch {
    // Silent refresh failed — token will be requested on next use
  }
}

// ── OAuth ─────────────────────────────────────────────────────────
function loadGsi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
}

export async function requestDriveToken(clientId: string, silent = false): Promise<string> {
  await loadGsi();
  _clientId = clientId;
  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (response: any) => {
        if (response.error) { reject(new Error(response.error)); return; }
        setDriveToken(response.access_token, response.expires_in);
        resolve(response.access_token);
      },
      error_callback: (err: any) => {
        // Fires for init errors — e.g. origin not in authorized list, invalid client ID
        reject(new Error(err?.message ?? err?.type ?? 'Google auth initialization failed. Check that your domain is in Authorized JavaScript origins in Google Cloud Console.'));
      },
    });
    _tokenClient = client;
    client.requestAccessToken({ prompt: silent ? '' : 'consent' });
  });
}

// Ensure we have a valid token, requesting one if needed
export async function ensureDriveToken(clientId: string): Promise<string> {
  const existing = getDriveToken();
  if (existing) return existing;
  return requestDriveToken(clientId);
}

// ── Drive API calls ───────────────────────────────────────────────
async function driveGet(path: string, token: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 401) { clearDriveToken(); }
    throw new Error(`Drive API error: ${res.status}`);
  }
  return res.json();
}

// List files in a folder
export async function listFolderFiles(folderId: string, token: string): Promise<DriveFile[]> {
  const fields = 'files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size,owners)';
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const data = await driveGet(
    `files?q=${q}&fields=${encodeURIComponent(fields)}&orderBy=name&pageSize=100`,
    token,
  );
  return data.files ?? [];
}

// Get folder metadata (name) from ID
export async function getFolderMeta(folderId: string, token: string): Promise<DriveFolder> {
  const data = await driveGet(`files/${folderId}?fields=id,name`, token);
  return { id: data.id, name: data.name };
}

// Extract folder ID from a Google Drive URL
// Handles: /drive/folders/{id}, /drive/u/0/folders/{id}, /open?id={id}
export function extractFolderIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    // /drive/folders/{id} or /drive/u/N/folders/{id}
    const folderMatch = u.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) return folderMatch[1];
    // /open?id={id}
    const idParam = u.searchParams.get('id');
    if (idParam) return idParam;
    // Maybe it's just the raw ID
    if (/^[a-zA-Z0-9_-]{25,}$/.test(url.trim())) return url.trim();
  } catch {
    // Not a URL — maybe raw ID
    if (/^[a-zA-Z0-9_-]{25,}$/.test(url.trim())) return url.trim();
  }
  return null;
}

// ── MIME type helpers ─────────────────────────────────────────────
const MIME_LABELS: Record<string, string> = {
  'application/vnd.google-apps.document':     'Doc',
  'application/vnd.google-apps.spreadsheet':  'Sheet',
  'application/vnd.google-apps.presentation': 'Slides',
  'application/vnd.google-apps.form':         'Form',
  'application/vnd.google-apps.folder':       'Folder',
  'application/pdf':                          'PDF',
  'image/png':                                'Image',
  'image/jpeg':                               'Image',
  'text/plain':                               'Text',
};

export function mimeLabel(mimeType: string): string {
  return MIME_LABELS[mimeType] ?? 'File';
}

export function isFolder(mimeType: string): boolean {
  return mimeType === 'application/vnd.google-apps.folder';
}

export function formatBytes(bytes: string | undefined): string {
  if (!bytes) return '';
  const n = parseInt(bytes, 10);
  if (isNaN(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
