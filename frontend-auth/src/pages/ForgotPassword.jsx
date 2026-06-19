import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function ForgotPassword() {
  const { forgotPassword } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [debugToken, setDebugToken] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setDebugToken('');
    try {
      const res = await forgotPassword(email);
      setMessage(res.message);
      // Se siamo in ambiente di sviluppo, il backend sputa il token in risposta
      if (res._debug_token) {
        setDebugToken(res._debug_token);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Errore durante l'operazione");
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto' }}>
      <h2>Recupera Password</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '10px' }}>
          <label>Inserisci la tua email</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        <button type="submit" style={{ width: '100%', padding: '10px' }}>Invia istruzioni</button>
      </form>

      {debugToken && (
        <div style={{ marginTop: '20px', padding: '10px', background: '#eee', border: '1px dashed red' }}>
          <p style={{ color: 'red', margin: 0 }}><strong>🛠️ DEBUG MODE (Token intercettato):</strong></p>
          <code style={{ wordBreak: 'break-all' }}>{debugToken}</code>
          <p style={{ fontSize: '12px', marginTop: '5px' }}>
            <Link to={`/reset-password?token=${debugToken}`}>Clicca qui per usare direttamente questo token</Link>
          </p>
        </div>
      )}

      <p style={{ marginTop: '15px' }}><Link to="/login">Torna al Login</Link></p>
    </div>
  );
}