// Skip hire has been removed from scope. This hook is a no-op stub.
// It is kept to avoid import errors in any remaining callers.

export function useSkipOrder(_id: string | undefined) {
  return { order: null, setOrder: (_v: unknown) => {}, loading: false, error: false, reload: () => {} };
}
