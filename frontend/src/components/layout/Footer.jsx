import styles from './Footer.module.css';

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span>
          {import.meta.env.VITE_APP_NAME} — © {new Date().getFullYear()}
        </span>
      </div>
    </footer>
  );
};

export default Footer;
