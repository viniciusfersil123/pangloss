import { useEffect, useState } from 'react';

function App() {
  const [words, setWords] = useState([]);
  const [form, setForm] = useState({ word: '' });
  const [loading, setLoading] = useState(false);

  // Buscar todas as palavras do backend
  const fetchWords = async () => {
    setLoading(true);
    const res = await fetch('http://localhost:5000/words');
    const data = await res.json();
    setWords(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchWords();
  }, []);

  // Lidar com mudanças no formulário
  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Lidar com envio do formulário
  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.word) return;
    await fetch('http://localhost:5000/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ word: '' });
    fetchWords();
  };

  // Remover palavra
  const handleDelete = async id => {
    await fetch(`http://localhost:5000/words/${id}`, {
      method: 'DELETE',
    });
    fetchWords();
  };

  // Hilfsfunktion: Gibt true zurück, wenn das Datum in dieser Woche liegt
  function isThisWeek(date) {
    const now = new Date();
    const input = new Date(date);
    // Set to Monday
    const firstDayOfWeek = new Date(now);
    firstDayOfWeek.setDate(now.getDate() - now.getDay() + 1);
    firstDayOfWeek.setHours(0, 0, 0, 0);
    // Set to next Monday
    const nextWeek = new Date(firstDayOfWeek);
    nextWeek.setDate(firstDayOfWeek.getDate() + 7);
    return input >= firstDayOfWeek && input < nextWeek;
  }

  const learnedThisWeek = words.filter(w => w.createdAt && isThisWeek(w.createdAt)).length;

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 24, background: '#f9f9f9', borderRadius: 12 }}>
      <h1 style={{ textAlign: 'center', marginBottom: 24 }}>Vinícius Wortschatz</h1>
      <form onSubmit={handleSubmit} style={{ marginBottom: 32 }}>
        <input
          name="word"
          placeholder="Wort"
          value={form.word}
          onChange={handleChange}
          style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid #ccc' }}
        />
        <button
          type="submit"
          style={{
            width: '100%',
            padding: 10,
            background: '#205c20',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Hinzufügen
        </button>
      </form>
      <h2 style={{ marginBottom: 12 }}>
        Gespeicherte Wörter
      </h2>
      <p style={{ marginBottom: 16, color: '#205c20', fontWeight: 'bold' }}>
        Gelernte Wörter diese Woche: {learnedThisWeek}
      </p>
      {loading ? (
        <p>Lade...</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {words.map(w => (
            <li
              key={w._id}
              style={{
                background: '#fff',
                marginBottom: 8,
                padding: 12,
                borderRadius: 6,
                border: '1px solid #eee',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>
                <strong>{w.word}</strong>
                {w.createdAt && (
                  <span style={{ color: '#888', marginLeft: 12, fontSize: 13 }}>
                    Hinzugefügt am {new Date(w.createdAt).toLocaleDateString()}
                  </span>
                )}
              </span>
              <button
                onClick={() => handleDelete(w._id)}
                style={{
                  marginLeft: 16,
                  background: 'transparent',
                  border: 'none',
                  color: '#d32f2f',
                  fontWeight: 'bold',
                  fontSize: 18,
                  cursor: 'pointer'
                }}
                title="Entfernen"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
