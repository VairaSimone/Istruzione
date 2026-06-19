import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function ResetPassword() {
  const { resetPassword } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [token, setToken] = useState(searchParams.get('token') || '');
  const [nuovaPassword, setNuovaPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await resetPassword(token, nuovaPassword);
      setSuccess('Password aggiornata con successo! Ora verrai reindirizzato al login...');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || "Token non valido o scaduto");
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto' }}>
      <h2>Imposta Nuova Password</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '10px' }}>
          <label>Token di Reset</label>
          <input 
            type="text" 
            value={token} 
            onChange={(e) => setToken(e.target.value)} 
            required 
            placeholder="Incolla il token qui"
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>Nuova Password</label>
          <input 
            type="password" 
            value={nuovaPassword} 
            onChange={(e) => setNuovaPassword(e.target.value)} 
            required 
            placeholder="Minimo 8 caratteri"
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        <button type="submit" style={{ width: '100%', padding: '10px' }}>Aggiorna Password</button>
      </form>
    </div>
  );
}