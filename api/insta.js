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

// ============= MAIN ENDPOINT - Auto Detect =============
app.get('/api/insta', async (req, res) => {
  try {
    let url = req.query.p || req.query.v || req.query.url;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide Instagram URL using ?p= (image) or ?v= (video) parameter',
        developer: DEV_INFO,
        usage: {
          image: '/api/insta?p=https://www.instagram.com/p/CODE/',
          video: '/api/insta?v=https://www.instagram.com/reel/CODE/'
        }
      });
    }

    // Auto-detect if it's a video or image
    if (url.includes('/reel/') || url.includes('/tv/')) {
      // It's a video/reel
      const result = await downloadInstagramVideo(url);
      res.json({ success: true, data: result, developer: DEV_INFO });
    } else {
      // It's an image post
      const result = await downloadInstagramImage(url);
      res.json({ success: true, data: result, developer: DEV_INFO });
    }
  } catch (error) {
    res.status(200).json({ 
      success: false, 
      error: error.message, 
      developer: DEV_INFO 
    });
  }
});

// ============= VIDEO ENDPOINT (for backward compatibility) =============
app.get('/api/insta/video', async (req, res) => {
  try {
    const url = req.query.v || req.query.url;
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide Instagram video URL using ?v= parameter', 
        developer: DEV_INFO,
        usage: '/api/insta/video?v=https://www.instagram.com/reel/CODE/'
      });
    }

    const result = await downloadInstagramVideo(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(200).json({ 
      success: false, 
      error: error.message, 
      developer: DEV_INFO 
    });
  }
});

// ============= POST ENDPOINTS =============
app.post('/api/insta', async (req, res) => {
  try {
    const url = req.body.p || req.body.v || req.body.url;
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide Instagram URL', 
        developer: DEV_INFO 
      });
    }
    
    // Auto-detect
    if (url.includes('/reel/') || url.includes('/tv/')) {
      const result = await downloadInstagramVideo(url);
      res.json({ success: true, data: result, developer: DEV_INFO });
    } else {
      const result = await downloadInstagramImage(url);
      res.json({ success: true, data: result, developer: DEV_INFO });
    }
  } catch (error) {
    res.status(200).json({ 
      success: false, 
      error: error.message, 
      developer: DEV_INFO 
    });
  }
});

app.post('/api/insta/video', async (req, res) => {
  try {
    const url = req.body.v || req.body.url;
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide Instagram video URL', 
        developer: DEV_INFO 
      });
    }
    const result = await downloadInstagramVideo(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(200).json({ 
      success: false, 
      error: error.message, 
      developer: DEV_INFO 
    });
  }
});

// ============= IMAGE DOWNLOADER =============
async function downloadInstagramImage(url) {
  try {
    // Clean URL
    url = url.split('?')[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    
    console.log(`[Instagram Image] Processing: ${url}`);
    
    // Using oEmbed API
    const response = await axios.get(`https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
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
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again in a few minutes.');
    }
    throw new Error(`Failed: ${error.message}`);
  }
}

// ============= VIDEO DOWNLOADER =============
async function downloadInstagramVideo(url) {
  try {
    // Clean URL
    url = url.split('?')[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    
    console.log(`[Instagram Video] Processing: ${url}`);
    
    // ===== METHOD 1: Using savefrom.net =====
    try {
      console.log('[Video] Trying savefrom.net...');
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
      
      if (response.data && response.data.url && !response.data.url.includes('.jpg')) {
        console.log('[Video] Found via savefrom.net');
        return {
          title: response.data.meta?.title || 'Instagram Reel',
          type: 'video',
          url: response.data.url,
          quality: 'HD',
          download_url: response.data.url
        };
      }
    } catch (err) {
      console.log('[Video] savefrom.net failed:', err.message);
    }
    
    // ===== METHOD 2: Using tikwm API =====
    try {
      console.log('[Video] Trying tikwm API...');
      const response = await axios.get(`https://tikwm.com/api/instagram?url=${encodeURIComponent(url)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 20000
      });
      
      if (response.data && response.data.data && response.data.data.play) {
        const videoUrl = response.data.data.play;
        if (videoUrl && !videoUrl.includes('.jpg')) {
          console.log('[Video] Found via tikwm API');
          return {
            title: response.data.data.title || 'Instagram Reel',
            type: 'video',
            url: videoUrl,
            quality: 'HD',
            thumbnail: response.data.data.cover,
            download_url: videoUrl
          };
        }
      }
    } catch (err) {
      console.log('[Video] tikwm API failed:', err.message);
    }
    
    // ===== METHOD 3: Using alternative downloader =====
    try {
      console.log('[Video] Trying alternative downloader...');
      const response = await axios.get(`https://instagram-downloader.vercel.app/api?url=${encodeURIComponent(url)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 20000
      });
      
      if (response.data && response.data.url && !response.data.url.includes('.jpg')) {
        console.log('[Video] Found via alternative API');
        return {
          title: response.data.title || 'Instagram Reel',
          type: 'video',
          url: response.data.url,
          quality: 'HD',
          download_url: response.data.url
        };
      }
    } catch (err) {
      console.log('[Video] Alternative API failed:', err.message);
    }
    
    throw new Error('Could not extract video URL. Please try again.');
    
  } catch (error) {
    throw new Error(`Video download failed: ${error.message}`);
  }
}

module.exports = app;
