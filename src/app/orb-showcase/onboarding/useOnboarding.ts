"use client";

import { useCallback, useEffect, useState } from 'react';
import type {
  CapabilityGroupStatus,
  OnboardingCategory,
  OnboardingContact,
  OnboardingStage,
} from '@/app/types/onboarding';

interface UseOnboardingResult {
  loading: boolean;
  stage: OnboardingStage | null;
  contacts: OnboardingContact[];
  categories: OnboardingCategory[];
  capabilities: CapabilityGroupStatus | null;
  setStage: (stage: OnboardingStage) => Promise<void>;
  addContact: (contact: { email: string; name?: string; priority?: 0 | 1 }) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  addCategory: (category: { name: string; keywords: string[]; priority: number }) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  completeCapability: (key: string) => Promise<{ alreadyCompleted: boolean } | null>;
  refreshCapabilities: () => Promise<void>;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    console.warn(`Onboarding request to ${url} failed`, error);
    return null;
  }
}

// Centralizes all reads/writes for the hands-free email onboarding data
// (stage, VIP contacts, categories, skills checklist) so the setup wizard
// and the checklist widget stay in sync without duplicating fetch logic.
export function useOnboarding(enabled: boolean): UseOnboardingResult {
  const [loading, setLoading] = useState(true);
  const [stage, setStageState] = useState<OnboardingStage | null>(null);
  const [contacts, setContacts] = useState<OnboardingContact[]>([]);
  const [categories, setCategories] = useState<OnboardingCategory[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityGroupStatus | null>(null);

  const refreshCapabilities = useCallback(async () => {
    const data = await getJson<CapabilityGroupStatus>('/api/capabilities');
    if (data) setCapabilities(data);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [progress, contactsData, categoriesData, capabilitiesData] = await Promise.all([
        getJson<{ stage: OnboardingStage }>('/api/onboarding/progress'),
        getJson<{ contacts: OnboardingContact[] }>('/api/onboarding/contacts'),
        getJson<{ categories: OnboardingCategory[] }>('/api/onboarding/categories'),
        getJson<CapabilityGroupStatus>('/api/capabilities'),
      ]);

      if (cancelled) return;
      if (progress) setStageState(progress.stage);
      if (contactsData) setContacts(contactsData.contacts);
      if (categoriesData) setCategories(categoriesData.categories);
      if (capabilitiesData) setCapabilities(capabilitiesData);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const setStage = useCallback(async (nextStage: OnboardingStage) => {
    const data = await getJson<{ stage: OnboardingStage }>('/api/onboarding/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: nextStage }),
    });
    if (data) setStageState(data.stage);
  }, []);

  const addContact = useCallback(async (contact: { email: string; name?: string; priority?: 0 | 1 }) => {
    const data = await getJson<{ contact: OnboardingContact }>('/api/onboarding/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contact),
    });
    if (!data) return;
    setContacts((prev) => {
      const withoutExisting = prev.filter((c) => c.id !== data.contact.id);
      return [...withoutExisting, data.contact];
    });
  }, []);

  const removeContact = useCallback(async (id: string) => {
    const response = await fetch(`/api/onboarding/contacts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (response.ok) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
    }
  }, []);

  const addCategory = useCallback(async (category: { name: string; keywords: string[]; priority: number }) => {
    const data = await getJson<{ category: OnboardingCategory }>('/api/onboarding/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category),
    });
    if (!data) return;
    setCategories((prev) => {
      const withoutExisting = prev.filter((c) => c.id !== data.category.id);
      return [...withoutExisting, data.category];
    });
  }, []);

  const removeCategory = useCallback(async (id: string) => {
    const response = await fetch(`/api/onboarding/categories?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (response.ok) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }
  }, []);

  const completeCapability = useCallback(async (key: string) => {
    const data = await getJson<{ key: string; alreadyCompleted: boolean }>(
      `/api/capabilities/${encodeURIComponent(key)}/complete`,
      { method: 'POST' },
    );
    if (!data) return null;
    await refreshCapabilities();
    return { alreadyCompleted: data.alreadyCompleted };
  }, [refreshCapabilities]);

  return {
    loading,
    stage,
    contacts,
    categories,
    capabilities,
    setStage,
    addContact,
    removeContact,
    addCategory,
    removeCategory,
    completeCapability,
    refreshCapabilities,
  };
}
