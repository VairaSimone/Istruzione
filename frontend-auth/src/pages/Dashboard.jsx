import { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout, changeEmail } = useContext(AuthContext);
  const [nuovaEmail, setNuovaEmail] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');

  if (!user) return null;

  const handleEmailChange = async (e) => {
    e.preventDefault();
    setEmailError('');
    setEmailMessage('');
    try {
      await changeEmail(nuovaEmail);
      setEmailMessage('Email aggiornata con successo!');
      setNuovaEmail('');
    } catch (err) {
      setEmailError(err.response?.data?.message || "Impossibile aggiornare l'email");
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Benvenuto, {user.nome} {user.cognome}!</h1>
      
      <div style={{ border: '1px solid #ccc', padding: '15px', marginTop: '20px', borderRadius: '5px' }}>
        <h3>I tuoi dati di profilo:</h3>
        <p><strong>Email Attuale:</strong> {user.email}</p>
        <p><strong>Ruolo:</strong> {user.ruolo}</p>
        <p><strong>Età:</strong> {user.eta}</p>
        <p><strong>Classe:</strong> {user.classe}</p>
      </div>

      {/* --- SEZIONE CAMBIO EMAIL (PATCH) --- */}
      <div style={{ border: '1px solid #ccc', padding: '15px', marginTop: '20px', borderRadius: '5px' }}>
        <h3>Modifica Email</h3>
        {emailError && <p style={{ color: 'red' }}>{emailError}</p>}
        {emailMessage && <p style={{ color: 'green' }}>{emailMessage}</p>}
        
        <form onSubmit={handleEmailChange} style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="email" 
            placeholder="Nuova email" 
            value={nuovaEmail}
            onChange={(e) => setNuovaEmail(e.target.value)}
            required
            style={{ flex: 1, padding: '8px' }}
          />
          <button type="submit" style={{ padding: '8px 15px' }}>Salva Email</button>
        </form>
      </div>

      <button 
        onClick={logout} 
        style={{ 
          marginTop: '30px', 
          padding: '10px 20px', 
          backgroundColor: '#dc3545', 
          color: 'white', 
          border: 'none', 
          borderRadius: '5px',
          cursor: 'pointer' 
        }}
      >
        Scollegati (Logout)
      </button>
    </div>
  );
}