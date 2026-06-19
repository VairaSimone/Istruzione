import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ success: false, message: '' });

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setStatus({ success: false, message: 'Token di verifica mancante nell\'URL.' });
        setLoading(false);
        return;
      }

      try {
        // Modifica l'URL in base alla configurazione della tua istanza di Axios
        const response = await axios.post('http://localhost:3000/api/auth/verify-email', { token });
        setStatus({ success: true, message: response.data.message || 'Email verificata con successo!' });
      } catch (error) {
        const errMsg = error.response?.data?.message || 'Token non valido o scaduto.';
        setStatus({ success: false, message: errMsg });
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '30px', textAlign: 'center', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
      <h2>Verifica Account</h2>
      {loading ? (
        <p>Verifica in corso, attendere...</p>
      ) : (
        <div>
          <p style={{ color: status.success ? '#2e7d32' : '#d32f2f', fontWeight: 'bold', fontSize: '16px' }}>
            {status.message}
          </p>
          <div style={{ marginTop: '25px' }}>
            <Link to="/login" style={{ textDecoration: 'none', background: '#e60012', color: '#fff', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold' }}>
              Accedi al tuo Account
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerifyEmail;