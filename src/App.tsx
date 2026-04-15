import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from './store';
import type { Toast } from './store';
import { DEFAULT_HOME_SECTIONS } from './types';
import { useAuth } from './hooks/useAuth';
import { apiFetch } from './lib/apiFetch';
import { Home as HomeIcon, CheckSquare, MessageSquare, Users, MoreHorizontal, Calendar, FolderOpen, Eye, EyeOff } from 'lucide-react';
import LoginPage from './pages/LoginPage';
import Sidebar from './components/Sidebar';
import VoicePanel from './components/VoicePanel';
import TaskDetail from './components/TaskDetail';
import ErrorBoundary from './components/ErrorBoundary';
import CommandPalette from './components/CommandPalette';
import QuickCapture from './components/QuickCapture';
import Home from './pages/Home';
import ProjectHub from './pages/ProjectHub';
import TasksPage from './pages/TasksPage';
import ContactsPage from './pages/ContactsPage';
import TeamMemberView from './pages/TeamMemberView';
import MessagesPage from './pages/MessagesPage';
import NotificationsPage from './pages/NotificationsPage';
import TodayPage from './pages/TodayPage';
import MeetingsPage, { useUnreviewedMeetingCount } from './pages/MeetingsPage';
import MobileProjectsPage from './pages/MobileProjectsPage';
import TrashPage from './pages/TrashPage';
import { useHealthSweep } from './hooks/useHealthSweep';
import { useGranolaSync } from './hooks/useGranolaSync';
import { useFirefliesSync } from './hooks/useFirefliesSync';
import { GOOGLE_CLIENT_ID_KEY, GOOGLE_API_KEY_KEY, ANTHROPIC_API_KEY_KEY } from './lib/storageKeys';

function SettingsPage({ currentUser, darkMode, toggleDarkMode }: { currentUser: any; darkMode: boolean; toggleDarkMode: () => void }) {
  const { addUserFlag, updateUserFlag, removeUserFlag, userSettings, saveUserSettings, triggerGranolaSync } = useStore();
  const clientIdRef = useRef<HTMLInputElement>(null);
  const apiKeyRef = useRef<HTMLInputElement>(null);
  const anthropicKeyRef = useRef<HTMLInputElement>(null);
  const granolaKeyRef = useRef<HTMLInputElement>(null);
  const firefliesKeyRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);
  const [granolaKeySaved, setGranolaKeySaved] = useState(false);
  const [firefliesKeySaved, setFirefliesKeySaved] = useState(false);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [newFlagName, setNewFlagName] = useState('');
  const [newFlagColor, setNewFlagColor] = useState('#6366f1');
  const [editingFlagId, setEditingFlagId] = useState<string | null>(null);
  const [editingFlagName, setEditingFlagName] = useState('');
  const [showClientId, setShowClientId] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showGranolaKey, setShowGranolaKey] = useState(false);
  const [showFirefliesKey, setShowFirefliesKey] = useState(false);

  const FLAG_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981', '#06b6d4', '#6366f1', '#a855f7', '#ec4899'];

  const handleAddFlag = () => {
    if (!newFlagName.trim()) return;
    addUserFlag({ name: newFlagName.trim(), color: newFlagColor });
    setNewFlagName('');
    setNewFlagColor('#6366f1');
  };

  const handleExport = () => {
    const state = useStore.getState();
    const data = {
      tasks: state.tasks,
      projects: state.projects,
      contacts: state.contacts,
      channels: state.channels,
      messages: state.messages,
      notifications: state.notifications,
      users: state.users,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hive-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(data.tasks) || !Array.isArray(data.projects)) {
          setImportError('Invalid backup file — missing tasks or projects.');
          return;
        }
        setImportError(null);
        setImportPreview(data);
      } catch {
        setImportError('Invalid file — could not parse JSON.');
      }
    };
    reader.readAsText(file);
  };

  const handleImportConfirm = () => {
    const d = importPreview;
    useStore.setState({
      tasks: d.tasks ?? [],
      projects: d.projects ?? [],
      contacts: d.contacts ?? [],
      channels: d.channels ?? [],
      messages: d.messages ?? [],
      notifications: d.notifications ?? [],
      users: d.users ?? [],
    });
    setImportPreview(null);
  };

  const userId = currentUser?.id || '__loading__';

  const saveCredentials = async () => {
    const clientId = clientIdRef.current?.value.trim() ?? '';
    const apiKey = apiKeyRef.current?.value.trim() ?? '';
    const anthropicKey = anthropicKeyRef.current?.value.trim() ?? '';
    if (clientIdRef.current) localStorage.setItem(GOOGLE_CLIENT_ID_KEY, clientId);
    if (apiKeyRef.current) localStorage.setItem(GOOGLE_API_KEY_KEY, apiKey);
    if (anthropicKeyRef.current) localStorage.setItem(ANTHROPIC_API_KEY_KEY, anthropicKey);
    await saveUserSettings({ googleClientId: clientId || undefined, anthropicApiKey: anthropicKey || undefined });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const saveGranolaKey = async () => {
    const key = granolaKeyRef.current?.value.trim() ?? '';
    // Clear granolaLastSyncedAt so the next sync re-fetches all meetings from scratch
    await saveUserSettings({ granolaApiKey: key || undefined, granolaLastSyncedAt: undefined });
    setGranolaKeySaved(true);
    setTimeout(() => setGranolaKeySaved(false), 2000);
  };

  const [syncing, setSyncing] = useState(false);
  const syncGranolaNow = async () => {
    const apiKey = granolaKeyRef.current?.value.trim() || userSettings?.granolaApiKey || '';
    if (!apiKey || syncing) return;
    setSyncing(true);
    try {
      const res = await apiFetch('/api/sync-granola', { since: null, limit: 30 });
      if (!res.ok) { setSyncing(false); return; }
      const { notes } = await res.json() as { notes: any[]; count: number };
      const { upsertMeeting, updateMeeting, meetings: currentMeetings, contacts, projects } = useStore.getState();
      const existingIds = new Set(currentMeetings.filter(m => m.externalId).map(m => `${m.provider}:${m.externalId}`));
      for (const note of notes) {
        try {
          const meeting = await upsertMeeting({ ...note, contactId: '', linkedContactIds: [], linkedProjectIds: [], suggestedProjectIds: [], actionItems: [], hasProjectLinks: false, reviewed: false });
          const isNew = !existingIds.has(`${note.provider}:${note.externalId}`);
          const hasNoItems = !meeting.actionItems || meeting.actionItems.length === 0;
          if ((isNew || hasNoItems) && note.notes) {
            apiFetch('/api/link-meeting', { meetingId: meeting.id, title: note.title, notes: note.notes, transcript: note.transcript, projects: projects.map((p: any) => ({ id: p.id, name: p.name })) }).then(r => r.json()).then((linked: any) => {
              updateMeeting(meeting.id, { linkedProjectIds: linked.linkedProjectIds ?? [], suggestedProjectIds: linked.suggestedProjectIds ?? [], actionItems: linked.actionItems ?? [], hasProjectLinks: (linked.linkedProjectIds?.length ?? 0) > 0 });
            }).catch(() => {});
          }
        } catch (noteErr) {
          console.error('Granola sync: failed to upsert note', note.externalId, noteErr);
          // Continue processing remaining notes
        }
      }
      await saveUserSettings({ granolaLastSyncedAt: new Date().toISOString() });
    } catch (e) {
      console.error('Sync failed:', e);
    }
    setSyncing(false);
  };

  const saveFirefliesKey = async () => {
    const key = firefliesKeyRef.current?.value.trim() ?? '';
    await saveUserSettings({ firefliesApiKey: key || undefined, firefliesLastSyncedAt: undefined });
    setFirefliesKeySaved(true);
    setTimeout(() => setFirefliesKeySaved(false), 2000);
  };

  const [syncingFireflies, setSyncingFireflies] = useState(false);
  const syncFirefliesNow = async () => {
    const apiKey = firefliesKeyRef.current?.value.trim() || userSettings?.firefliesApiKey || '';
    if (!apiKey || syncingFireflies) return;
    setSyncingFireflies(true);
    try {
      const res = await apiFetch('/api/sync-fireflies', { since: null, limit: 30 });
      if (!res.ok) { setSyncingFireflies(false); return; }
      const { notes } = await res.json() as { notes: any[]; count: number };
      const { upsertMeeting, updateMeeting, meetings: currentMeetings, contacts, projects } = useStore.getState();
      const existingIds = new Set(currentMeetings.filter(m => m.externalId).map(m => `${m.provider}:${m.externalId}`));
      for (const note of notes) {
        try {
          const meeting = await upsertMeeting({ ...note, contactId: '', linkedContactIds: [], linkedProjectIds: [], suggestedProjectIds: [], actionItems: [], hasProjectLinks: false, reviewed: false });
          const isNew = !existingIds.has(`${note.provider}:${note.externalId}`);
          const hasNoItems = !meeting.actionItems || meeting.actionItems.length === 0;
          if ((isNew || hasNoItems) && (note.notes || note.transcript)) {
            apiFetch('/api/link-meeting', { meetingId: meeting.id, title: note.title, notes: note.notes, transcript: note.transcript, projects: projects.map((p: any) => ({ id: p.id, name: p.name })) }).then(r => r.json()).then((linked: any) => {
              updateMeeting(meeting.id, { linkedProjectIds: linked.linkedProjectIds ?? [], suggestedProjectIds: linked.suggestedProjectIds ?? [], actionItems: linked.actionItems ?? [], hasProjectLinks: (linked.linkedProjectIds?.length ?? 0) > 0 });
            }).catch(() => {});
          }
        } catch (noteErr) {
          console.error('Fireflies sync: failed to upsert note', note.externalId, noteErr);
        }
      }
      await saveUserSettings({ firefliesLastSyncedAt: new Date().toISOString() });
    } catch (e) {
      console.error('Fireflies sync failed:', e);
    }
    setSyncingFireflies(false);
  };

  return (
    <>
    <div className="flex-1 overflow-y-auto scrollbar-hide">
      <div className="max-w-2xl mx-auto px-8 py-8">
        <h1 className="text-2xl font-semibold text-white tracking-tight mb-8">Settings</h1>

        {/* Account */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Account</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.06]">
            <div className="flex items-center justify-between px-4 py-3"><span className="text-sm text-white/50">Name</span><span className="text-sm text-white/80">{currentUser?.name || 'Lev Freedman'}</span></div>
            <div className="flex items-center justify-between px-4 py-3"><span className="text-sm text-white/50">Role</span><span className="text-sm text-white/80">Admin</span></div>
          </div>
        </div>

        {/* Appearance */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Appearance</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-white/70">Dark Mode</span>
              <button onClick={toggleDarkMode} className={`w-10 h-6 rounded-full transition-colors flex items-center ${darkMode ? 'bg-brand-600' : 'bg-white/20'}`}>
                <span className={`block w-4 h-4 rounded-full bg-white mx-1 transition-transform ${darkMode ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* My Flags */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">My Flags</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
            <p className="text-xs text-white/40">Flags you can apply to any task. Other users see their own flags.</p>
            {/* Existing flags */}
            <div className="space-y-1.5">
              {(currentUser?.flags || []).map((f: any) => (
                <div key={f.id} className="flex items-center gap-2.5 py-1">
                  {editingFlagId === f.id ? (
                    <>
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: f.color }} />
                      <input
                        autoFocus
                        value={editingFlagName}
                        onChange={e => setEditingFlagName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { updateUserFlag(f.id, { name: editingFlagName.trim() || f.name }); setEditingFlagId(null); }
                          if (e.key === 'Escape') setEditingFlagId(null);
                        }}
                        onBlur={() => { updateUserFlag(f.id, { name: editingFlagName.trim() || f.name }); setEditingFlagId(null); }}
                        className="flex-1 bg-white/[0.06] border border-white/[0.12] rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-brand-500/50"
                      />
                    </>
                  ) : (
                    <>
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: f.color }} />
                      <span
                        className="flex-1 text-sm text-white/70 cursor-pointer hover:text-white transition-colors"
                        onClick={() => { setEditingFlagId(f.id); setEditingFlagName(f.name); }}
                      >
                        {f.name}
                      </span>
                      <button
                        onClick={() => removeUserFlag(f.id)}
                        className="text-white/15 hover:text-red-400 transition-colors text-xs px-1.5 py-0.5 rounded"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
            {/* Add new flag */}
            <div className="pt-2 border-t border-white/[0.06] space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={newFlagName}
                  onChange={e => setNewFlagName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddFlag(); }}
                  placeholder="New flag name..."
                  className="flex-1 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/70 placeholder-white/20 focus:outline-none focus:border-brand-500/40"
                />
                <button
                  onClick={handleAddFlag}
                  disabled={!newFlagName.trim()}
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {FLAG_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewFlagColor(c)}
                    className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                    style={{ background: c, boxShadow: newFlagColor === c ? `0 0 0 2px #fff4, 0 0 0 3px ${c}` : 'none' }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Data */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Data</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-4">
            <p className="text-xs text-white/40 leading-relaxed">
              Export a full backup of your tasks, projects, contacts, and messages. Import to restore from a backup file.{' '}
              <span className="text-white/25">Import replaces all current data — export first if you want to keep it.</span>
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExport}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white transition-colors"
              >
                Export JSON
              </button>
              <button
                onClick={() => importInputRef.current?.click()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white/[0.06] hover:bg-white/[0.10] text-white/60 hover:text-white/80 transition-colors"
              >
                Import Backup…
              </button>
              <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
            </div>
            {importError && <p className="text-xs text-red-400">{importError}</p>}
          </div>
        </div>

        {/* Google Drive */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Google Drive</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-4">
            <p className="text-xs text-white/40 leading-relaxed">
              Connect Google Drive to attach files from your Drive directly to tasks. Requires a free Google Cloud project.{' '}
              <span className="text-white/25">Setup: console.cloud.google.com → New Project → Enable "Google Drive API" + "Google Picker API" + "Google Calendar API" → Credentials → Create OAuth 2.0 Client ID (Web) → add https://www.hivenow.app and http://localhost:5173 to Authorized JavaScript Origins → also create an API Key.</span>
            </p>
            <div>
              <label className="text-xs text-white/40 block mb-1.5">OAuth Client ID</label>
              <div className="relative">
                <input
                  ref={clientIdRef}
                  type={showClientId ? 'text' : 'password'}
                  defaultValue={localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || ''}
                  placeholder="xxxxxxxx.apps.googleusercontent.com"
                  className="w-full px-3 py-2 pr-9 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/60 placeholder-white/20 focus:outline-none focus:border-brand-500/40 font-mono"
                />
                <button type="button" onClick={() => setShowClientId(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors">
                  {showClientId ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1.5">API Key</label>
              <div className="relative">
                <input
                  ref={apiKeyRef}
                  type={showApiKey ? 'text' : 'password'}
                  defaultValue={localStorage.getItem(GOOGLE_API_KEY_KEY) || ''}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 pr-9 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/60 placeholder-white/20 focus:outline-none focus:border-brand-500/40 font-mono"
                />
                <button type="button" onClick={() => setShowApiKey(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors">
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <button
              onClick={saveCredentials}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${saved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brand-600 hover:bg-brand-500 text-white'}`}
            >
              {saved ? '✓ Saved' : 'Save Credentials'}
            </button>
          </div>
        </div>

        {/* Google Calendar defaults */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Google Calendar</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm text-white/70">Sync new tasks to calendar by default</p>
                <p className="text-xs text-white/30 mt-0.5">When enabled, new tasks with a due date will automatically appear on your Google Calendar</p>
              </div>
              <button
                onClick={() => saveUserSettings({ calendarDefaultSync: !(userSettings?.calendarDefaultSync ?? false) })}
                className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-4 ${userSettings?.calendarDefaultSync ? 'bg-brand-500' : 'bg-white/[0.12]'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform mx-0.5 ${userSettings?.calendarDefaultSync ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </label>
          </div>
        </div>

        {/* Claude / Anthropic */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Claude AI</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-4">
            <p className="text-xs text-white/40 leading-relaxed">
              Powers the Claude bar on your Home page. Each user brings their own key — Hive never sees your data or pays for your queries.
              Get a key at <span className="text-brand-400">console.anthropic.com</span>.
            </p>
            <div>
              <label className="text-xs text-white/40 block mb-1.5">Anthropic API Key</label>
              <div className="relative">
                <input
                  ref={anthropicKeyRef}
                  type={showAnthropicKey ? 'text' : 'password'}
                  defaultValue={localStorage.getItem(ANTHROPIC_API_KEY_KEY) || userSettings?.anthropicApiKey || ''}
                  placeholder="sk-ant-..."
                  className="w-full px-3 py-2 pr-9 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/60 placeholder-white/20 focus:outline-none focus:border-brand-500/40 font-mono"
                />
                <button type="button" onClick={() => setShowAnthropicKey(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors">
                  {showAnthropicKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <button
              onClick={saveCredentials}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${saved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brand-600 hover:bg-brand-500 text-white'}`}
            >
              {saved ? '✓ Saved' : 'Save'}
            </button>
          </div>
        </div>

        {/* Home Layout */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Home Layout</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
            <p className="text-xs text-white/40 mb-4 leading-relaxed">
              Choose which sections appear on your Home page. Drag to reorder, or use the AI command bar (⌘K) to rearrange with natural language.
            </p>
            <div className="space-y-1">
              {(userSettings?.homeSections ?? DEFAULT_HOME_SECTIONS).map((section, idx) => (
                <div key={section.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                  <button
                    onClick={async () => {
                      const current = userSettings?.homeSections ?? DEFAULT_HOME_SECTIONS;
                      const updated = current.map(s => s.id === section.id ? { ...s, enabled: !s.enabled } : s);
                      await saveUserSettings({ homeSections: updated });
                    }}
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${section.enabled ? 'bg-brand-500 border-brand-500' : 'border-white/20 bg-transparent'}`}
                  >
                    {section.enabled && <span className="text-white text-[10px]">✓</span>}
                  </button>
                  <span className={`text-sm flex-1 ${section.enabled ? 'text-white/70' : 'text-white/25'}`}>{section.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Integrations — AI Meeting Notes */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Meeting Note Integrations</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-4">
            <p className="text-xs text-white/40 leading-relaxed">
              Automatically sync AI meeting notes into Hive. Notes are matched to your contacts and projects.
            </p>

            {/* Granola */}
            <div className="border-t border-white/[0.06] pt-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-white/70">Granola</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-semibold">Supported</span>
                {userSettings?.granolaLastSyncedAt ? (
                  <span className="text-[10px] text-white/25 ml-auto flex items-center gap-2">
                    Last synced {new Date(userSettings.granolaLastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    <button
                      onClick={() => saveUserSettings({ granolaLastSyncedAt: undefined })}
                      className="text-white/30 hover:text-white/60 underline transition-colors"
                    >
                      Re-sync all
                    </button>
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-white/25 mb-3">
                Requires Granola Business plan ($18/mo). Get your API key at granola.so → Settings → Integrations.
              </p>
              <div className="mb-3">
                <label className="text-xs text-white/40 block mb-1.5">Granola API Key</label>
                <div className="relative">
                  <input
                    ref={granolaKeyRef}
                    type={showGranolaKey ? 'text' : 'password'}
                    defaultValue={userSettings?.granolaApiKey ?? ''}
                    placeholder="gran_..."
                    className="w-full px-3 py-2 pr-9 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/60 placeholder-white/20 focus:outline-none focus:border-brand-500/40 font-mono"
                  />
                  <button type="button" onClick={() => setShowGranolaKey(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors">
                    {showGranolaKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={saveGranolaKey}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${granolaKeySaved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brand-600 hover:bg-brand-500 text-white'}`}
                >
                  {granolaKeySaved ? '✓ Saved' : 'Save API Key'}
                </button>
                <button
                  onClick={syncGranolaNow}
                  disabled={syncing}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-white/[0.06] hover:bg-white/[0.10] text-white/60 hover:text-white/80 transition-colors disabled:opacity-50"
                >
                  {syncing ? 'Syncing…' : 'Sync Now'}
                </button>
              </div>
            </div>

            {/* Fireflies */}
            <div className="border-t border-white/[0.06] pt-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-white/70">Fireflies</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-400 font-semibold">Supported</span>
                {userSettings?.firefliesLastSyncedAt ? (
                  <span className="text-[10px] text-white/25 ml-auto flex items-center gap-2">
                    Last synced {new Date(userSettings.firefliesLastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    <button
                      onClick={() => saveUserSettings({ firefliesLastSyncedAt: undefined })}
                      className="text-white/30 hover:text-white/60 underline transition-colors"
                    >
                      Re-sync all
                    </button>
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-white/25 mb-3">
                Requires Fireflies Business plan. Get your API key at app.fireflies.ai → Settings → Developer API.
              </p>
              <div className="mb-3">
                <label className="text-xs text-white/40 block mb-1.5">Fireflies API Key</label>
                <div className="relative">
                  <input
                    ref={firefliesKeyRef}
                    type={showFirefliesKey ? 'text' : 'password'}
                    defaultValue={userSettings?.firefliesApiKey ?? ''}
                    placeholder="ff_..."
                    className="w-full px-3 py-2 pr-9 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/60 placeholder-white/20 focus:outline-none focus:border-brand-500/40 font-mono"
                  />
                  <button type="button" onClick={() => setShowFirefliesKey(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors">
                    {showFirefliesKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={saveFirefliesKey}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${firefliesKeySaved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brand-600 hover:bg-brand-500 text-white'}`}
                >
                  {firefliesKeySaved ? '✓ Saved' : 'Save API Key'}
                </button>
                <button
                  onClick={syncFirefliesNow}
                  disabled={syncingFireflies}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-white/[0.06] hover:bg-white/[0.10] text-white/60 hover:text-white/80 transition-colors disabled:opacity-50"
                >
                  {syncingFireflies ? 'Syncing…' : 'Sync Now'}
                </button>
              </div>
            </div>

            {/* Otter — coming soon */}
            <div className="border-t border-white/[0.06] pt-4 opacity-40">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white/70">Otter.ai</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-white/30 font-semibold">Coming soon</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Import confirmation modal */}
    {importPreview && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-[#1a1a1f] border border-white/[0.10] rounded-2xl p-6 w-80 shadow-2xl">
          <h3 className="text-white font-semibold mb-2">Replace all data?</h3>
          <p className="text-sm text-white/50 mb-4">
            Backup contains{' '}
            <span className="text-white/80">{importPreview.tasks?.length ?? 0} tasks</span> and{' '}
            <span className="text-white/80">{importPreview.projects?.length ?? 0} projects</span>.
            This will replace your current data.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleImportConfirm}
              className="flex-1 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Replace
            </button>
            <button
              onClick={() => setImportPreview(null)}
              className="flex-1 py-2 bg-white/[0.06] hover:bg-white/[0.10] text-white/60 text-sm rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

type Page =
  | { id: 'home' }
  | { id: 'tasks' }
  | { id: 'today' }
  | { id: 'contacts' }
  | { id: 'messages' }
  | { id: 'meetings' }
  | { id: 'projects' }
  | { id: 'project'; projectId: string }
  | { id: 'team-member'; userId: string }
  | { id: 'notifications' }
  | { id: 'settings' }
  | { id: 'trash' };

function hashToPage(hash: string): Page {
  const h = hash.replace(/^#/, '');
  if (h === 'tasks') return { id: 'tasks' };
  if (h === 'today') return { id: 'today' };
  if (h === 'contacts') return { id: 'contacts' };
  if (h === 'messages') return { id: 'messages' };
  if (h === 'meetings') return { id: 'meetings' };
  if (h === 'notifications') return { id: 'notifications' };
  if (h === 'settings') return { id: 'settings' };
  if (h === 'trash') return { id: 'trash' };
  if (h === 'projects') return { id: 'projects' };
  if (h.startsWith('project-')) return { id: 'project', projectId: h.slice(8) };
  if (h.startsWith('team-member-')) return { id: 'team-member', userId: h.slice(12) };
  return { id: 'home' };
}

function pageToHash(p: Page): string {
  if (p.id === 'project') return `#project-${(p as any).projectId}`;
  if (p.id === 'team-member') return `#team-member-${(p as any).userId}`;
  if (p.id === 'home') return '#home';
  return `#${p.id}`;
}

function MobileBottomNav({ activePage, onNavigate, unreviewedMeetingCount }: { activePage: string; onNavigate: (page: string, id?: string) => void; unreviewedMeetingCount: number }) {
  const { channels, messages, currentUser } = useStore();

  const unreadMessages = channels
    .filter(c => c.memberIds?.includes(currentUser?.id ?? '') && !c.muted && !c.deletedAt)
    .reduce((total, ch) => {
      const count = messages.filter(m =>
        m.channelId === ch.id && m.authorId !== currentUser?.id &&
        (ch.lastReadAt ? m.createdAt > ch.lastReadAt : true)
      ).length;
      return total + count;
    }, 0);

  const tabs = [
    { id: 'home',     label: 'Home',     icon: <HomeIcon size={22} /> },
    { id: 'tasks',    label: 'Tasks',    icon: <CheckSquare size={22} /> },
    { id: 'messages', label: 'Messages', icon: <MessageSquare size={22} />, badge: unreadMessages },
    { id: 'projects', label: 'Projects', icon: <FolderOpen size={22} /> },
    { id: 'more',     label: 'More',     icon: <MoreHorizontal size={22} /> },
  ];

  const [showMore, setShowMore] = useState(false);

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)}>
          <div
            className="absolute bottom-16 right-0 left-0 mx-4 bg-[#1c1c1f] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {[
              { id: 'contacts',      label: 'Contacts' },
              { id: 'meetings',      label: 'Meetings', badge: unreviewedMeetingCount },
              { id: 'notifications', label: 'Notifications' },
              { id: 'settings',      label: 'Settings' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); setShowMore(false); }}
                className="w-full px-5 py-3.5 text-left text-sm text-white/70 hover:bg-white/[0.06] border-b border-white/[0.06] last:border-0 transition-colors flex items-center justify-between"
              >
                {item.label}
                {!!(item as any).badge && (
                  <span className="min-w-[18px] h-4.5 px-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {(item as any).badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0f0f10]/95 backdrop-blur-xl border-t border-white/[0.08] pb-safe">
        <div className="flex items-center">
          {tabs.map(tab => {
            const isActive = tab.id === 'more'
              ? ['notifications', 'settings'].includes(activePage)
              : activePage === tab.id || activePage.startsWith(tab.id + '-');
            return (
              <button
                key={tab.id}
                onClick={() => tab.id === 'more' ? setShowMore(v => !v) : onNavigate(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors relative ${
                  isActive ? 'text-brand-400' : 'text-white/30 hover:text-white/50'
                }`}
              >
                {tab.icon}
                <span className="text-[10px] font-medium">{tab.label}</span>
                {/* Unread badge — !! prevents React rendering stray 0 */}
                {!!tab.badge && (
                  <span className="absolute top-1.5 right-[calc(50%-14px)] min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none shadow-lg shadow-red-500/40">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function ToastStack() {
  const { toasts, dismissToast } = useStore();
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto max-w-sm
            ${t.type === 'error' ? 'bg-red-500/90 text-white' : t.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-white/10 text-white border border-white/10'}`}
        >
          <span>{t.message}</span>
          <button onClick={() => dismissToast(t.id)} className="ml-1 opacity-70 hover:opacity-100 transition-opacity text-base leading-none">×</button>
        </div>
      ))}
    </div>
  );
}

function AuthenticatedApp() {
  const { sidebarOpen, currentUser, isLoading, darkMode, toggleDarkMode } = useStore();
  const [page, setPage] = useState<Page>(() => hashToPage(window.location.hash));
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [cmdKOpen, setCmdKOpen] = useState(false);
  const [quickCaptureText, setQuickCaptureText] = useState<string | null>(null);

  useHealthSweep(currentUser?.id || '__loading__');
  useGranolaSync();
  useFirefliesSync();
  const unreviewedMeetingCount = useUnreviewedMeetingCount();

  // Handle ?task=xxx URL param for deep links from SMS reminders
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('task');
    if (taskId) {
      setOpenTaskId(taskId);
      // Clean URL without reload
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Sync hash → page when user navigates with browser back/forward
  useEffect(() => {
    const onHashChange = () => setPage(hashToPage(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdKOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Block the full layout until the first data load is done.
  // This prevents the placeholder user (id: '__loading__') from briefly
  // appearing in the sidebar while Supabase hydrates the store.
  if (isLoading || currentUser.id === '__loading__') {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <span className="text-2xl font-bold text-white tracking-tight opacity-60">Hive</span>
      </div>
    );
  }

  const navigate = (pageName: string, id?: string) => {
    let newPage: Page = { id: 'home' };
    if (pageName === 'tasks') newPage = { id: 'tasks' };
    else if (pageName === 'today') newPage = { id: 'today' };
    else if (pageName === 'contacts') newPage = { id: 'contacts' };
    else if (pageName === 'messages') newPage = { id: 'messages' };
    else if (pageName === 'meetings') newPage = { id: 'meetings' };
    else if (pageName === 'project' && id) newPage = { id: 'project', projectId: id };
    else if (pageName === 'team-member' && id) newPage = { id: 'team-member', userId: id };
    else if (pageName === 'notifications') newPage = { id: 'notifications' };
    else if (pageName === 'settings') newPage = { id: 'settings' };
    else if (pageName === 'trash') newPage = { id: 'trash' };
    else if (pageName === 'projects') newPage = { id: 'projects' };
    window.location.hash = pageToHash(newPage);
    setPage(newPage);
  };

  const activePage = page.id === 'project'
    ? `project-${(page as any).projectId}`
    : page.id === 'team-member'
    ? `team-member-${(page as any).userId}`
    : page.id;

  const renderPage = () => {
    switch (page.id) {
      case 'home':
        return <Home onNavigate={navigate} onOpenTask={setOpenTaskId} />;
      case 'tasks':
        return <TasksPage onOpenTask={setOpenTaskId} />;
      case 'today':
        return <TodayPage onOpenTask={setOpenTaskId} />;
      case 'projects':
        return <MobileProjectsPage onNavigate={navigate} />;
      case 'contacts':
        return <ContactsPage />;
      case 'messages':
        return <MessagesPage />;
      case 'meetings':
        return <MeetingsPage onOpenTask={setOpenTaskId} />;
      case 'project':
        return <ProjectHub projectId={(page as any).projectId} onNavigate={navigate} onOpenTask={setOpenTaskId} />;
      case 'team-member':
        return <TeamMemberView userId={(page as any).userId} onOpenTask={setOpenTaskId} />;
      case 'notifications':
        return <NotificationsPage onNavigate={navigate} onOpenTask={setOpenTaskId} />;
      case 'settings':
        return <SettingsPage currentUser={currentUser} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
      case 'trash':
        return <TrashPage />;
      default:
        return <Home onNavigate={navigate} onOpenTask={setOpenTaskId} />;
    }
  };

  return (
    <div className="flex h-full bg-[#0f0f10]">
      {/* Sidebar — desktop only */}
      <div className="hidden md:flex h-full">
        <Sidebar activePage={activePage} onNavigate={navigate} />
      </div>
      {/* Main content — add bottom padding on mobile so content clears the nav bar */}
      <main className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0 pt-safe md:pt-0">
        <ErrorBoundary>
          {renderPage()}
        </ErrorBoundary>
      </main>
      {/* Mobile bottom nav */}
      <MobileBottomNav activePage={activePage} onNavigate={navigate} unreviewedMeetingCount={unreviewedMeetingCount} />
      <VoicePanel />
      {openTaskId && <TaskDetail taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
      {cmdKOpen && (
        <CommandPalette
          onClose={() => setCmdKOpen(false)}
          onNavigate={navigate}
          onOpenTask={(id) => { setOpenTaskId(id); setCmdKOpen(false); }}
          onAICapture={(text) => { setCmdKOpen(false); setQuickCaptureText(text); }}
        />
      )}
      {quickCaptureText !== null && (
        <QuickCapture
          initialText={quickCaptureText}
          onClose={() => setQuickCaptureText(null)}
        />
      )}
      <ToastStack />
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <span className="text-2xl font-bold text-white tracking-tight opacity-60">Hive</span>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AuthenticatedApp />;
}
