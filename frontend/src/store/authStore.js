import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Store di autenticazione.
 *
 * NOTA IMPORTANTE SULLA PERSISTENZA:
 * Questo store NON persiste su localStorage/sessionStorage. Il backend usa
 * cookie httpOnly per access_token e refresh_token, quindi il JS del
 * frontend non può né deve leggerli o scriverli.
 *
 * La "persistenza della sessione" tra refresh di pagina è delegata al
 * cookie stesso: ad ogni avvio dell'app, `App.jsx` chiama `GET /me`
 * (vedi useCurrentUser) per ricostruire lo stato `user` da zero.
 *
 * Il middleware `devtools` è abilitato SOLO in sviluppo per non esporre
 * lo stato (incluso `user`) ai Redux DevTools in produzione.
 */
const storeCreator = (set) => ({
  user: null,
  isAuthChecked: false, // true dopo il primo tentativo di GET /me al boot dell'app

  setUser: (user) => set({ user, isAuthChecked: true }, false, 'auth/setUser'),

  clearUser: () => set({ user: null, isAuthChecked: true }, false, 'auth/clearUser'),
});

export const useAuthStore = create(
  import.meta.env.DEV ? devtools(storeCreator, { name: 'auth-store' }) : storeCreator
);

/** Selettori comodi per evitare ricalcoli/derivazioni ripetute nei componenti */
export const selectIsAuthenticated = (state) => Boolean(state.user);
export const selectIsTeacher = (state) => state.user?.ruolo === 'insegnante';