const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from React
app.use(express.static(path.join(__dirname, '../client/build')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});


mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const WordSchema = new mongoose.Schema({
  word: String,
  title: String,
  relatedWords: [{ text: String, href: String }],
  manualRelatedWords: [{ text: String, href: String }],
  definitionList: [String],
  createdAt: { type: Date, default: Date.now }
});
const Word = mongoose.model('Word', WordSchema);

// --- MongoDB Wort-Routen ---
app.get('/words', async (req, res) => {
  const words = await Word.find();
  res.json(words);
});

app.post('/words', async (req, res) => {
  const { word } = req.body;

  try {
    // First, check for duplicates using the input word (case-insensitive)
    const existsInput = await Word.findOne({
      $or: [
        { word: { $regex: new RegExp('^' + word.trim() + '$', 'i') } },
        { title: { $regex: new RegExp('^' + word.trim() + '$', 'i') } }
      ]
    });
    if (existsInput) {
      return res.status(409).json({ error: 'word already learned' });
    }

    // Scrape DWDS
    const scrapeRes = await axios.get(`http://localhost:${PORT}/scrape/${encodeURIComponent(word)}`);
    const { title, relatedWords, definitionList } = scrapeRes.data;

    // Use normalized word (from title, fallback to input)
    let normalized = title ? title.trim().toLowerCase() : word.trim().toLowerCase();

    // Check for duplicates again using normalized value
    const existsNormalized = await Word.findOne({
      $or: [
        { word: { $regex: new RegExp('^' + normalized + '$', 'i') } },
        { title: { $regex: new RegExp('^' + normalized + '$', 'i') } }
      ]
    });
    if (existsNormalized) {
      return res.status(409).json({ error: 'word already learned' });
    }

    // Check if scraping returned any useful data
    const isEmpty =
      (!title || title.trim() === '') &&
      (!definitionList || definitionList.length === 0) &&
      (!relatedWords || relatedWords.length === 0);

    if (isEmpty) {
      return res.status(404).json({ error: 'DWDS hat das Wort nicht gefunden oder es existiert nicht.' });
    }

    const newWord = new Word({
      word: title || word,
      title,
      relatedWords,
      definitionList,
    });
    await newWord.save();
    res.status(201).json(newWord);
  } catch (err) {
    if (err.response && err.response.status === 500) {
      return res.status(500).json({ error: 'Fehler beim Abrufen von DWDS. Bitte versuchen Sie es später erneut.' });
    }
    res.status(500).json({ error: 'Unbekannter Serverfehler', details: err.message });
  }
});

app.delete('/words/:id', async (req, res) => {
  await Word.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.post('/words/:id/add-related', async (req, res) => {
  const { relatedWord } = req.body;
  const mainWord = await Word.findById(req.params.id);
  if (!mainWord) return res.status(404).json({ error: 'Wort nicht gefunden.' });

  // Find the related word in DB
  const related = await Word.findOne({ word: relatedWord });
  if (!related) return res.status(404).json({ error: 'Verknüpftes Wort nicht gefunden.' });

  // Prevent duplicates
  if (mainWord.relatedWords.some(rw => rw.text === related.word)) {
    return res.status(400).json({ error: 'Dieses Wort ist bereits verknüpft.' });
  }

  mainWord.relatedWords.push({
    text: related.title || related.word,
    href: `https://www.dwds.de/wb/${encodeURIComponent(related.word)}`
  });
  await mainWord.save();
  res.json(mainWord);
});

// Add a manual related word
app.post('/words/:id/manual-related', async (req, res) => {
  const { relatedWord } = req.body;
  const mainWord = await Word.findById(req.params.id);
  if (!mainWord) return res.status(404).json({ error: 'Wort nicht gefunden.' });

  // Find the related word in DB
  const related = await Word.findOne({ word: relatedWord });
  if (!related) return res.status(404).json({ error: 'Verknüpftes Wort nicht gefunden.' });

  // Prevent duplicates
  if ((mainWord.manualRelatedWords || []).some(rw => rw.text === (related.title || related.word))) {
    return res.status(400).json({ error: 'Dieses Wort ist bereits verknüpft.' });
  }

  mainWord.manualRelatedWords = [
    ...(mainWord.manualRelatedWords || []),
    {
      text: related.title || related.word,
      href: `https://www.dwds.de/wb/${encodeURIComponent(related.word)}`
    }
  ];
  await mainWord.save();
  res.json(mainWord);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});
// Remove a manual related word
app.delete('/words/:id/manual-related', async (req, res) => {
  const { text } = req.body;
  const mainWord = await Word.findById(req.params.id);
  if (!mainWord) return res.status(404).json({ error: 'Wort nicht gefunden.' });

  mainWord.manualRelatedWords = (mainWord.manualRelatedWords || []).filter(rw => rw.text !== text);
  await mainWord.save();
  res.json(mainWord);
});

// --- DWDS Scraping Route ---
app.get('/scrape/:word', async (req, res) => {
  const word = req.params.word;
  const url = `https://www.dwds.de/wb/${encodeURIComponent(word)}?o=${encodeURIComponent(word)}`;

  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // Extract title
    const rawTitle = $('h1.dwdswb-ft-lemmaansatz').text().trim();
    let title = rawTitle;
    if (rawTitle.includes(',')) {
      const [noun, article] = rawTitle.split(',').map(s => s.trim());
      title = `${article} ${noun}`;
    }

    // Related words
    const relatedWords = [];
    $('.more-relations a').each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr('href');
      if (text && href) {
        relatedWords.push({
          text,
          href: `https://www.dwds.de${href}`,
        });
      }
    });

    // Bedeutungsübersicht (first try)
    const meaningList = [];
    $('.bedeutungsuebersicht > ol > li').each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text) meaningList.push(text);
    });

    // Extract definitions from <a> inside bedeutungsuebersicht list
    const definitionList = [];
    $('.bedeutungsuebersicht > ol > li > a').each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text) definitionList.push(text);
    });

    // Fallback 1: scrape .dwdswb-lesarten .dwdswb-lesart .dwdswb-definition if definitionList is empty
    if (definitionList.length === 0) {
      $('.dwdswb-lesarten .dwdswb-lesart .dwdswb-definition').each((_, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text) definitionList.push(text);
      });
    }

    // Fallback 2: scrape any .dwdswb-definition if still empty
    if (definitionList.length === 0) {
      $('.dwdswb-definition').each((_, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text) definitionList.push(text);
      });
    }

    // Build response object
    const result = {
      word,
      title,
      relatedWords,
      definitionList,
    };

    // Log the result in the server terminal
    console.log('Scraped data:', JSON.stringify(result, null, 2));

    // Response
    res.json(result);
  } catch (err) {
    console.error('Scraping error:', err.message);
    res.status(500).json({ error: 'Failed to scrape data.' });
  }
});

// Only one app.listen!
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));