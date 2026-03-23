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

// ============= INSTAGRAM IMAGE ENDPOINT =============
app.get('/api/insta', async (req, res) => {
  try {
    const url = req.query.p || req.query.url;
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide Instagram URL using ?p= parameter for images', 
        developer: DEV_INFO
      });
    }

    const result = await downloadInstagramImage(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(200).json({ 
      success: false, 
      error: error.message, 
      developer: DEV_INFO 
    });
  }
});

// ============= INSTAGRAM VIDEO ENDPOINT =============
app.get('/api/insta/video', async (req, res) => {
  try {
    const url = req.query.v || req.query.url;
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide Instagram video URL using ?v= parameter', 
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

// ============= POST ENDPOINTS =============
app.post('/api/insta', async (req, res) => {
  try {
    const url = req.body.p || req.body.url;
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide Instagram URL for images', 
        developer: DEV_INFO 
      });
    }
    const result = await downloadInstagramImage(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
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

// ============= IMAGE DOWNLOADER (Using oEmbed only - avoids rate limits) =============
async function downloadInstagramImage(url) {
  try {
    // Clean URL
    url = url.split('?')[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    
    // Using oEmbed API - more reliable and has better rate limits
    const response = await axios.get(`https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`, {
      timeout: 10000,
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
    throw new Error(`Failed to download Instagram image: ${error.message}`);
  }
}

// ============= VIDEO DOWNLOADER (Using multiple public APIs) =============
async function downloadInstagramVideo(url) {
  try {
    // Clean URL
    url = url.split('?')[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    
    console.log(`[Instagram Video] Processing: ${url}`);
    
    // Extract shortcode
    const shortcode = extractShortcode(url);
    if (!shortcode) throw new Error('Invalid Instagram URL');
    
    // ===== METHOD 1: Using savefrom.net (more reliable) =====
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
          timeout: 15000
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
    
    // ===== METHOD 2: Using public API (no rate limits) =====
    try {
      console.log('[Video] Trying public API...');
      const response = await axios.get(`https://tikwm.com/api/instagram?url=${encodeURIComponent(url)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
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
      console.log('[Video] Public API failed:', err.message);
    }
    
    // ===== METHOD 3: Using alternative downloader =====
    try {
      console.log('[Video] Trying alternative downloader...');
      const response = await axios.get(`https://instagram-downloader.vercel.app/api?url=${encodeURIComponent(url)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
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
    
    // ===== METHOD 4: Using rapidapi (if you have API key) =====
    // Uncomment and add your API key if you have one
    /*
    try {
      console.log('[Video] Trying RapidAPI...');
      const response = await axios.get('https://instagram-downloader-download-instagram-videos-stories.p.rapidapi.com/index', {
        params: { url: url },
        headers: {
          'X-RapidAPI-Key': 'YOUR_RAPIDAPI_KEY',
          'X-RapidAPI-Host': 'instagram-downloader-download-instagram-videos-stories.p.rapidapi.com'
        },
        timeout: 15000
      });
      
      if (response.data && response.data.video) {
        return {
          title: 'Instagram Reel',
          type: 'video',
          url: response.data.video,
          quality: 'HD',
          download_url: response.data.video
        };
      }
    } catch (err) {
      console.log('[Video] RapidAPI failed:', err.message);
    }
    */
    
    throw new Error('Could not extract video URL. Please try again in a few minutes.');
    
  } catch (error) {
    throw new Error(`Video download failed: ${error.message}`);
  }
}

// ============= HELPER FUNCTION =============
function extractShortcode(url) {
  const patterns = [
    /instagram\.com\/p\/([^\/?#]+)/,
    /instagram\.com\/reel\/([^\/?#]+)/,
    /instagram\.com\/tv\/([^\/?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

module.exports = app;
