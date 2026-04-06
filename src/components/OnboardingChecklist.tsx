import React, { useState } from 'react';
import { X, CheckCircle2, Circle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useStore } from '../store';

const STORAGE_KEY = 'hive_onboarding_dismissed';

interface Step {
  id: string;
  title: string;
  description: React.ReactNode;
  isComplete: (settings: any, localStorage: Storage) => boolean;
  action?: { label: string; href?: string; page?: string };
}

const STEPS: Step[] = [
  {
    id: 'google_drive',
    title: 'Connect Google Drive & Calendar',
    description: (
      <ol className="list-decimal list-inside space-y-1.5 text-white/40 text-xs leading-relaxed">
        <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener" className="text-brand-400 hover:text-brand-300">console.cloud.google.com</a> and create a new project</li>
        <li>Enable the <strong className="text-white/60">Google Drive API</strong>, <strong className="text-white/60">Google Picker API</strong>, and <strong className="text-white/60">Google Calendar API</strong></li>
        <li>Go to Credentials → Create OAuth 2.0 Client ID (Web application)</li>
        <li>Add your Hive URL to Authorized JavaScript Origins</li>
        <li>Also create an API Key under Credentials</li>
        <li>Paste both into <strong className="text-white/60">Settings → Google Drive</strong> and save</li>
      </ol>
    ),
    isComplete: (_s, ls) => !!(ls.getItem('hive_google_client_id') || ls.getItem('googleClientId')),
    action: { label: 'Open Google Cloud Console', href: 'https://console.cloud.google.com' },
  },
  {
    id: 'claude',
    title: 'Add your Claude AI key',
    description: (
      <ol className="list-decimal list-inside space-y-1.5 text-white/40 text-xs leading-relaxed">
        <li>Go to <a href="https://console.anthropic.com" target="_blank" rel="noopener" className="text-brand-400 hover:text-brand-300">console.anthropic.com</a> and sign in</li>
        <li>Under API Keys, create a new key</li>
        <li>Paste it into <strong className="text-white/60">Settings → Claude AI</strong> and save</li>
      </ol>
    ),
    isComplete: (s, ls) => !!(s?.anthropicApiKey || ls.getItem('hive_anthropic_key')),
    action: { label: 'Get API Key', href: 'https://console.anthropic.com' },
  },
  {
    id: 'granola',
    title: 'Connect Granola for meeting notes',
    description: (
      <ol className="list-decimal list-inside space-y-1.5 text-white/40 text-xs leading-relaxed">
        <li>You need a <strong className="text-white/60">Granola Business</strong> plan ($18/mo) at <a href="https://granola.so" target="_blank" rel="noopener" className="text-brand-400 hover:text-brand-300">granola.so</a></li>
        <li>In Granola, go to Settings → Integrations → copy your API key</li>
        <li>Paste it into <strong className="text-white/60">Settings → Granola</strong> and save</li>
        <li>Click <strong className="text-white/60">Sync Now</strong> to import your notes</li>
      </ol>
    ),
    isComplete: (s) => !!(s?.granolaApiKey),
    action: { label: 'Go to Granola', href: 'https://granola.so' },
  },
  {
    id: 'profile',
    title: 'Set up your profile',
    description: (
      <p className="text-white/40 text-xs leading-relaxed">
        Go to <strong className="text-white/60">Settings → Profile</strong> to set your name and add team members if needed.
      </p>
    ),
    isComplete: (_s, ls) => ls.getItem('hive_onboarding_profile_done') === 'true',
    action: { label: 'Mark as done' },
  },
];

export default function OnboardingChecklist({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { userSettings } = useStore();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');
  const [expanded, setExpanded] = useState<string | null>(null);

  if (dismissed) return null;

  const completed = STEPS.filter(s => s.isComplete(userSettings, localStorage));
  const total = STEPS.length;
  const allDone = completed.length === total;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="bg-[#111113] border border-white/[0.08] rounded-2xl overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold text-white">Get started with Hive</div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-24 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all"
                style={{ width: `${(completed.length / total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-white/30">{completed.length}/{total}</span>
          </div>
        </div>
        <button onClick={dismiss} className="p-1 text-white/20 hover:text-white/50 transition-colors" title="Dismiss">
          <X size={14} />
        </button>
      </div>

      {/* Steps */}
      <div className="divide-y divide-white/[0.04]">
        {STEPS.map(step => {
          const done = step.isComplete(userSettings, localStorage);
          const isOpen = expanded === step.id;

          return (
            <div key={step.id}>
              <button
                onClick={() => setExpanded(isOpen ? null : step.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
              >
                {done
                  ? <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                  : <Circle size={16} className="text-white/20 flex-shrink-0" />
                }
                <span className={`flex-1 text-sm ${done ? 'text-white/30 line-through' : 'text-white/70'}`}>
                  {step.title}
                </span>
                {isOpen ? <ChevronUp size={14} className="text-white/20" /> : <ChevronDown size={14} className="text-white/20" />}
              </button>

              {isOpen && (
                <div className="px-5 pb-4 ml-7">
                  <div className="mb-3">{step.description}</div>
                  {step.action && (
                    step.action.href ? (
                      <a
                        href={step.action.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors"
                      >
                        {step.action.label} <ExternalLink size={11} />
                      </a>
                    ) : step.action.page ? (
                      <button
                        onClick={() => onNavigate?.(step.action!.page!)}
                        className="text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors"
                      >
                        {step.action.label}
                      </button>
                    ) : (
                      <button
                        onClick={() => { localStorage.setItem('hive_onboarding_profile_done', 'true'); setExpanded(null); }}
                        className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        {step.action.label}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className="px-5 py-4 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-sm text-emerald-400">You're all set. Welcome to Hive.</span>
          <button onClick={dismiss} className="text-xs text-white/30 hover:text-white/60 transition-colors">Dismiss</button>
        </div>
      )}
    </div>
  );
}
