"use client";

import { useState } from 'react';
import { ONBOARDING_STAGE } from '@/app/types/onboarding';
import type { OnboardingCategory, OnboardingContact, OnboardingStage } from '@/app/types/onboarding';
import SetupWizard from './SetupWizard';
import PrioritiesWizard from './PrioritiesWizard';

interface Props {
  stage: OnboardingStage;
  contacts: OnboardingContact[];
  categories: OnboardingCategory[];
  onAddContact: (contact: { email: string; name?: string; priority?: 0 | 1 }) => Promise<void>;
  onRemoveContact: (id: string) => Promise<void>;
  onAddCategory: (category: { name: string; keywords: string[]; priority: number }) => Promise<void>;
  onRemoveCategory: (id: string) => Promise<void>;
  onSetStage: (stage: OnboardingStage) => Promise<void>;
  onCompleteCapability: (key: string) => Promise<{ alreadyCompleted: boolean } | null>;
}

// Screen-based only (Stages 0-1). Orchestrates Setup -> Priorities, then a
// one-time skippable "graduation" beat into Listening (Stage 2), where the
// rest of the feature continues hands-free.
export function OnboardingWizard(props: Props) {
  const [graduating, setGraduating] = useState(false);

  const handleSetupContinue = () => {
    void props.onSetStage(ONBOARDING_STAGE.Priorities);
  };

  const handlePrioritiesFinish = async () => {
    setGraduating(true);
    await props.onSetStage(ONBOARDING_STAGE.Listening);
    await props.onCompleteCapability('email.setup_priorities');
  };

  if (graduating) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-cyan-400/30 bg-slate-950/95 p-8 text-center shadow-[0_30px_60px_rgba(8,47,73,0.45)] backdrop-blur-md">
        <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-cyan-400/60 via-sky-400/40 to-purple-400/50 shadow-[0_0_40px_rgba(56,189,248,0.5)] animate-[graduation-pulse_1.6s_ease-in-out_infinite]" />
        <h2 className="mt-5 text-lg font-semibold text-cyan-100">You&apos;re set up.</h2>
        <p className="mt-2 text-sm text-slate-300/80">
          Next time you connect, I&apos;ll start reading your inbox out loud — priority people first. Try it
          somewhere low-stakes at first, and tell me when I get something wrong.
        </p>
        <button
          type="button"
          onClick={() => setGraduating(false)}
          className="mt-6 rounded-full border border-slate-200/20 bg-slate-800/60 px-5 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
        >
          Got it
        </button>
        <style jsx>{`
          @keyframes graduation-pulse {
            0%, 100% { transform: scale(1); opacity: 0.85; }
            50% { transform: scale(1.12); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  if (props.stage === ONBOARDING_STAGE.Setup) {
    return (
      <SetupWizard
        contacts={props.contacts}
        onAddContact={props.onAddContact}
        onRemoveContact={props.onRemoveContact}
        onContinue={handleSetupContinue}
      />
    );
  }

  if (props.stage === ONBOARDING_STAGE.Priorities) {
    return (
      <PrioritiesWizard
        categories={props.categories}
        onAddCategory={props.onAddCategory}
        onRemoveCategory={props.onRemoveCategory}
        onFinish={handlePrioritiesFinish}
      />
    );
  }

  return null;
}

export default OnboardingWizard;
