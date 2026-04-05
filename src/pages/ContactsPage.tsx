import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { Plus, Mail, Phone, ExternalLink, Calendar, CheckSquare, X } from 'lucide-react';

export default function ContactsPage() {
  const { contacts, projects, tasks, addContact } = useStore();
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
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showNew) nameRef.current?.focus();
  }, [showNew]);

  const handleAddContact = () => {
    if (!newName.trim()) { setShowNew(false); return; }
    addContact({ name: newName.trim(), email: newEmail.trim() || undefined, projectIds: [], notes: '' });
    setNewName('');
    setNewEmail('');
    setShowNew(false);
  };

  const filtered = contacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const activeContact = contacts.find((c) => c.id === selected);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* List */}
      <div className="w-72 border-r border-white/[0.06] flex flex-col">
        <div className="px-4 py-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white/80">Contacts</h2>
            <button
              onClick={() => setShowNew(true)}
              className="p-1 rounded text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
          {showNew && (
            <div className="mb-3 p-3 bg-white/[0.04] border border-white/[0.08] rounded-xl space-y-2">
              <input
                ref={nameRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddContact();
                  if (e.key === 'Escape') { setShowNew(false); setNewName(''); setNewEmail(''); }
                }}
                placeholder="Name"
                className="w-full bg-transparent text-sm text-white/80 placeholder-white/25 focus:outline-none border-b border-white/[0.06] pb-1.5"
              />
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddContact();
                  if (e.key === 'Escape') { setShowNew(false); setNewName(''); setNewEmail(''); }
                }}
                placeholder="Email (optional)"
                className="w-full bg-transparent text-sm text-white/60 placeholder-white/20 focus:outline-none"
              />
              <div className="flex items-center gap-1.5 pt-0.5">
                <button onClick={handleAddContact} className="flex-1 py-1 bg-brand-600 hover:bg-brand-500 text-white text-xs rounded-lg transition-colors">Add Contact</button>
                <button onClick={() => { setShowNew(false); setNewName(''); setNewEmail(''); }} className="p-1 text-white/30 hover:text-white/60 transition-colors"><X size={13} /></button>
              </div>
            </div>
          )}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/80 placeholder-white/20 focus:outline-none"
          />
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide py-2 px-2">
          {filtered.map((contact) => (
            <button
              key={contact.id}
              onClick={() => setSelected(contact.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${selected === contact.id ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}`}
            >
              <div className="w-8 h-8 rounded-full bg-brand-600/30 flex items-center justify-center text-sm font-semibold text-brand-300 flex-shrink-0">
                {contact.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80 truncate">{contact.name}</p>
                {contact.email && <p className="text-xs text-white/30 truncate">{contact.email}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 min-w-0 overflow-y-auto scrollbar-hide">
        {activeContact ? (
          <div className="px-8 py-8">
            {/* Header */}
            <div className="flex items-start gap-4 mb-8">
              <div className="w-16 h-16 rounded-2xl bg-brand-600/30 flex items-center justify-center text-2xl font-semibold text-brand-300">
                {activeContact.name[0]}
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-semibold text-white">{activeContact.name}</h1>
                <div className="flex items-center gap-4 mt-2">
                  {activeContact.email && (
                    <a href={`mailto:${activeContact.email}`} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors">
                      <Mail size={13} />{activeContact.email}
                    </a>
                  )}
                  {activeContact.phone && (
                    <a href={`tel:${activeContact.phone}`} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors">
                      <Phone size={13} />{activeContact.phone}
                    </a>
                  )}
                  {activeContact.bookingLink && (
                    <a href={activeContact.bookingLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 transition-colors">
                      <ExternalLink size={13} />Book time
                    </a>
                  )}
                </div>
                {/* Projects */}
                <div className="flex items-center gap-2 mt-3">
                  {activeContact.projectIds.map((pid) => {
                    const p = projects.find((proj) => proj.id === pid);
                    return p ? (
                      <span key={pid} className="text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: p.color + '40', color: p.color + 'cc' }}>
                        {p.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            </div>

            {/* Notes */}
            {activeContact.notes && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2">Notes</h3>
                <p className="text-sm text-white/60 bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">{activeContact.notes}</p>
              </div>
            )}

            {/* Linked Tasks */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckSquare size={12} /> Tasks
              </h3>
              {activeContact.linkedTaskIds.length === 0 ? (
                <p className="text-sm text-white/20">No linked tasks</p>
              ) : (
                <div className="space-y-1">
                  {activeContact.linkedTaskIds.map((tid) => {
                    const t = tasks.find((task) => task.id === tid);
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

            {/* Meetings */}
            <div>
              <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Calendar size={12} /> Meeting History
              </h3>
              {activeContact.meetings.length === 0 ? (
                <div className="text-sm text-white/20 py-4 text-center">
                  <p>No meetings recorded</p>
                  <button className="mt-2 text-brand-400 hover:text-brand-300 text-sm transition-colors">+ Add Meeting Note</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeContact.meetings.map((m) => (
                    <div key={m.id} className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-white/70">{m.title}</p>
                        <span className="text-xs text-white/30">{m.date}</span>
                      </div>
                      <p className="text-sm text-white/40">{m.notes}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/20">Select a contact</p>
          </div>
        )}
      </div>
    </div>
  );
}
