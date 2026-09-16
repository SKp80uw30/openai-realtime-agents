import React from 'react';

// One glyph per hands-free email capability, keyed by the Capability.key seeded
// in prisma/seed.js. The rail renders these instead of a text list so the
// "n/7" progress is readable at a glance — and, more importantly, so the user
// can see the *shape* of what hands-free email covers without reading.
//
// Deliberately a lookup with a neutral fallback rather than a required map:
// CapabilityRail stays group-agnostic, so a future `handsfree-calendar` group
// renders as dots until someone adds its glyphs here.

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const CAPABILITY_ICONS: Record<string, React.ReactNode> = {
  // Set up priorities — a starred VIP.
  'email.setup_priorities': (
    <svg {...ICON_PROPS}>
      <path d="m12 3.5 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85z" />
    </svg>
  ),
  // Summarise — condensed lines of text.
  'email.summarize': (
    <svg {...ICON_PROPS}>
      <path d="M4 6h16M4 11h16M4 16h10" />
    </svg>
  ),
  // Mark as read — an opened envelope.
  'email.mark_read': (
    <svg {...ICON_PROPS}>
      <path d="M3 10.5 12 4l9 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19z" />
      <path d="m3 10.5 9 6 9-6" />
    </svg>
  ),
  // Archive — a lidded box.
  'email.archive': (
    <svg {...ICON_PROPS}>
      <rect x="3" y="4" width="18" height="4.5" rx="1.2" />
      <path d="M4.8 8.5V19a1.2 1.2 0 0 0 1.2 1.2h12a1.2 1.2 0 0 0 1.2-1.2V8.5" />
      <path d="M10 12.5h4" />
    </svg>
  ),
  // Draft a reply — a pencil.
  'email.draft': (
    <svg {...ICON_PROPS}>
      <path d="M16.5 3.9a2 2 0 0 1 2.83 2.83L8.6 17.45 4.5 19.5l2.05-4.1z" />
      <path d="m14.7 5.7 3.6 3.6" />
    </svg>
  ),
  // Send — a paper plane.
  'email.send': (
    <svg {...ICON_PROPS}>
      <path d="M20.5 3.5 10.2 13.8" />
      <path d="M20.5 3.5 14 20.5l-3.8-6.7-6.7-3.8z" />
    </svg>
  ),
  // Delete — a bin.
  'email.delete': (
    <svg {...ICON_PROPS}>
      <path d="M4 6.5h16" />
      <path d="M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" />
      <path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5" />
    </svg>
  ),
};

// Neutral stand-in for any capability without a dedicated glyph.
const FALLBACK_ICON = (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="12" r="4.5" />
  </svg>
);

export function getCapabilityIcon(key: string): React.ReactNode {
  return CAPABILITY_ICONS[key] ?? FALLBACK_ICON;
}

export default getCapabilityIcon;
