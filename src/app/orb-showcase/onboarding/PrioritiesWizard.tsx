"use client";

import { useMemo, useState } from 'react';
import type { OnboardingCategory } from '@/app/types/onboarding';

interface Props {
  categories: OnboardingCategory[];
  onAddCategory: (category: { name: string; keywords: string[]; priority: number }) => Promise<void>;
  onRemoveCategory: (id: string) => Promise<void>;
  onFinish: () => void;
}

const SAMPLE_SUBJECTS: { subject: string; matchKeyword: string }[] = [
  { subject: 'Contract renewal — needs your signature', matchKeyword: 'invoice' },
  { subject: 'Weekly team standup notes', matchKeyword: 'project' },
  { subject: "This week's newsletter digest", matchKeyword: 'newsletter' },
  { subject: 'Dinner Friday?', matchKeyword: 'family' },
  { subject: '20% off — today only', matchKeyword: 'newsletter' },
  { subject: 'Q3 budget review attached', matchKeyword: 'invoice' },
];

function sortedByPriority(categories: OnboardingCategory[]): OnboardingCategory[] {
  return [...categories].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
}

// Stage 1 — "Priorities." Defines email categories and their order, then
// shows a live preview so the mental model is felt, not just configured.
export function PrioritiesWizard({ categories, onAddCategory, onRemoveCategory, onFinish }: Props) {
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const ordered = useMemo(() => sortedByPriority(categories), [categories]);

  const handleAdd = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || submitting) return;
    setSubmitting(true);
    const keywordList = keywords
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    const nextPriority = categories.length; // newest starts at the top
    await onAddCategory({ name: trimmedName, keywords: keywordList, priority: nextPriority });
    setName('');
    setKeywords('');
    setSubmitting(false);
  };

  const move = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;
    const a = ordered[index];
    const b = ordered[targetIndex];
    await Promise.all([
      onAddCategory({ name: a.name, keywords: a.keywords, priority: b.priority }),
      onAddCategory({ name: b.name, keywords: b.keywords, priority: a.priority }),
    ]);
  };

  const preview = useMemo(() => {
    return SAMPLE_SUBJECTS.map((item) => {
      const match = ordered.find((c) => c.keywords.includes(item.matchKeyword));
      return {
        ...item,
        categoryName: match?.name ?? 'General',
        priority: match?.priority ?? -1,
      };
    }).sort((a, b) => b.priority - a.priority);
  }, [ordered]);

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-cyan-400/20 bg-slate-950/95 p-6 shadow-[0_30px_60px_rgba(8,47,73,0.45)] backdrop-blur-md">
      <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Handsfree Email · Priorities</p>
      <h2 className="mt-2 text-xl font-semibold text-cyan-100">What&apos;s worth interrupting you for?</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-300/80">
        Quick gut check — when you picture your inbox, what are the buckets? Work, newsletters, family, whatever
        fits. Nothing fancy, and I&apos;ll get some wrong at first — just tell me when I do.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name (e.g. Work)"
              className="rounded-lg border border-slate-200/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/50 focus:outline-none"
            />
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Keywords, comma separated (e.g. invoice, project)"
              className="rounded-lg border border-slate-200/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!name.trim() || submitting}
              className="self-start rounded-lg border border-cyan-300/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add category
            </button>
          </div>

          <ul className="mt-4 space-y-2">
            {ordered.map((category, index) => (
              <li
                key={category.id}
                className="flex items-center justify-between rounded-lg border border-slate-200/10 bg-slate-800/40 px-3 py-2"
              >
                <span className="text-sm text-slate-100">
                  {category.name}
                  {category.keywords.length > 0 && (
                    <span className="ml-2 text-xs text-slate-400">{category.keywords.join(', ')}</span>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="rounded border border-slate-200/20 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === ordered.length - 1}
                    className="rounded border border-slate-200/20 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveCategory(category.id)}
                    className="ml-1 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200/10 bg-slate-900/50 p-3">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Priority map preview</p>
          <p className="mt-1 text-[0.7rem] text-slate-500">Sample inbox, sorted your way — for real, next time.</p>
          <ul className="mt-3 space-y-1.5 transition-all">
            {preview.map((item) => (
              <li
                key={item.subject}
                className="flex items-center justify-between rounded-md bg-slate-800/40 px-2 py-1.5 text-xs transition-all duration-300"
              >
                <span className="truncate text-slate-200">{item.subject}</span>
                <span className="ml-2 shrink-0 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-cyan-200">
                  {item.categoryName}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onFinish}
          disabled={categories.length === 0}
          className="rounded-full border border-cyan-300/40 bg-gradient-to-r from-cyan-500/20 via-sky-500/20 to-purple-500/20 px-6 py-2 text-sm font-semibold text-white hover:border-cyan-200/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ready to see how I do
        </button>
      </div>
    </div>
  );
}

export default PrioritiesWizard;
