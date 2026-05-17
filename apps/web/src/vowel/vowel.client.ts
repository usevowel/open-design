import { createDirectAdapters, Vowel, type VowelRoute, type VowelVoiceConfig } from '@vowel.to/client';

import { navigate, parseRoute, type Route } from '../router';
import { OPEN_DESIGN_VOWEL_ROUTES } from './open-design-vowel-routes';

const VOWEL_PRIME_ENVIRONMENTS = [
  'local',
  'testing',
  'dev',
  'staging',
  'production',
  'billing-test',
] as const satisfies readonly NonNullable<
  NonNullable<VowelVoiceConfig['vowelPrimeConfig']>['environment']
>[];

type VowelPrimeEnvironment = NonNullable<NonNullable<VowelVoiceConfig['vowelPrimeConfig']>['environment']>;

/** Valid values for NEXT_PUBLIC_VOWEL_PRIME_ENVIRONMENT (subset allowed by vowel-prime). */
function readPublicVowelPrimeEnvironment(): VowelPrimeEnvironment {
  const raw = (process.env.NEXT_PUBLIC_VOWEL_PRIME_ENVIRONMENT ?? 'production').trim().toLowerCase();
  const match = (VOWEL_PRIME_ENVIRONMENTS as readonly string[]).includes(raw)
    ? (raw as VowelPrimeEnvironment)
    : ('production' as const);
  return match;
}

/** Returns a stable string label for {@link Route} used in Vowel context payloads. */
function formatOpenDesignRoute(route: Route): string {
  switch (route.kind) {
    case 'home':
      return `home:${route.view}`;
    case 'marketplace':
      return 'marketplace';
    case 'marketplace-detail':
      return `marketplace-detail:${route.pluginId}`;
    case 'project': {
      const parts = [`project:${route.projectId}`];
      if (route.conversationId) parts.push(`conversation:${route.conversationId}`);
      if (route.fileName) parts.push(`file:${route.fileName}`);
      return parts.join('/');
    }
    default:
      return 'unknown';
  }
}

/**
 * Builds serialized context pushed to Vowel (`updateContext` / `useSyncContext`).
 *
 * @param pathname - Optional pathname override (for tests or SSR-safe reads); defaults to `window.location.pathname` in the browser.
 */
export function buildVowelContext(pathname?: string): Record<string, unknown> {
  if (typeof window === 'undefined' && pathname === undefined) {
    return { route: 'ssr', openDesignRouteSummary: 'unavailable until client' };
  }
  const path = pathname ?? window.location.pathname;
  const parsed = parseRoute(path);
  return {
    app: 'open-design',
    pathname: path,
    openDesignRoute: formatOpenDesignRoute(parsed),
    routeShape: parsed,
  };
}

let currentAppId: string | null = null;
let vowelInstance: Vowel | null = null;

type VowelChangeListener = (client: Vowel | null) => void;
const vowelChangeListeners = new Set<VowelChangeListener>();

/**
 * Applies an HTTP path using Open Design's `pushState` router.
 * Always call {@link navigate} instead of `history.pushState` directly so `useRoute()` stays in sync.
 */
function navigateVowelPath(rawPath: string): void {
  const pathnameOnly = rawPath.split(/[?#]/u)[0] ?? rawPath;
  navigate(parseRoute(pathnameOnly === '' ? '/' : pathnameOnly));
}

/**
 * Creates the hosted Vowel client with navigation wired to `src/router.ts`.
 * Adapters are built inside the factory to avoid circular init with app modules.
 */
function createVowelClient(appId: string): Vowel {
  const routes: VowelRoute[] = [...OPEN_DESIGN_VOWEL_ROUTES];
  const { navigationAdapter } = createDirectAdapters({
    navigate: (path) => {
      navigateVowelPath(path);
    },
    getCurrentPath: () =>
      typeof window === 'undefined' ? '/' : window.location.pathname,
    routes,
    enableAutomation: false,
  });

  const vowel = new Vowel({
    appId,
    navigationAdapter,
    instructions: `You are a helpful voice assistant for Open Design, a local creative workspace for chat, files, plugins, and design systems.

## CRITICAL: Write to App Store, Not DOM
When performing actions, prefer registered tools that change application state. Do not rely on DOM automation unless the user explicitly enabled it (it is disabled here).

## CRITICAL: Always Refer to Context for Information
Before answering questions or taking actions, read the <context> section for the latest route and UI-relevant state.

## CRITICAL: Initial Greeting (First Thing You Say)
When you first speak in a new session, call getOpenDesignState() FIRST. Context may not be synced yet on the first turn; that action returns the current pathname and parsed route.

## Voice Navigation
Use the built-in navigation tools from the navigation adapter to move between top-level areas (home, projects, marketplace, etc.). Do not invent ad-hoc navigation actions.

## Available top-level paths
- / — Home
- /projects — Projects list
- /automations — Tasks / automations
- /plugins — Plugins
- /design-systems — Design systems
- /integrations — Integrations
- /marketplace — Marketplace catalog

## Registered read action
- getOpenDesignState: Returns current pathname and structured route. Call this first for the initial greeting.

Help users move around the app and understand where they are.`,

    routes,
    floatingCursor: { enabled: false },
    borderGlow: {
      enabled: true,
      color: 'rgba(99, 102, 241, 0.5)',
      intensity: 30,
      pulse: true,
    },
    _caption: {
      enabled: true,
      position: 'top-center',
      maxWidth: '600px',
      showRole: true,
      showOnMobile: false,
    },
    voiceConfig: {
      provider: 'vowel-prime',
      vowelPrimeConfig: { environment: readPublicVowelPrimeEnvironment() },
      llmProvider: 'groq',
      model: 'openai/gpt-oss-120b',
      voice: 'Timothy',
      language: 'en-US',
      initialGreetingPrompt: `Welcome the user to Open Design. Briefly mention the current area from context (if any), then ask what they want to do next.`,
    },
    onUserSpeakingChange: (isSpeaking) => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console -- dev-only signal for voice debugging
        console.log(isSpeaking ? '🗣️ User started speaking' : '🔇 User stopped speaking');
      }
    },
    onAIThinkingChange: (isThinking) => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console -- dev-only signal for voice debugging
        console.log(isThinking ? '🧠 AI started thinking' : '💭 AI stopped thinking');
      }
    },
    onAISpeakingChange: (isSpeaking) => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console -- dev-only signal for voice debugging
        console.log(isSpeaking ? '🔊 AI started speaking' : '🔇 AI stopped speaking');
      }
    },
  });

  registerOpenDesignActions(vowel);
  return vowel;
}

function registerOpenDesignActions(vowel: Vowel): void {
  vowel.registerAction(
    'getOpenDesignState',
    {
      description:
        'Get current Open Design pathname and structured route. Call FIRST when starting a new session (initial greeting) because context may not be populated yet.',
      parameters: {},
    },
    async () => {
      const ctx = buildVowelContext();
      return { success: true, ...ctx };
    },
  );
}

/**
 * Initializes the global Vowel client after mount. Safe to call multiple times with the same id (no-op).
 * Never invoke at module scope — Next.js env and `window` must be available on the client.
 */
export function setAppId(appId: string): void {
  if (!appId.trim()) return;
  if (currentAppId === appId && vowelInstance) {
    vowelChangeListeners.forEach((listener) => listener(vowelInstance));
    return;
  }
  try {
    currentAppId = appId.trim();
    vowelInstance = createVowelClient(currentAppId);
    vowelInstance.updateContext(buildVowelContext());
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console -- confirmation for local debugging
      console.log('✅ Vowel client initialized');
    }
    vowelChangeListeners.forEach((listener) => listener(vowelInstance));
  } catch (err) {
    currentAppId = null;
    vowelInstance = null;
    // eslint-disable-next-line no-console -- surfacing optional integration failures
    console.error('[vowel] failed to initialize client', err);
    vowelChangeListeners.forEach((listener) => listener(null));
  }
}

export function getVowel(): Vowel | null {
  return vowelInstance;
}

/**
 * Subscribe to client creation/teardown. Immediately invokes with the current client when present
 * so late subscribers avoid missing a synchronous `setAppId`.
 */
export function subscribeToVowelChanges(listener: VowelChangeListener): () => void {
  vowelChangeListeners.add(listener);
  listener(vowelInstance);
  return () => vowelChangeListeners.delete(listener);
}

export type VowelClientSingleton = Vowel | null;
