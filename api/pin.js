const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(require('cors')());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DEV_INFO = {
  developer: "Aotpy",
  telegram: "https://t.me/Aotpy",
  channel: "https://t.me/obitostuffs",
  portfolio: "https://Aotpy.vercel.app",
  github: "Uchihaobito2010"
};

app.get('/api/pin', async (req, res) => {
  try {
    const url = req.query.p || req.query.url;
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Please provide Pinterest URL with ?p= for images',
        developer: DEV_INFO
      });
    }

    const result = await getPinterestMedia(url);
    
    if (result.type === 'video') {
      return res.status(400).json({
        success: false,
        error: 'This is a video. Use ?v= parameter instead',
        developer: DEV_INFO
      });
    }
    
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(200).json({ success: false, error: error.message, developer: DEV_INFO });
  }
});

app.get('/api/pin/video', async (req, res) => {
  try {
    const url = req.query.v || req.query.url;
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Please provide Pinterest URL with ?v= for videos',
        developer: DEV_INFO
      });
    }

    const result = await getPinterestMedia(url);
    
    if (result.type === 'image') {
      return res.status(400).json({
        success: false,
        error: 'This is an image. Use ?p= parameter instead',
        developer: DEV_INFO
      });
    }
    
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(200).json({ success: false, error: error.message, developer: DEV_INFO });
  }
});

app.post('/api/pin', async (req, res) => {
  try {
    const url = req.body.p || req.body.url;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Please provide Pinterest URL', developer: DEV_INFO });
    }
    const result = await getPinterestMedia(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(200).json({ success: false, error: error.message, developer: DEV_INFO });
  }
});

app.post('/api/pin/video', async (req, res) => {
  try {
    const url = req.body.v || req.body.url;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Please provide Pinterest URL', developer: DEV_INFO });
    }
    const result = await getPinterestMedia(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(200).json({ success: false, error: error.message, developer: DEV_INFO });
  }
});

async function getPinterestMedia(url) {
  try {
    url = url.split('?')[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    let videoUrl = null;
    let imageUrl = null;
    let title = $('title').text().replace(' - Pinterest', '').trim() || 'Pinterest Media';
    
    const scripts = $('script').get();
    for (const script of scripts) {
      const content = $(script).html();
      if (content) {
        if (!videoUrl) {
          const mp4Match = content.match(/https:\/\/[^"']+\.mp4[^"']*/);
          if (mp4Match) videoUrl = mp4Match[0];
        }
        if (!imageUrl) {
          const imgMatch = content.match(/https:\/\/[^"']+\.jpg[^"']*/);
          if (imgMatch && !imgMatch[0].includes('logo')) imageUrl = imgMatch[0];
        }
      }
    }
    
    if (!videoUrl) {
      videoUrl = $('meta[property="og:video"]').attr('content');
    }
    
    if (!imageUrl) {
      imageUrl = $('meta[property="og:image"]').attr('content');
    }
    
    if (videoUrl) {
      return {
        title: title,
        type: 'video',
        url: videoUrl,
        download_url: videoUrl
      };
    }
    
    if (imageUrl) {
      return {
        title: title,
        type: 'image',
        url: imageUrl,
        download_url: imageUrl
      };
    }
    
    throw new Error('No media found');
    
  } catch (error) {
    throw new Error(`Failed: ${error.message}`);
  }
}

module.exports = app;
