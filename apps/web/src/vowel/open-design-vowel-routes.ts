import type { VowelRoute } from '@vowel.to/client';

/**
 * Voice-navigable paths for Open Design's client-side router (`src/router.ts`).
 * These descriptions are surfaced to the hosted Vowel controller for routing hints.
 */
export const OPEN_DESIGN_VOWEL_ROUTES: readonly VowelRoute[] = [
  { path: '/', description: 'Home landing' },
  { path: '/projects', description: 'Projects list' },
  { path: '/automations', description: 'Tasks / automations' },
  { path: '/plugins', description: 'Plugins browser' },
  { path: '/design-systems', description: 'Design systems' },
  { path: '/integrations', description: 'Integrations' },
  { path: '/marketplace', description: 'Plugin marketplace catalog' },
] as const;
