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

// Instagram Image Endpoint
app.get('/api/insta', async (req, res) => {
  try {
    const url = req.query.p || req.query.url;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Please provide Instagram URL', developer: DEV_INFO });
    }
    const result = await downloadInstagramImage(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, developer: DEV_INFO });
  }
});

// Instagram Video Endpoint - FIXED
app.get('/api/insta/video', async (req, res) => {
  try {
    const url = req.query.v || req.query.url;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Please provide Instagram video URL', developer: DEV_INFO });
    }
    const result = await downloadInstagramVideo(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, developer: DEV_INFO });
  }
});

// POST endpoints
app.post('/api/insta', async (req, res) => {
  try {
    const url = req.body.p || req.body.url;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Please provide Instagram URL', developer: DEV_INFO });
    }
    const result = await downloadInstagramImage(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, developer: DEV_INFO });
  }
});

app.post('/api/insta/video', async (req, res) => {
  try {
    const url = req.body.v || req.body.url;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Please provide Instagram video URL', developer: DEV_INFO });
    }
    const result = await downloadInstagramVideo(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, developer: DEV_INFO });
  }
});

async function downloadInstagramImage(url) {
  try {
    const response = await axios.get(`https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`);
    
    if (response.data && response.data.thumbnail_url) {
      return {
        title: response.data.title || 'Instagram Image',
        type: 'image',
        images: [{
          url: response.data.thumbnail_url,
          quality: 'HD'
        }],
        count: 1,
        download_url: response.data.thumbnail_url
      };
    }
    
    throw new Error('No image found');
  } catch (error) {
    throw new Error(`Failed to download Instagram image: ${error.message}`);
  }
}

async function downloadInstagramVideo(url) {
  try {
    // Clean URL
    url = url.split('?')[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    
    console.log(`Downloading Instagram video from: ${url}`);
    
    // Method 1: Using insta-save API (like saveclip.app)
    try {
      const response = await axios.post('https://insta-save.com/api/ajaxSearch', 
        new URLSearchParams({
          q: url,
          t: 'media',
          lang: 'en'
        }),
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://insta-save.com/'
          },
          timeout: 20000
        }
      );
      
      const data = response.data;
      
      if (data && data.data && data.data.video) {
        return {
          title: data.title || 'Instagram Reel',
          type: 'video',
          url: data.data.video,
          quality: 'HD',
          thumbnail: data.data.thumbnail,
          download_url: data.data.video
        };
      }
      
      if (data && data.video) {
        return {
          title: data.title || 'Instagram Reel',
          type: 'video',
          url: data.video,
          quality: 'HD',
          download_url: data.video
        };
      }
    } catch (err) {
      console.log('Method 1 (insta-save) failed:', err.message);
    }
    
    // Method 2: Using savefrom.net (works like saveclip)
    try {
      const response = await axios.post('https://en.savefrom.net/1-ajax/', 
        new URLSearchParams({
          url: url,
          ajax: '1'
        }),
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 20000
        }
      );
      
      if (response.data && response.data.url) {
        return {
          title: 'Instagram Reel',
          type: 'video',
          url: response.data.url,
          quality: 'HD',
          download_url: response.data.url
        };
      }
    } catch (err) {
      console.log('Method 2 (savefrom) failed:', err.message);
    }
    
    // Method 3: Using Instagram oEmbed (gets thumbnail only - backup)
    try {
      const response = await axios.get(`https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`);
      
      if (response.data && response.data.thumbnail_url) {
        // Return thumbnail as fallback with warning
        return {
          title: response.data.title || 'Instagram Reel',
          type: 'video',
          url: response.data.thumbnail_url,
          quality: 'thumbnail',
          is_thumbnail: true,
          warning: 'This is a thumbnail. Use a different service for actual video.',
          download_url: response.data.thumbnail_url
        };
      }
    } catch (err) {
      console.log('Method 3 (oembed) failed:', err.message);
    }
    
    throw new Error('Could not extract video URL. The reel might be private or deleted.');
    
  } catch (error) {
    throw new Error(`Failed to download Instagram video: ${error.message}`);
  }
}

module.exports = app;
