import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import styles from './AppLayout.module.css';

/**
 * Layout radice condiviso da TUTTE le pagine (pubbliche e protette).
 * Le pagine protette sono ulteriormente avvolte da ProtectedRoute, che
 * gestisce solo il controllo di autenticazione/autorizzazione, non il
 * layout visivo — separazione delle responsabilità.
 */
const AppLayout = () => {
  return (
    <div className={styles.shell}>
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default AppLayout;
