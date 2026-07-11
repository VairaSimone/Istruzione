import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import RouteFallback from '../shared/RouteFallback';
import styles from './AppLayout.module.css';

/**
 * Layout radice condiviso da TUTTE le pagine (pubbliche e protette).
 * Le pagine protette sono ulteriormente avvolte da ProtectedRoute, che
 * gestisce solo il controllo di autenticazione/autorizzazione, non il
 * layout visivo — separazione delle responsabilità.
 *
 * Le pagine sono caricate in modo LAZY (code splitting nel router): un unico
 * confine <Suspense> qui intorno all'<Outlet> copre tutte le route figlie,
 * mostrando il fallback nella sola area contenuti mentre lo Header e il Footer
 * dello shell restano visibili.
 */
const AppLayout = () => {
  return (
    <div className={styles.shell}>
      <Header />
      <main className={styles.main}>
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
};

export default AppLayout;
