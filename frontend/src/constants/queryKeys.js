/**
 * Query keys centralizzate per React Query.
 * Usare SEMPRE queste factory invece di array letterali sparsi nei componenti:
 * garantisce invalidazioni cache coerenti e previene typo che romperebbero
 * il refetch automatico dopo le mutation.
 */
export const queryKeys = Object.freeze({
  auth: {
    me: ['auth', 'me'],
  },
  users: {
    all: ['users'],
    list: (filters) => ['users', 'list', filters ?? {}],
  },
});
