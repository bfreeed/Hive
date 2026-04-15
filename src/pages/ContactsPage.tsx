import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { RelationshipTag } from '../types';
import { Plus, Mail, Phone, ExternalLink, Calendar, CheckSquare, X, Building2, MapPin, Cake, Tag, ChevronDown, Trash2, Search, Clock, ArrowLeft } from 'lucide-react';
import NewContactModal from '../components/NewContactModal';

const TAG_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16'];

// ---------------------------------------------------------------------------
// Inline editable field
// ---------------------------------------------------------------------------
function EditableField({ value, placeholder, onSave, icon, type = 'text', linkPrefix }: {
  value?: string; placeholder: string; onSave: (v: string) => void; icon?: React.ReactNode; type?: string; linkPrefix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(value ?? ''); }, [value]);

  const commit = () => { setEditing(false); if (draft.trim() !== (value ?? '')) onSave(draft.trim()); };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        {icon && <span className="text-white/20 flex-shrink-0">{icon}</span>}
        <input ref={ref} type={type} value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); } }}
          className="flex-1 bg-white/[0.06] border border-white/[0.12] rounded-lg px-2.5 py-1.5 text-sm text-white/80 focus:outline-none focus:border-brand-500/40" />
      </div>
    );
  }

  const display = value || placeholder;
  const isEmpty = !value;
  const content = (
    <span className={`text-sm ${isEmpty ? 'text-white/20 italic' : 'text-white/60'}`}>{display}</span>
  );

  return (
    <button onClick={() => setEditing(true)} className="flex items-center gap-2 w-full text-left group hover:bg-white/[0.03] rounded-lg px-1 py-1 -mx-1 transition-colors">
      {icon && <span className="text-white/20 flex-shrink-0">{icon}</span>}
      {linkPrefix && value ? (
        <a href={`${linkPrefix}${value}`} className="text-sm text-white/60 hover:text-white/80 transition-colors" onClick={e => e.stopPropagation()}>{value}</a>
      ) : content}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Relationship Tag Picker
// ---------------------------------------------------------------------------
function RelationshipTagPicker({ selectedIds, onToggle, onCreate }: {
  selectedIds: string[]; onToggle: (id: string) => void; onCreate: (name: string, color: string) => void;
}) {
  const { userSettings } = useStore();
  const tags = userSettings?.relationshipTags ?? [];
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const dropRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const mouseHandler = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) { setOpen(false); setCreating(false); setSearch(''); } };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setCreating(false); setSearch(''); } };
    document.addEventListener('mousedown', mouseHandler);
    document.addEventListener('keydown', keyHandler);
    return () => { document.removeEventListener('mousedown', mouseHandler); document.removeEventListener('keydown', keyHandler); };
  }, []);

  const filtered = tags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const selectedTags = tags.filter(t => selectedIds.includes(t.id));

  return (
    <div className="relative" ref={dropRef}>
      <div className="flex items-center gap-2">
        <span className="text-white/20 flex-shrink-0"><Tag size={14} /></span>
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-h-[28px]">
          {selectedTags.map(t => (
            <span key={t.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: t.color + '20', color: t.color }}>
              {t.name}
              <button onClick={() => onToggle(t.id)} className="hover:opacity-70"><X size={10} /></button>
            </span>
          ))}
          <button onClick={() => setOpen(!open)} className="text-xs text-white/20 hover:text-white/40 transition-colors flex items-center gap-0.5">
            <Plus size={12} /> Add
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute z-50 top-full left-6 mt-1 w-64 bg-[#1a1a2e] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-white/[0.06]">
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Select an option or create one"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white/80 placeholder-white/25 focus:outline-none" />
          </div>
          <div className="max-h-48 overflow-y-auto scrollbar-hide py-1">
            {filtered.map(t => {
              const isSelected = selectedIds.includes(t.id);
              return (
                <button key={t.id} onClick={() => onToggle(t.id)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-white/[0.06] transition-colors ${isSelected ? 'bg-white/[0.04]' : ''}`}>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: t.color + '20', color: t.color }}>{t.name}</span>
                  {isSelected && <span className="ml-auto text-brand-400 text-xs">&#10003;</span>}
                </button>
              );
            })}
            {search && !filtered.length && !creating && (
              <button onClick={() => { setCreating(true); setNewName(search); }}
                className="w-full px-3 py-2 text-left text-xs text-white/40 hover:bg-white/[0.06] transition-colors">
                Create "{search}"
              </button>
            )}
          </div>
          {!creating && (
            <button onClick={() => setCreating(true)}
              className="w-full px-3 py-2 text-left text-xs text-white/30 hover:bg-white/[0.06] transition-colors border-t border-white/[0.06] flex items-center gap-1.5">
              <Plus size={11} /> Create new tag
            </button>
          )}
          {creating && (
            <div className="p-2.5 border-t border-white/[0.06] space-y-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Tag name" autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { onCreate(newName.trim(), newColor); setNewName(''); setCreating(false); setSearch(''); } if (e.key === 'Escape') setCreating(false); }}
                className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white/80 placeholder-white/25 focus:outline-none" />
              <div className="flex items-center gap-1">
                {TAG_COLORS.map(c => (
                  <button key={c} onClick={() => setNewColor(c)}
                    className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}>
                    {newColor === c && <span className="text-white text-[8px]">&#10003;</span>}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => { if (newName.trim()) { onCreate(newName.trim(), newColor); setNewName(''); setCreating(false); setSearch(''); } }}
                  className="flex-1 py-1 bg-brand-600 hover:bg-brand-500 text-white text-xs rounded-lg transition-colors">Create</button>
                <button onClick={() => setCreating(false)} className="p-1 text-white/30 hover:text-white/60 transition-colors"><X size={12} /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project Picker
// ---------------------------------------------------------------------------
function ProjectPicker({ selectedIds, onToggle }: { selectedIds: string[]; onToggle: (id: string) => void }) {
  const { projects } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mouseHandler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', mouseHandler);
    document.addEventListener('keydown', keyHandler);
    return () => { document.removeEventListener('mousedown', mouseHandler); document.removeEventListener('keydown', keyHandler); };
  }, []);

  const selected = projects.filter(p => selectedIds.includes(p.id));

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2 flex-wrap">
        {selected.map(p => (
          <span key={p.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: p.color + '40', color: p.color + 'cc' }}>
            {p.name}
            <button onClick={() => onToggle(p.id)} className="hover:opacity-70"><X size={10} /></button>
          </span>
        ))}
        <button onClick={() => setOpen(!open)} className="text-xs text-white/20 hover:text-white/40 transition-colors flex items-center gap-0.5">
          <Plus size={12} /> Project
        </button>
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-52 bg-[#1a1a2e] border border-white/[0.1] rounded-xl shadow-2xl max-h-48 overflow-y-auto scrollbar-hide py-1">
          {projects.map(p => {
            const isSelected = selectedIds.includes(p.id);
            return (
              <button key={p.id} onClick={() => onToggle(p.id)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-white/[0.06] transition-colors ${isSelected ? 'bg-white/[0.04]' : ''}`}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-xs text-white/60 truncate">{p.name}</span>
                {isSelected && <span className="ml-auto text-brand-400 text-xs">&#10003;</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editable Notes
// ---------------------------------------------------------------------------
function EditableNotes({ value, onSave }: { value?: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);
  useEffect(() => { setDraft(value ?? ''); }, [value]);

  const commit = () => { setEditing(false); if (draft.trim() !== (value ?? '')) onSave(draft.trim()); };

  if (editing) {
    return (
      <textarea ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={e => { if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); } }}
        rows={4} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-3 text-sm text-white/70 placeholder-white/20 focus:outline-none focus:border-brand-500/40 resize-none" placeholder="Add notes..." />
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="w-full text-left">
      {value ? (
        <p className="text-sm text-white/50 bg-white/[0.03] rounded-xl p-4 border border-white/[0.06] hover:border-white/[0.1] transition-colors whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-sm text-white/20 italic bg-white/[0.02] rounded-xl p-4 border border-dashed border-white/[0.06] hover:border-white/[0.1] transition-colors">Click to add notes...</p>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main ContactsPage
// ---------------------------------------------------------------------------
export default function ContactsPage() {
  const { contacts, projects, tasks, meetings, addContact, updateContact, deleteContact, userSettings, saveUserSettings } = useStore();
  const [selected, _setSelected] = useState<string | null>(() =>
    localStorage.getItem('hive_contacts_selectedId')
  );
  const setSelected = (id: string | null) => {
    _setSelected(id);
    if (id) localStorage.setItem('hive_contacts_selectedId', id);
    else localStorage.removeItem('hive_contacts_selectedId');
  };
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'firstName' | 'lastName' | 'lastContacted'>('firstName');

  // New contact form state
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newBusiness, setNewBusiness] = useState('');
  const [newBirthday, setNewBirthday] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newProjectIds, setNewProjectIds] = useState<string[]>([]);
  const [newTagIds, setNewTagIds] = useState<string[]>([]);
  const firstNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (showNew) firstNameRef.current?.focus(); }, [showNew]);

  const tags = userSettings?.relationshipTags ?? [];

  // Compute last-contacted dates for all contacts
  const lastContactedMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    contacts.forEach(c => {
      const contactMeetings = meetings.filter(m => m.linkedContactIds?.includes(c.id));
      if (contactMeetings.length) {
        const sorted = contactMeetings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        map[c.id] = sorted[0].date;
      } else {
        map[c.id] = null;
      }
    });
    return map;
  }, [contacts, meetings]);

  const handleAddContact = () => {
    if (!newFirstName.trim()) { setShowNew(false); return; }
    const fullName = `${newFirstName.trim()} ${newLastName.trim()}`.trim();
    addContact({
      firstName: newFirstName.trim(),
      lastName: newLastName.trim(),
      phone: newPhone.trim() || undefined,
      email: newEmail.trim() || undefined,
      business: newBusiness.trim() || undefined,
      birthday: newBirthday.trim() || undefined,
      address: newAddress.trim() || undefined,
      projectIds: newProjectIds,
      notes: '',
    });
    if (newTagIds.length > 0) {
      setTimeout(() => {
        const created = useStore.getState().contacts.find(c => `${c.firstName} ${c.lastName}`.trim() === fullName);
        if (created) useStore.getState().updateContact(created.id, { relationshipTagIds: newTagIds });
      }, 50);
    }
    resetNewForm();
  };

  const resetNewForm = () => { setShowNew(false); setNewFirstName(''); setNewLastName(''); setNewPhone(''); setNewEmail(''); setNewBusiness(''); setNewBirthday(''); setNewAddress(''); setNewProjectIds([]); setNewTagIds([]); };

  const displayName = (c: { firstName: string; lastName: string }) => `${c.firstName} ${c.lastName}`.trim();

  const filtered = contacts
    .filter(c => {
      const q = search.toLowerCase();
      return c.firstName.toLowerCase().includes(q) || c.lastName.toLowerCase().includes(q) || displayName(c).toLowerCase().includes(q) || (c.business ?? '').toLowerCase().includes(q);
    })
    .filter(c => !filterTag || c.relationshipTagIds.includes(filterTag))
    .sort((a, b) => {
      if (sortBy === 'lastContacted') {
        const da = lastContactedMap[a.id]; const db = lastContactedMap[b.id];
        if (!da && !db) return a.firstName.localeCompare(b.firstName);
        if (!da) return 1; if (!db) return -1;
        return new Date(db).getTime() - new Date(da).getTime();
      }
      if (sortBy === 'lastName') return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
      return a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName);
    });

  const activeContact = contacts.find(c => c.id === selected);

  // Meetings for active contact from global store
  const contactMeetings = useMemo(() => {
    if (!activeContact) return [];
    return meetings.filter(m => m.linkedContactIds?.includes(activeContact.id)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [meetings, activeContact]);

  const lastContacted = activeContact ? lastContactedMap[activeContact.id] : null;

  const handleCreateTag = (name: string, color: string) => {
    const id = crypto.randomUUID();
    const newTag: RelationshipTag = { id, name, color };
    const updated = [...tags, newTag];
    saveUserSettings({ relationshipTags: updated });
  };

  const handleToggleTag = (tagId: string) => {
    if (!activeContact) return;
    const current = activeContact.relationshipTagIds;
    const next = current.includes(tagId) ? current.filter(id => id !== tagId) : [...current, tagId];
    updateContact(activeContact.id, { relationshipTagIds: next });
  };

  const handleToggleProject = (projectId: string) => {
    if (!activeContact) return;
    const current = activeContact.projectIds;
    const next = current.includes(projectId) ? current.filter(id => id !== projectId) : [...current, projectId];
    updateContact(activeContact.id, { projectIds: next });
  };

  const handleDelete = () => {
    if (!activeContact) return;
    deleteContact(activeContact.id);
    setSelected(null);
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return d; }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ── Left Panel: Contact List ── */}
      <div className={`w-72 border-r border-white/[0.06] flex flex-col ${selected ? 'hidden md:flex' : 'flex'}`}>
        <div className="px-4 py-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-white">Contacts</h2>
            <button onClick={() => setShowNew(true)} className="p-1 rounded text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"><Plus size={14} /></button>
          </div>

          {showNew && (
            <NewContactModal
              onClose={resetNewForm}
              onCreated={id => setSelected(id)}
            />
          )}

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              className="w-full pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/80 placeholder-white/20 focus:outline-none" />
          </div>

          {/* Filter & Sort */}
          <div className="flex items-center gap-2 mt-2">
            <select value={filterTag ?? ''} onChange={e => setFilterTag(e.target.value || null)}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/50 px-2 py-1 focus:outline-none appearance-none cursor-pointer">
              <option value="">All relationships</option>
              {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as 'firstName' | 'lastName' | 'lastContacted')}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/50 px-2 py-1 focus:outline-none appearance-none cursor-pointer">
              <option value="firstName">First Name</option>
              <option value="lastName">Last Name</option>
              <option value="lastContacted">Recent</option>
            </select>
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide py-2 px-2">
          {filtered.map(contact => {
            const contactTags = tags.filter(t => contact.relationshipTagIds.includes(t.id));
            const lc = lastContactedMap[contact.id];
            return (
              <button key={contact.id} onClick={() => setSelected(contact.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${selected === contact.id ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}`}>
                <div className="w-8 h-8 rounded-full bg-brand-600/30 flex items-center justify-center text-sm font-semibold text-brand-300 flex-shrink-0">
                  {contact.firstName[0] ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/80 truncate">{displayName(contact)}</p>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {contactTags.slice(0, 2).map(t => (
                      <span key={t.id} className="text-[10px] px-1.5 py-0 rounded-full" style={{ backgroundColor: t.color + '18', color: t.color + 'cc' }}>{t.name}</span>
                    ))}
                    {contactTags.length > 2 && <span className="text-[10px] text-white/20">+{contactTags.length - 2}</span>}
                    {lc && <span className="text-[10px] text-white/20 ml-auto">{formatDate(lc)}</span>}
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && <p className="text-sm text-white/20 text-center py-8">No contacts found</p>}
        </div>
      </div>

      {/* ── Right Panel: Contact Detail ── */}
      <div className={`flex-1 min-w-0 overflow-y-auto scrollbar-hide ${!selected ? 'hidden md:block' : 'block'}`}>
        {activeContact ? (
          <div key={activeContact.id} className="px-8 py-8 max-w-2xl animate-fade-in">
            {/* Mobile back button */}
            <button onClick={() => setSelected(null)} className="flex md:hidden items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-4 -ml-1">
              <ArrowLeft size={15} /> Contacts
            </button>
            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-brand-600/30 flex items-center justify-center text-2xl font-semibold text-brand-300">
                {activeContact.firstName[0] ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <EditableField value={activeContact.firstName} placeholder="First name" onSave={v => updateContact(activeContact.id, { firstName: v })} />
                  <EditableField value={activeContact.lastName} placeholder="Last name" onSave={v => updateContact(activeContact.id, { lastName: v })} />
                </div>
                <div className="mt-0.5">
                  <EditableField value={activeContact.business} placeholder="Add business" icon={<Building2 size={14} />}
                    onSave={v => updateContact(activeContact.id, { business: v })} />
                </div>
              </div>
              <button onClick={handleDelete} className="p-1.5 rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete contact">
                <Trash2 size={14} />
              </button>
            </div>

            {/* Contact Info Fields */}
            <div className="space-y-1.5 mb-6">
              <EditableField value={activeContact.phone} placeholder="Add phone" icon={<Phone size={14} />} type="tel" linkPrefix="tel:"
                onSave={v => updateContact(activeContact.id, { phone: v })} />
              <EditableField value={activeContact.email} placeholder="Add email" icon={<Mail size={14} />} type="email" linkPrefix="mailto:"
                onSave={v => updateContact(activeContact.id, { email: v })} />
              <EditableField value={activeContact.birthday} placeholder="Add birthday" icon={<Cake size={14} />} type="date"
                onSave={v => updateContact(activeContact.id, { birthday: v })} />
              <EditableField value={activeContact.address} placeholder="Add address" icon={<MapPin size={14} />}
                onSave={v => updateContact(activeContact.id, { address: v })} />
            </div>

            {/* Relationship Tags */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2">Relationship</h3>
              <RelationshipTagPicker selectedIds={activeContact.relationshipTagIds} onToggle={handleToggleTag} onCreate={handleCreateTag} />
            </div>

            {/* Projects */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2">Projects</h3>
              <ProjectPicker selectedIds={activeContact.projectIds} onToggle={handleToggleProject} />
            </div>

            {/* Last Contacted */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock size={12} /> Last Contacted
              </h3>
              <p className="text-sm text-white/50 pl-1">
                {lastContacted ? formatDate(lastContacted) : 'No meetings recorded'}
              </p>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2">Notes</h3>
              <EditableNotes value={activeContact.notes} onSave={v => updateContact(activeContact.id, { notes: v })} />
            </div>

            {/* Linked Tasks */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckSquare size={12} /> Tasks
              </h3>
              {activeContact.linkedTaskIds.length === 0 ? (
                <p className="text-sm text-white/20">No linked tasks</p>
              ) : (
                <div className="space-y-1">
                  {activeContact.linkedTaskIds.map(tid => {
                    const t = tasks.find(task => task.id === tid);
                    return t ? (
                      <div key={tid} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                        <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'done' ? 'bg-emerald-500' : 'bg-white/30'}`} />
                        <span className="text-sm text-white/60">{t.title}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            {/* Meeting History */}
            <div>
              <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Calendar size={12} /> Meeting History
              </h3>
              {contactMeetings.length === 0 ? (
                <p className="text-sm text-white/20">No meetings recorded</p>
              ) : (
                <div className="space-y-3">
                  {contactMeetings.map(m => (
                    <div key={m.id} className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-white/70">{m.title}</p>
                        <span className="text-xs text-white/30">{formatDate(m.date)}</span>
                      </div>
                      {m.summary && <p className="text-sm text-white/40 line-clamp-3">{m.summary}</p>}
                      {!m.summary && m.notes && <p className="text-sm text-white/40 line-clamp-3">{m.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/20"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div className="text-center">
              <p className="text-sm text-white/30">Select a contact to view details</p>
              <p className="text-xs text-white/15 mt-1">or add a new one with the + button</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
