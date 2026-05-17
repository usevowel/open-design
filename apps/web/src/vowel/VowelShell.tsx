'use client';

import '@vowel.to/client/css';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { VowelAgent, VowelProvider, useSyncContext } from '@vowel.to/client/react';

import {
  buildVowelContext,
  getVowel,
  setAppId,
  subscribeToVowelChanges,
  type VowelClientSingleton,
} from './vowel.client';

/** Reads the hosted Vowel identifier that Next inlines for the browser bundle. */
function readPublicVowelAppId(): string {
  const raw = process.env.NEXT_PUBLIC_VOWEL_APP_ID ?? '';
  return raw.trim();
}

/** Mirrors Open Design's pushState router into hosted context updates. */
function VowelRouterContextSync(): null {
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/',
  );

  useEffect(() => {
    const sync = (): void => {
      setPathname(window.location.pathname);
    };
    window.addEventListener('popstate', sync);
    sync();
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const contextPayload = useMemo(() => buildVowelContext(pathname), [pathname]);
  useSyncContext(contextPayload);

  return null;
}

export type VowelShellProps = {
  /** Primary SPA subtree (typically the dynamic `App` export from `src/App.tsx`). */
  children: ReactNode;
};

/**
 * Hosted Vowel bootstrap for `apps/web`.
 *
 * - Defers `setAppId` until after mount so hosted tokens and `window` are valid.
 * - Uses `createDirectAdapters` wired to `src/router.ts` (not Next.js App Router navigation).
 * - Keeps automation off and mirrors the vowel-react defaults (captions + initial greeting prompt).
 * - **Does not block** the Open Design shell: `VowelProvider` accepts a `null` client until the
 *   singleton finishes constructing.
 */
export function VowelShell({ children }: VowelShellProps): ReactNode {
  const hostedAppId = readPublicVowelAppId();
  const needsHostedVowel = hostedAppId.length > 0;
  const [hostedClient, setHostedClient] = useState<VowelClientSingleton>(() =>
    needsHostedVowel ? getVowel() : null,
  );

  useEffect(() => {
    if (!needsHostedVowel) return;
    try {
      setAppId(hostedAppId);
    } catch (error) {
      // eslint-disable-next-line no-console -- optional integration diagnostics
      console.error('[vowel] hosted client initialization failed', error);
    }
  }, [hostedAppId, needsHostedVowel]);

  useEffect(() => {
    if (!needsHostedVowel) return;
    return subscribeToVowelChanges(setHostedClient);
  }, [needsHostedVowel]);

  if (!needsHostedVowel) {
    return <>{children}</>;
  }

  return (
    <VowelProvider client={hostedClient} floatingCursor={false}>
      {hostedClient ? (
        <>
          <VowelRouterContextSync />
          <VowelAgent position="bottom-right" enableFloatingCursor={false} />
        </>
      ) : null}
      {children}
    </VowelProvider>
  );
}
