import { useEffect, useState } from 'react';

function App() {
  const [words, setWords] = useState([]);
  const [form, setForm] = useState({ word: '', translation: '', note: '' });
  const [loading, setLoading] = useState(false);

  // Fetch all words from backend
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

  // Handle form input
  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Handle form submit
  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.word || !form.translation) return;
    await fetch('http://localhost:5000/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ word: '', translation: '', note: '' });
    fetchWords();
  };

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 24, background: '#f9f9f9', borderRadius: 12 }}>
      <h1 style={{ textAlign: 'center', marginBottom: 24 }}>Wörterbuch</h1>
      <form onSubmit={handleSubmit} style={{ marginBottom: 32 }}>
        <input
          name="word"
          placeholder="Wort"
          value={form.word}
          onChange={handleChange}
          style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid #ccc' }}
        />
        <input
          name="translation"
          placeholder="Übersetzung"
          value={form.translation}
          onChange={handleChange}
          style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid #ccc' }}
        />
        <input
          name="note"
          placeholder="Notiz (optional)"
          value={form.note}
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
      <h2 style={{ marginBottom: 12 }}>Gespeicherte Wörter</h2>
      {loading ? (
        <p>Lade...</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {words.map(w => (
            <li key={w._id} style={{ background: '#fff', marginBottom: 8, padding: 12, borderRadius: 6, border: '1px solid #eee' }}>
              <strong>{w.word}</strong> – {w.translation}
              {w.note && <span style={{ color: '#888', marginLeft: 8 }}>({w.note})</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
