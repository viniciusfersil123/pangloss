import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';

const app = express();
app.use(cors());

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
    console.log('meaningList:', meaningList);

    // Extract definitions from <a> inside bedeutungsuebersicht list
    const definitionList = [];
    $('.bedeutungsuebersicht > ol > li > a').each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text) definitionList.push(text);
    });
    console.log('definitionList from <a>:', definitionList);

    // Fallback 1: scrape .dwdswb-lesarten .dwdswb-lesart .dwdswb-definition if definitionList is empty
    if (definitionList.length === 0) {
      $('.dwdswb-lesarten .dwdswb-lesart .dwdswb-definition').each((_, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text) definitionList.push(text);
      });
      console.log('Fallback 1 (.dwdswb-lesarten .dwdswb-lesart .dwdswb-definition):', definitionList);
    }

    // Fallback 2: scrape any .dwdswb-definition if still empty
    if (definitionList.length === 0) {
      $('.dwdswb-definition').each((_, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text) definitionList.push(text);
      });
      console.log('Fallback 2 (.dwdswb-definition):', definitionList);
    }


    // Response
    res.json({
      word,
      title,
      relatedWords,
      definitionList,
    });
  } catch (err) {
    console.error('Scraping error:', err.message);
    res.status(500).json({ error: 'Failed to scrape data.' });
  }
});

app.listen(3001, () => {
  console.log('✅ Server running on http://localhost:3001');
});
