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
  invites: {
    all: ['invites'],
    list: (filters) => ['invites', 'list', filters ?? {}],
    validate: (token) => ['invites', 'validate', token],
  },
  teacherRequests: {
    all: ['teacherRequests'],
    list: (filters) => ['teacherRequests', 'list', filters ?? {}],
  },
  quiz: {
    dashboard: ['quiz', 'dashboard'],
    strokeOrder: (alfabeto) => ['quiz', 'strokeOrder', alfabeto],
  },
});
