import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    nome: '', cognome: '', eta: '', email: '', password: '', classe: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      // Cast età a numero
      const dataToSend = { ...formData, eta: Number(formData.eta) };
      await register(dataToSend);
      setSuccess('Registrazione completata! Verrai reindirizzato al login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Errore durante la registrazione");
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto' }}>
      <h2>Registrati</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}
      
      <form onSubmit={handleSubmit}>
        <input name="nome" placeholder="Nome" onChange={handleChange} required style={inputStyle} />
        <input name="cognome" placeholder="Cognome" onChange={handleChange} required style={inputStyle} />
        <input name="eta" type="number" placeholder="Età" onChange={handleChange} required style={inputStyle} />
        <input name="classe" placeholder="Classe (es. Quarta)" onChange={handleChange} required style={inputStyle} />
        <input name="email" type="email" placeholder="Email" onChange={handleChange} required style={inputStyle} />
        <input name="password" type="password" placeholder="Password (min 8 car.)" onChange={handleChange} required style={inputStyle} />
        <button type="submit" style={{ width: '100%', padding: '10px' }}>Registrati</button>
      </form>
      <p>Hai già un account? <Link to="/login">Accedi</Link></p>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '8px', marginBottom: '10px', boxSizing: 'border-box' };