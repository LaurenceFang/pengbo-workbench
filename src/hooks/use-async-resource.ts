import { DependencyList, useEffect, useState } from "react";

type AsyncState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reloadToken: number;
};

type AsyncResourceOptions = {
  enabled?: boolean;
};

export function useAsyncResource<T>(
  loader: () => Promise<T>,
  dependencies: DependencyList,
  options: AsyncResourceOptions = {},
) {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: enabled,
    reloadToken: 0,
  });

  useEffect(() => {
    if (!enabled) {
      setState((current) => {
        const loading = current.data === null;
        if (current.error === null && current.loading === loading) {
          return current;
        }

        return {
          ...current,
          error: null,
          loading,
        };
      });
      return;
    }

    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));

    loader()
      .then((data) => {
        if (!cancelled) {
          setState((current) => ({ ...current, data, loading: false, error: null }));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            loading: false,
            error: error instanceof Error ? error.message : "请求失败",
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, ...dependencies, state.reloadToken]);

  return {
    data: state.data,
    error: state.error,
    loading: state.loading,
    reload: () =>
      setState((current) => ({
        ...current,
        reloadToken: current.reloadToken + 1,
      })),
  };
}
