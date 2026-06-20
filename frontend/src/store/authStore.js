import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Store di autenticazione.
 *
 * NOTA IMPORTANTE SULLA PERSISTENZA:
 * Questo store NON persiste su localStorage/sessionStorage. Il backend usa
 * cookie httpOnly per access_token e refresh_token (vedi doc, sezione 3),
 * quindi il JS del frontend non può né deve leggerli o scriverli — è una
 * scelta di sicurezza del backend che il frontend rispetta.
 *
 * La "persistenza della sessione" tra refresh di pagina è quindi delegata
 * al cookie stesso: ad ogni avvio dell'app, `App.jsx` chiama `GET /me`
 * (vedi useCurrentUser) per ricostruire lo stato `user` da zero. Questo
 * store tiene solo una cache in-memory del risultato per evitare prop drilling.
 */
export const useAuthStore = create(
  devtools(
    (set) => ({
      user: null,
      isAuthChecked: false, // true dopo il primo tentativo di GET /me al boot dell'app

      setUser: (user) => set({ user, isAuthChecked: true }, false, 'auth/setUser'),

      clearUser: () => set({ user: null, isAuthChecked: true }, false, 'auth/clearUser'),
    }),
    { name: 'auth-store' }
  )
);

/** Selettori comodi per evitare ricalcoli/derivazioni ripetute nei componenti */
export const selectIsAuthenticated = (state) => Boolean(state.user);
export const selectIsTeacher = (state) => state.user?.ruolo === 'insegnante';
