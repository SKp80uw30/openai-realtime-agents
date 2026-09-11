"use client";

import { useEffect, useRef, useState } from 'react';
import type { OnboardingContact } from '@/app/types/onboarding';

interface Props {
  contacts: OnboardingContact[];
  onAddContact: (contact: { email: string; name?: string; priority?: 0 | 1 }) => Promise<void>;
  onRemoveContact: (id: string) => Promise<void>;
  onContinue: () => void;
}

// Stage 0 — "Meet & Greet." Orby learns who the user's VIPs are before it
// ever reads them an email. Screen-based by design: this happens before
// the user is expected to be driving.
export function SetupWizard({ contacts, onAddContact, onRemoveContact, onContinue }: Props) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const knownIds = useRef<Set<string>>(new Set(contacts.map((c) => c.id)));

  useEffect(() => {
    const newContact = contacts.find((c) => !knownIds.current.has(c.id));
    if (newContact) setJustAddedId(newContact.id);
    knownIds.current = new Set(contacts.map((c) => c.id));
  }, [contacts]);

  const handleAdd = async () => {
    if (!email.includes('@') || submitting) return;
    setSubmitting(true);
    await onAddContact({ email: email.trim(), name: name.trim() || undefined, priority: 1 });
    setEmail('');
    setName('');
    setSubmitting(false);
  };

  return (
    <div className="w-full max-w-lg rounded-2xl border border-cyan-400/20 bg-slate-950/95 p-6 shadow-[0_30px_60px_rgba(8,47,73,0.45)] backdrop-blur-md">
      <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Handsfree Email · Setup</p>
      <h2 className="mt-2 text-xl font-semibold text-cyan-100">Hi — I&apos;m Orby.</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-300/80">
        Before I start reading your mail out loud, I want to know who&apos;s actually important. Not everyone in
        your inbox — just your people. Who would you want me to interrupt you for?
      </p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          className="w-full rounded-lg border border-slate-200/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/50 focus:outline-none sm:w-1/3"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="their@email.com"
          className="w-full flex-1 rounded-lg border border-slate-200/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/50 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!email.includes('@') || submitting}
          className="rounded-lg border border-cyan-300/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {contacts.length > 0 && (
        <ul className="mt-4 space-y-2">
          {contacts.map((contact) => (
            <li
              key={contact.id}
              className={`flex items-center justify-between rounded-lg border border-slate-200/10 bg-slate-800/40 px-3 py-2 transition ${
                justAddedId === contact.id ? 'animate-[vip-dock_0.5s_ease-out]' : ''
              }`}
              onAnimationEnd={() => setJustAddedId(null)}
            >
              <span className="flex items-center gap-2 text-sm text-slate-100">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-500/20 text-[0.65rem] font-semibold uppercase text-cyan-100">
                  {(contact.name || contact.email).slice(0, 1)}
                </span>
                {contact.name || contact.email}
                {contact.name && <span className="text-xs text-slate-400">{contact.email}</span>}
              </span>
              <button
                type="button"
                onClick={() => onRemoveContact(contact.id)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-slate-400/80">
        Add a couple of people — your boss, your partner, that one client who never stops emailing. You can always
        add more later.
      </p>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          disabled={contacts.length === 0}
          className="rounded-full border border-cyan-300/40 bg-gradient-to-r from-cyan-500/20 via-sky-500/20 to-purple-500/20 px-6 py-2 text-sm font-semibold text-white hover:border-cyan-200/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next: Priorities
        </button>
      </div>

      <style jsx>{`
        @keyframes vip-dock {
          0% {
            transform: scale(0.85) translateY(-6px);
            opacity: 0;
          }
          60% {
            transform: scale(1.03) translateY(0);
            opacity: 1;
          }
          100% {
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default SetupWizard;
