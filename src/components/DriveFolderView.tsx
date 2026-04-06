import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen, ExternalLink, RefreshCw, Link2, X,
  FileText, AlertCircle, Loader2, ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { extractFolderIdFromUrl, mimeLabel, isFolder, formatBytes, type DriveFile } from '../lib/googleDrive';

// ── helpers ───────────────────────────────────────────────────────────────────

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function apiFetch<T>(path: string, body?: unknown): Promise<T> {
  const headers = await authHeader();
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

// ── File row ──────────────────────────────────────────────────────────────────

function FileRow({ file, onOpenFolder }: {
  file: DriveFile;
  onOpenFolder?: (id: string, name: string) => void;
}) {
  const folder = isFolder(file.mimeType);
  const label = mimeLabel(file.mimeType);
  const size = formatBytes(file.size);
  const modified = file.modifiedTime
    ? new Date(file.modifiedTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const badgeColor: Record<string, string> = {
    Doc: 'text-blue-400 bg-blue-500/10',
    Sheet: 'text-emerald-400 bg-emerald-500/10',
    Slides: 'text-amber-400 bg-amber-500/10',
    Form: 'text-purple-400 bg-purple-500/10',
    PDF: 'text-red-400 bg-red-500/10',
    Folder: 'text-white/40 bg-white/[0.06]',
  };

  return (
    <button
      type="button"
      onClick={() => folder && onOpenFolder ? onOpenFolder(file.id, file.name) : window.open(file.webViewLink, '_blank', 'noopener')}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors group text-left"
    >
      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
        {file.iconLink
          ? <img src={file.iconLink} className="w-5 h-5" alt="" />
          : <FileText size={18} className="text-white/30" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/80 group-hover:text-white truncate transition-colors">{file.name}</span>
          {folder && <ChevronRight size={12} className="text-white/30 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {size && <span className="text-[11px] text-white/30">{size}</span>}
          {modified && <span className="text-[11px] text-white/25">Modified {modified}</span>}
        </div>
      </div>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badgeColor[label] ?? 'text-white/30 bg-white/[0.04]'}`}>
        {label}
      </span>
      {!folder && (
        <a
          href={file.webViewLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/30 hover:text-white/70 transition-all flex-shrink-0"
        >
          <ExternalLink size={13} />
        </a>
      )}
    </button>
  );
}

// ── Link folder modal ─────────────────────────────────────────────────────────

function LinkFolderModal({ onLink, onClose }: { onLink: (url: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const invalid = url.length > 0 && !extractFolderIdFromUrl(url);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 w-[480px] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Link Google Drive folder</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06]"><X size={15} /></button>
        </div>
        <p className="text-sm text-white/40 mb-4">Paste the URL of a Google Drive folder.</p>
        <input
          autoFocus
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !invalid && url) onLink(url); }}
          placeholder="https://drive.google.com/drive/folders/…"
          className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-brand-500/50"
        />
        {invalid && <p className="text-xs text-red-400 mt-2">Couldn't find a folder ID in that URL.</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-white/40 hover:text-white/70 transition-colors">Cancel</button>
          <button
            type="button"
            onClick={() => { if (!invalid && url) onLink(url); }}
            disabled={!url || invalid}
            className="px-4 py-2 text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Link folder
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface DriveFolderViewProps {
  folderId: string | undefined;
  folderName: string | undefined;
  onLink: (folderId: string, folderName: string) => void;
  onUnlink: () => void;
  // clientId kept for API compatibility but no longer used client-side
  clientId?: string | undefined;
}

export default function DriveFolderView({ folderId, folderName, onLink, onUnlink }: DriveFolderViewProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);

  const currentFolder = folderStack.length > 0
    ? folderStack[folderStack.length - 1]
    : (folderId ? { id: folderId, name: folderName ?? 'Drive folder' } : null);

  // Check server-side token on mount / when folderId changes
  useEffect(() => {
    if (!folderId) return;
    checkAndLoad();
  }, [folderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect return from Google OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('drive_connected') === '1') {
      window.history.replaceState({}, '', window.location.pathname);
      if (folderId) checkAndLoad();
    }
    if (params.get('drive_error')) {
      const err = params.get('drive_error');
      setError(`Google Drive connection failed: ${err}. Try connecting again.`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkAndLoad = useCallback(async () => {
    if (!folderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ connected: boolean; token?: string }>('/api/google-drive-token');
      if (!res.connected) {
        setConnected(false);
        setLoading(false);
        return;
      }
      setConnected(true);
      await loadFiles({ id: folderId, name: folderName ?? 'Drive folder' });
    } catch {
      setError('Could not reach server. Try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [folderId, folderName]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFiles = useCallback(async (folder: { id: string; name: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ connected: boolean; files?: DriveFile[]; error?: string }>('/api/google-drive-files', { folderId: folder.id });
      if (!res.connected) { setConnected(false); return; }
      if (res.error) { setError(res.error); return; }
      setFiles(res.files ?? []);
    } catch {
      setError('Failed to load files.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConnect = async () => {
    setError(null);
    try {
      const res = await apiFetch<{ authUrl?: string; error?: string }>('/api/google-drive-initiate');
      if (res.authUrl) {
        window.location.href = res.authUrl;
      } else {
        setError(res.error ?? 'Could not start Google sign-in.');
      }
    } catch {
      setError('Could not reach server.');
    }
  };

  const handleLink = (url: string) => {
    const id = extractFolderIdFromUrl(url);
    if (!id) return;
    setShowLinkModal(false);
    onLink(id, 'Drive folder');
  };

  const openSubFolder = (id: string, name: string) => {
    const next = { id, name };
    setFolderStack(s => [...s, next]);
    loadFiles(next);
  };

  const navigateBack = (index: number) => {
    const target = index === -1 ? { id: folderId!, name: folderName! } : folderStack[index];
    setFolderStack(s => s.slice(0, index + 1));
    loadFiles(target);
  };

  // ── No folder linked ────────────────────────────────────────────────────────
  if (!folderId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 bg-white/[0.04] rounded-2xl flex items-center justify-center mb-4">
          <FolderOpen size={24} className="text-white/20" />
        </div>
        <h3 className="text-sm font-semibold text-white/50 mb-1">No Drive folder linked</h3>
        <p className="text-xs text-white/30 max-w-xs mb-5">Link a Google Drive folder and its files will appear here automatically.</p>
        <button
          type="button"
          onClick={() => setShowLinkModal(true)}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Link2 size={14} /> Link Drive folder
        </button>
        {showLinkModal && <LinkFolderModal onLink={handleLink} onClose={() => setShowLinkModal(false)} />}
      </div>
    );
  }

  // ── Folder linked ───────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-sm">
          <FolderOpen size={15} className="text-white/40 flex-shrink-0" />
          <button type="button" onClick={() => navigateBack(-1)} className={`font-medium transition-colors ${folderStack.length === 0 ? 'text-white/70' : 'text-white/40 hover:text-white/70'}`}>
            {folderName ?? 'Drive folder'}
          </button>
          {folderStack.map((f, i) => (
            <React.Fragment key={f.id}>
              <ChevronRight size={13} className="text-white/25" />
              <button type="button" onClick={() => navigateBack(i)} className={`font-medium transition-colors ${i === folderStack.length - 1 ? 'text-white/70' : 'text-white/40 hover:text-white/70'}`}>
                {f.name}
              </button>
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => currentFolder && loadFiles(currentFolder)} disabled={loading} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" onClick={() => setShowLinkModal(true)} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
            <Link2 size={12} /> Change folder
          </button>
          <button type="button" onClick={onUnlink} className="flex items-center gap-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors">
            <X size={12} /> Unlink
          </button>
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center gap-2 py-8 justify-center text-white/30 text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading files…
        </div>
      )}

      {!connected && !loading && !error && (
        <div className="flex flex-col items-center py-10 gap-3 text-center">
          <p className="text-sm text-white/40">Connect your Google Drive to view files.</p>
          <button
            type="button"
            onClick={handleConnect}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Link2 size={14} /> Connect to Google Drive
          </button>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p>{error}</p>
            <button type="button" onClick={handleConnect} className="underline hover:no-underline">Try again</button>
          </div>
        </div>
      )}

      {connected && !loading && !error && files.length === 0 && (
        <div className="text-sm text-white/30 py-8 text-center">This folder is empty.</div>
      )}

      {connected && !loading && !error && files.length > 0 && (
        <div className="space-y-0.5">
          {files.map(f => (
            <FileRow key={f.id} file={f} onOpenFolder={isFolder(f.mimeType) ? openSubFolder : undefined} />
          ))}
        </div>
      )}

      {showLinkModal && <LinkFolderModal onLink={handleLink} onClose={() => setShowLinkModal(false)} />}
    </div>
  );
}
