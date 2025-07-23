import React, { useState, useEffect } from 'react';
import './App.css';

const TOOLTIP_OFFSET = 18; // px, adjust as needed


function getThemeClass(title) {
  const lower = (title || '').toLowerCase();
  if (lower.startsWith('der ')) return 'theme-der';
  if (lower.startsWith('die ')) return 'theme-die';
  if (lower.startsWith('das ')) return 'theme-das';
  return 'theme-default';
}


function App() {
  const [input, setInput] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, text: '' });
  const [definitions, setDefinitions] = useState({}); // cache for definitions
  const [defLoading, setDefLoading] = useState(false);

  // Debug: Log tooltip state changes
  useEffect(() => {
    console.debug('[Tooltip State]', tooltip);
  }, [tooltip]);

  const handleSearch = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setLoading(true);
    fetch(`http://localhost:3001/scrape/${encodeURIComponent(trimmed)}`)
      .then(res => res.json())
      .then(setData)
      .catch(err => {
        console.error('❌ Error:', err);
        setData(null);
      })
      .finally(() => setLoading(false));
  };

  // Custom lorem for each related word (for demo, use index)
  const getRelatedWordLorem = (text, i) =>
    `Lorem ipsum for "${text}": Lorem ipsum dolor sit amet, consectetur adipiscing elit. (Box #${i + 1})`;

  // Tooltip handlers
  const handleMouseEnter = (e, text, i) => {
    setTooltip({
      show: true,
      x: e.clientX,
      y: e.clientY - TOOLTIP_OFFSET,
      text: getRelatedWordLorem(text, i),
    });
  };

  // Fetch and show definition on click
  const handleRelatedWordClick = async (e, word, i) => {
    e.preventDefault();
    setTooltip({
      show: true,
      x: e.clientX,
      y: e.clientY - TOOLTIP_OFFSET,
      text: 'Loading...',
    });
    console.log('Tooltip set:', {
      show: true,
      x: e.clientX,
      y: e.clientY - TOOLTIP_OFFSET,
      text: 'Loading...',
    });
    setDefLoading(true);

    if (definitions[word]) {
      setTooltip(t => ({ ...t, text: definitions[word] }));
      setDefLoading(false);
      return;
    }

    try {
      const res = await fetch(`http://localhost:3001/scrape/${encodeURIComponent(word)}`);
      const json = await res.json();
      console.debug('Definition API response:', json); // <--- Add this line
      const def = json.meaningList?.[0] || 'No definition found.';
      setDefinitions(prev => ({ ...prev, [word]: def }));
      setTooltip(t => ({ ...t, text: def }));
    } catch (err) {
      setTooltip(t => ({ ...t, text: 'Error fetching definition.' }));
    }
    setDefLoading(false);
  };

  const handleMouseLeave = () => {
    setTooltip({ show: false, x: 0, y: 0, text: '' });
  };

  return (
    <div className={`container ${getThemeClass(data?.title)}`}>
      <header className="header">
        <h1 className="title">Vinícius Wortschatz</h1>
      </header>

      <div className="input-group">
        <input
          type="text"
          className="search-input"
          placeholder="Gib ein Wort ein (z.B. Sonne)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button className="search-btn" onClick={handleSearch}>Suchen</button>
      </div>

      {loading && <p className="status">Lade...</p>}

      {data && (
        <div className="results">
          <h2 className="word-title">{data.title}</h2>

          {data.definitionList && data.definitionList.length > 0 && (
            <section className="section">
              <h3>Bedeutungen</h3>
              <ol>
                {data.definitionList.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
            </section>
          )}

          {data.relatedWords && data.relatedWords.length > 0 && (
            <section className="section">
              <h3 className="related-title">Verwandte Wörter</h3>
              <div className="related-grid">
                {data.relatedWords.map((item, i) => (
                  <div className="related-card" key={i}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => handleRelatedWordClick(e, item.text, i)}
                      onMouseEnter={e => handleMouseEnter(e, item.text, i)}
                      onMouseLeave={handleMouseLeave}
                    >
                      {item.text}
                    </a>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {tooltip.show && (
        <div
          className="tooltip-box"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

export default App;
