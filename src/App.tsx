import React, { useState, useRef, useEffect } from 'react';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import VoicePanel from './components/VoicePanel';
import TaskDetail from './components/TaskDetail';
import ErrorBoundary from './components/ErrorBoundary';
import CommandPalette from './components/CommandPalette';
import Home from './pages/Home';
import ProjectHub from './pages/ProjectHub';
import TasksPage from './pages/TasksPage';
import ContactsPage from './pages/ContactsPage';
import SarahView from './pages/SarahView';
import MessagesPage from './pages/MessagesPage';
import NotificationsPage from './pages/NotificationsPage';
import { useReminderChecker } from './hooks/useReminderChecker';
import { useHealthSweep } from './hooks/useHealthSweep';

function SettingsPage({ currentUser, darkMode, toggleDarkMode }: { currentUser: any; darkMode: boolean; toggleDarkMode: () => void }) {
  const clientIdRef = useRef<HTMLInputElement>(null);
  const apiKeyRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);

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

  const userId = currentUser?.id || 'lev';

  const saveCredentials = () => {
    if (clientIdRef.current) localStorage.setItem('google_client_id', clientIdRef.current.value.trim());
    if (apiKeyRef.current) localStorage.setItem('google_api_key', apiKeyRef.current.value.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const savePhone = () => {
    if (phoneRef.current) {
      const val = phoneRef.current.value.trim();
      if (val) localStorage.setItem(`pushover_user_key_${userId}`, val);
      else localStorage.removeItem(`pushover_user_key_${userId}`);
    }
    setPhoneSaved(true);
    setTimeout(() => setPhoneSaved(false), 2000);
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

        {/* Reminders */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Reminders</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-4">
            <p className="text-xs text-white/40 leading-relaxed">
              Get push notifications when tasks are due via{' '}
              <span className="text-white/60">Pushover</span>.{' '}
              <span className="text-white/25">Setup: pushover.net → sign up → buy the app ($5 one-time) → copy your User Key below.</span>
            </p>
            <div>
              <label className="text-xs text-white/40 block mb-1.5">Pushover User Key</label>
              <input
                ref={phoneRef}
                type="text"
                defaultValue={localStorage.getItem(`pushover_user_key_${userId}`) || ''}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/60 placeholder-white/20 focus:outline-none focus:border-brand-500/40 font-mono"
              />
              <p className="text-xs text-white/25 mt-1.5">Found on your Pushover dashboard</p>
            </div>
            <button
              onClick={savePhone}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${phoneSaved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brand-600 hover:bg-brand-500 text-white'}`}
            >
              {phoneSaved ? '✓ Saved' : 'Save User Key'}
            </button>
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
              <span className="text-white/25">Setup: console.cloud.google.com → New Project → Enable "Google Drive API" + "Google Picker API" + "Google Calendar API" → Credentials → Create OAuth 2.0 Client ID (Web) → add http://localhost:5173 to Authorized JavaScript Origins → also create an API Key.</span>
            </p>
            <div>
              <label className="text-xs text-white/40 block mb-1.5">OAuth Client ID</label>
              <input
                ref={clientIdRef}
                type="text"
                defaultValue={localStorage.getItem('google_client_id') || ''}
                placeholder="xxxxxxxx.apps.googleusercontent.com"
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/60 placeholder-white/20 focus:outline-none focus:border-brand-500/40 font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1.5">API Key</label>
              <input
                ref={apiKeyRef}
                type="text"
                defaultValue={localStorage.getItem('google_api_key') || ''}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/60 placeholder-white/20 focus:outline-none focus:border-brand-500/40 font-mono"
              />
            </div>
            <button
              onClick={saveCredentials}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${saved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brand-600 hover:bg-brand-500 text-white'}`}
            >
              {saved ? '✓ Saved' : 'Save Credentials'}
            </button>
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
  | { id: 'contacts' }
  | { id: 'messages' }
  | { id: 'project'; projectId: string }
  | { id: 'sarah' }
  | { id: 'notifications' }
  | { id: 'settings' };

export default function App() {
  const { sidebarOpen, currentUser, darkMode, toggleDarkMode } = useStore();
  const [page, setPage] = useState<Page>({ id: 'home' });
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [cmdKOpen, setCmdKOpen] = useState(false);

  // Mount the SMS reminder checker
  useReminderChecker(currentUser?.id || 'lev');
  useHealthSweep(currentUser?.id || 'lev');

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

  const navigate = (pageName: string, id?: string) => {
    if (pageName === 'home') setPage({ id: 'home' });
    else if (pageName === 'tasks') setPage({ id: 'tasks' });
    else if (pageName === 'contacts') setPage({ id: 'contacts' });
    else if (pageName === 'messages') setPage({ id: 'messages' });
    else if (pageName === 'project' && id) setPage({ id: 'project', projectId: id });
    else if (pageName === 'sarah') setPage({ id: 'sarah' });
    else if (pageName === 'notifications') setPage({ id: 'notifications' });
    else if (pageName === 'settings') setPage({ id: 'settings' });
  };

  const activePage = page.id === 'project' ? `project-${(page as any).projectId}` : page.id;

  const renderPage = () => {
    switch (page.id) {
      case 'home':
        return <Home onNavigate={navigate} onOpenTask={setOpenTaskId} />;
      case 'tasks':
        return <TasksPage onOpenTask={setOpenTaskId} />;
      case 'contacts':
        return <ContactsPage />;
      case 'messages':
        return <MessagesPage />;
      case 'project':
        return <ProjectHub projectId={(page as any).projectId} onNavigate={navigate} onOpenTask={setOpenTaskId} />;
      case 'sarah':
        return <SarahView onOpenTask={setOpenTaskId} />;
      case 'notifications':
        return <NotificationsPage onNavigate={navigate} onOpenTask={setOpenTaskId} />;
      case 'settings':
        return <SettingsPage currentUser={currentUser} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
      default:
        return <Home onNavigate={navigate} onOpenTask={setOpenTaskId} />;
    }
  };

  return (
    <div className="flex h-full bg-[#0f0f10]">
      <Sidebar activePage={activePage} onNavigate={navigate} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <ErrorBoundary>
          {renderPage()}
        </ErrorBoundary>
      </main>
      <VoicePanel />
      {openTaskId && <TaskDetail taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
      {cmdKOpen && <CommandPalette onClose={() => setCmdKOpen(false)} onNavigate={navigate} onOpenTask={(id) => { setOpenTaskId(id); setCmdKOpen(false); }} />}
    </div>
  );
}
