import { useEffect, useState } from 'react';
import type { DocumentData, Query } from 'firebase/firestore';
import { type FirestoreKit, loadFirestore } from '@/lib/firebase';

export interface LiveState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
}

/** Realtime document listener. `path` null pauses the listener. */
export function useLiveDoc<T>(path: string | null): LiveState<T | null> {
  const [state, setState] = useState<LiveState<T | null>>({ data: undefined, loading: !!path, error: null });
  useEffect(() => {
    if (!path) {
      setState({ data: undefined, loading: false, error: null });
      return;
    }
    let unsub: (() => void) | undefined;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    loadFirestore()
      .then(({ db, doc, onSnapshot }) => {
        if (cancelled) return;
        unsub = onSnapshot(
          doc(db, path),
          (snap) =>
            setState({
              data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null,
              loading: false,
              error: null,
            }),
          (error) => setState({ data: undefined, loading: false, error }),
        );
      })
      .catch((error: Error) => setState({ data: undefined, loading: false, error }));
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [path]);
  return state;
}

/**
 * Realtime query listener. `key` identifies the query (change it to resubscribe); `build` returns null to pause.
 */
export function useLiveQuery<T>(
  key: string | null,
  build: (kit: FirestoreKit) => Query<DocumentData> | null,
): LiveState<T[]> {
  const [state, setState] = useState<LiveState<T[]>>({ data: undefined, loading: !!key, error: null });
  useEffect(() => {
    if (!key) {
      setState({ data: undefined, loading: false, error: null });
      return;
    }
    let unsub: (() => void) | undefined;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    loadFirestore()
      .then((kit) => {
        if (cancelled) return;
        const q = build(kit);
        if (!q) return setState({ data: [], loading: false, error: null });
        unsub = kit.onSnapshot(
          q,
          (snap) =>
            setState({
              data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T),
              loading: false,
              error: null,
            }),
          (error) => setState({ data: undefined, loading: false, error }),
        );
      })
      .catch((error: Error) => setState({ data: undefined, loading: false, error }));
    return () => {
      cancelled = true;
      unsub?.();
    };
    // `build` is intentionally excluded: callers encode its inputs in `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
