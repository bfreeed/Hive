import React, { useState, useRef, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { useStore } from '../store';
import { RelationshipTag } from '../types';

const TAG_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16'];

interface Props {
  onClose: () => void;
  onCreated?: (contactId: string) => void;
}

export default function NewContactModal({ onClose, onCreated }: Props) {
  const { addContact, userSettings, saveUserSettings } = useStore();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [business, setBusiness] = useState('');
  const [birthday, setBirthday] = useState('');
  const [address, setAddress] = useState('');
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);

  const nameRef = useRef<HTMLInputElement>(null);
  const tags = userSettings?.relationshipTags ?? [];
  const projects = useStore(s => s.projects);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleCreate = () => {
    if (!name.trim()) return;
    addContact({
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      business: business.trim() || undefined,
      birthday: birthday.trim() || undefined,
      address: address.trim() || undefined,
      projectIds,
      notes: '',
    });
    if (tagIds.length > 0) {
      setTimeout(() => {
        const created = useStore.getState().contacts.find(c => c.name === name.trim());
        if (created) useStore.getState().updateContact(created.id, { relationshipTagIds: tagIds });
      }, 50);
    }
    if (onCreated) {
      setTimeout(() => {
        const created = useStore.getState().contacts.find(c => c.name === name.trim());
        if (created) onCreated(created.id);
      }, 60);
    }
    onClose();
  };

  const handleCreateTag = (tagName: string, color: string) => {
    const id = crypto.randomUUID();
    const newTag: RelationshipTag = { id, name: tagName, color };
    saveUserSettings({ relationshipTags: [...tags, newTag] });
    setTagIds(prev => [...prev, id]);
  };

  const inputClass = 'w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-brand-500/40';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#18181b] border border-white/10 rounded-2xl p-6 w-[480px] max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">New Contact</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06]"><X size={15} /></button>
        </div>

        <div className="space-y-3">
          <input ref={nameRef} value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
            placeholder="Name *" className={inputClass} />
          <input value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="Phone" className={inputClass} />
          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" type="email" className={inputClass} />
          <input value={business} onChange={e => setBusiness(e.target.value)}
            placeholder="Business" className={inputClass} />
          <input value={birthday} onChange={e => setBirthday(e.target.value)}
            type="date" autoComplete="off" data-1p-ignore data-lpignore="true" className={inputClass} />
          <input value={address} onChange={e => setAddress(e.target.value)}
            placeholder="Address" className={inputClass} />

          {/* Relationship tags */}
          <div>
            <p className="text-xs text-white/30 mb-1.5">Relationship</p>
            <RelationshipTagPicker selectedIds={tagIds}
              onToggle={id => setTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
              onCreate={handleCreateTag}
              tags={tags}
            />
          </div>

          {/* Projects */}
          <div>
            <p className="text-xs text-white/30 mb-1.5">Projects</p>
            <div className="flex flex-wrap gap-1.5">
              {projects.map(p => {
                const sel = projectIds.includes(p.id);
                return (
                  <button key={p.id} onClick={() => setProjectIds(prev => sel ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                    className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                    style={sel
                      ? { backgroundColor: p.color + '20', borderColor: p.color + '60', color: p.color }
                      : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)' }}>
                    {p.name}
                  </button>
                );
              })}
              {projects.length === 0 && <p className="text-xs text-white/20">No projects yet</p>}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-white/40 hover:text-white/70 border border-white/[0.08] rounded-lg transition-colors">Cancel</button>
          <button onClick={handleCreate} disabled={!name.trim()}
            className="flex-1 py-2 text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Add Contact
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline relationship tag picker (self-contained, takes tags as prop) ──
function RelationshipTagPicker({ selectedIds, onToggle, onCreate, tags }: {
  selectedIds: string[];
  onToggle: (id: string) => void;
  onCreate: (name: string, color: string) => void;
  tags: RelationshipTag[];
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setCreating(false); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedTags = tags.filter(t => selectedIds.includes(t.id));

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-1.5 flex-wrap min-h-[28px]">
        {selectedTags.map(t => (
          <span key={t.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: t.color + '20', color: t.color }}>
            {t.name}
            <button onClick={() => onToggle(t.id)} className="hover:opacity-70"><X size={10} /></button>
          </span>
        ))}
        <button onClick={() => setOpen(!open)}
          className="text-xs text-white/25 hover:text-white/50 transition-colors flex items-center gap-0.5">
          <Plus size={12} /> Add tag
        </button>
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-56 bg-[#1a1a2e] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden">
          <div className="max-h-40 overflow-y-auto py-1">
            {tags.map(t => (
              <button key={t.id} onClick={() => onToggle(t.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.06] transition-colors">
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: t.color + '20', color: t.color }}>{t.name}</span>
                {selectedIds.includes(t.id) && <span className="ml-auto text-brand-400 text-xs">✓</span>}
              </button>
            ))}
            {tags.length === 0 && <p className="px-3 py-2 text-xs text-white/25">No tags yet</p>}
          </div>
          <div className="border-t border-white/[0.06]">
            {creating ? (
              <div className="p-2 space-y-2">
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Tag name" autoFocus
                  onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { onCreate(newName.trim(), newColor); setNewName(''); setCreating(false); setOpen(false); } if (e.key === 'Escape') setCreating(false); }}
                  className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-white/80 placeholder-white/25 focus:outline-none" />
                <div className="flex gap-1">
                  {TAG_COLORS.map(c => (
                    <button key={c} onClick={() => setNewColor(c)}
                      className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center hover:scale-110 transition-transform"
                      style={{ backgroundColor: c }}>
                      {newColor === c && <span className="text-white text-[8px]">✓</span>}
                    </button>
                  ))}
                </div>
                <button onClick={() => { if (newName.trim()) { onCreate(newName.trim(), newColor); setNewName(''); setCreating(false); setOpen(false); } }}
                  className="w-full py-1 bg-brand-600 hover:bg-brand-500 text-white text-xs rounded-lg transition-colors">
                  Create
                </button>
              </div>
            ) : (
              <button onClick={() => setCreating(true)}
                className="w-full px-3 py-2 text-left text-xs text-white/30 hover:bg-white/[0.06] transition-colors flex items-center gap-1.5">
                <Plus size={11} /> Create new tag
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
