import { useEffect, useState } from 'react';

function App() {
  const [words, setWords] = useState([]);
  const [form, setForm] = useState({ word: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [relatedInputs, setRelatedInputs] = useState({});
  const [relatedErrors, setRelatedErrors] = useState({});

  // Buscar todas as palavras do backend
  const fetchWords = async () => {
    setLoading(true);
    const res = await fetch('/words');
    const data = await res.json();
    // Sort by createdAt descending (most recent first)
    data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    // After fetching words from backend
    setWords(data.map(w => ({
      ...w,
      manualRelatedWords: w.manualRelatedWords || []
    })));
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
    setError('');
    if (!form.word) return;
    const res = await fetch('/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    let data = {};
    try {
      data = await res.json();
    } catch (err) {
      setError('Unbekannter Fehler.');
      return;
    }

    if (!res.ok) {
      if (data.error === 'Wort bereits gelernt') {
        setError('Wort bereits gelernt');
      } else {
        setError('Wort nicht gefunden ou falsch geschrieben.');
      }
      return;
    }

    if (
      (!data.title || data.title.trim() === '') &&
      (!data.definitionList || data.definitionList.length === 0) &&
      (!data.relatedWords || data.relatedWords.length === 0)
    ) {
      setError('Wort nicht gefunden ou falsch geschrieben.');
      return;
    }
    setForm({ word: '' });
    fetchWords();
  };

  // Remover palavra
  const handleDelete = async id => {
    await fetch(`/words/${id}`, {
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

  const handleRelatedInputChange = (id, value) => {
    setRelatedInputs(inputs => ({ ...inputs, [id]: value }));
  };

  const handleAddRelated = async (id) => {
    const relatedWord = relatedInputs[id]?.trim();
    if (!relatedWord) return;

    // Find the main word
    const mainWord = words.find(w => w._id === id);
    if (mainWord && mainWord.word.toLowerCase() === relatedWord.toLowerCase()) {
      setRelatedErrors(errors => ({ ...errors, [id]: 'Das Wort kann nicht mit sich selbst verknüpft werden.' }));
      return;
    }

    // Call backend to add manual related word
    const res = await fetch(`/words/${id}/manual-related`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relatedWord }),
    });
    const data = await res.json();
    if (!res.ok) {
      setRelatedErrors(errors => ({ ...errors, [id]: data.error || 'Fehler' }));
      return;
    }
    setWords(ws => ws.map(w => w._id === id ? data : w));
    setRelatedInputs(inputs => ({ ...inputs, [id]: '' }));
    setRelatedErrors(errors => ({ ...errors, [id]: '' }));
  };

  const handleRemoveManualRelated = async (id, text) => {
    const res = await fetch(`/words/${id}/manual-related`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (res.ok) {
      setWords(ws => ws.map(w => w._id === id ? data : w));
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 24, background: '#f9f9f9', borderRadius: 12 }}>
      <h1 style={{ textAlign: 'center', marginBottom: 24 }}>Vinícius Wortschatz</h1>
      <form onSubmit={handleSubmit} style={{ marginBottom: 32 }}>
        <input
          name="word"
          placeholder="Wort"
          value={form.word}
          onChange={handleChange}
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
            cursor: 'pointer',
            marginTop: 12,
            marginBottom: 12
          }}
        >
          Hinzufügen
        </button>

        {error && (
          <div
            style={{
              background: '#ffd6d6',
              color: '#b71c1c',
              padding: 10,
              borderRadius: 6,
              marginBottom: 16,
              textAlign: 'center',
              fontWeight: 'bold'
            }}
          >
            {error}
          </div>
        )}
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
          {(() => {
            const seen = new Set();
            return words.filter(w => {
              const key = (w.title || w.word).toLowerCase();
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            }).map(w => {
              return (
                <li
                  key={w._id}
                  style={{
                    background: '#fff',
                    marginBottom: 8,
                    padding: 12,
                    borderRadius: 6,
                    border: '1px solid #eee',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      <strong>{w.title || w.word}</strong>
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
                  </div>
                  {/* "Mehr erfahren" link */}
                  <a
                    href={`https://www.dwds.de/wb/${encodeURIComponent(w.word)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#205c20',
                      textDecoration: 'underline',
                      fontWeight: 500,
                      marginTop: 4,
                      marginBottom: 4,
                      cursor: 'pointer',
                      alignSelf: 'flex-start'
                    }}
                  >
                    Mehr erfahren
                  </a>
                  {w.definitionList && w.definitionList.filter(def => def.trim() !== '...').length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <strong>Bedeutungen:</strong>
                      <ol style={{ paddingLeft: 20, listStyleType: 'decimal', listStylePosition: 'inside' }}>
                        {w.definitionList
                          .filter(def => def.trim() !== '...')
                          .map((def, i) => (
                            <li key={i}>{def}</li>
                          ))}
                      </ol>
                    </div>
                  )}
                  {/* Verwandte Wörter */}
                  {(w.relatedWords?.slice(0, 5).length > 0 || w.manualRelatedWords?.length > 0) && (
                    <div style={{ marginTop: 4 }}>
                      <strong>Verwandte Wörter:</strong>
                      <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 0, margin: 0 }}>


                        {/* Manually added related words */}
                        {w.manualRelatedWords && w.manualRelatedWords.length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 0, margin: 0 }}>
                              {w.manualRelatedWords.map((rel, i) => (
                                <li key={'manual-' + i} style={{ listStyle: 'none', display: 'flex', alignItems: 'center' }}>
                                  <a
                                    href={rel.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      color: '#205c20',
                                      textDecoration: 'none',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: '#fffde7',
                                      fontWeight: 500,
                                      border: '1px solid #ffe082',
                                      transition: 'background 0.2s',
                                      display: 'inline-block',
                                      marginRight: 4
                                    }}
                                    onMouseOver={e => e.currentTarget.style.background = '#fff9c4'}
                                    onMouseOut={e => e.currentTarget.style.background = '#fffde7'}
                                  >
                                    {rel.text}
                                  </a>
                                  <button
                                    onClick={() => handleRemoveManualRelated(w._id, rel.text)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#d32f2f',
                                      fontWeight: 'bold',
                                      fontSize: 16,
                                      cursor: 'pointer',
                                      marginLeft: 2
                                    }}
                                    title="Entfernen"
                                  >
                                    ×
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </ul>
                    </div>
                  )}
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      handleAddRelated(w._id);
                    }}
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' }}
                  >
                    <input
                      type="text"
                      placeholder="Verknüpftes Wort"
                      value={relatedInputs[w._id] || ''}
                      onChange={e => handleRelatedInputChange(w._id, e.target.value)}
                      style={{ flex: 1, padding: 4, borderRadius: 4, border: '1px solid #ccc' }}
                    />
                    <button
                      type="submit"
                      style={{
                        padding: '4px 12px',
                        borderRadius: 4,
                        border: 'none',
                        background: '#205c20',
                        color: '#fff',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Hinzufügen
                    </button>
                  </form>
                  {relatedErrors[w._id] && (
                    <div style={{ color: '#d32f2f', fontSize: 13, marginTop: 2 }}>
                      {relatedErrors[w._id]}
                    </div>
                  )}
                </li>
              );
            });
          })()}
        </ul>
      )}
    </div>
  );
}

export default App;
