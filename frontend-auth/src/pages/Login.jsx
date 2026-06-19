import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
      setError('Il tuo indirizzo email non è ancora stato verificato. Controlla la tua casella di posta per attivare l\'account prima di accedere.');
    } else {
      setError(err.response?.data?.message || 'Credenziali non valide.');
    }
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto' }}>
      <h2>Accedi</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '10px' }}>
          <label>Email</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>Password</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <button type="submit" style={{ width: '100%', padding: '10px' }}>Login</button>
      <p style={{ fontSize: '14px', marginTop: '10px' }}>
  <Link to="/forgot-password">Hai dimenticato la password?</Link>
</p>
      </form>
      <p>Non hai un account? <Link to="/register">Registrati</Link></p>
    </div>
  );
}