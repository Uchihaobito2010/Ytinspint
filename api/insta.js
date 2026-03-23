const express = require('express');
const axios = require('axios');

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
        developer: DEV_INFO,
        usage: '/api/insta?p=https://www.instagram.com/p/CODE/'
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

// ============= INSTAGRAM VIDEO ENDPOINT - WORKING =============
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

// ============= IMAGE DOWNLOADER =============
async function downloadInstagramImage(url) {
  try {
    url = url.split('?')[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    
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
    throw new Error(`Failed: ${error.message}`);
  }
}

// ============= VIDEO DOWNLOADER - WORKING VERSION =============
async function downloadInstagramVideo(url) {
  try {
    url = url.split('?')[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    
    console.log(`[Video] Processing: ${url}`);
    
    // Extract shortcode
    let shortcode = null;
    const reelMatch = url.match(/instagram\.com\/reel\/([^\/?#]+)/);
    const postMatch = url.match(/instagram\.com\/p\/([^\/?#]+)/);
    
    if (reelMatch) shortcode = reelMatch[1];
    if (postMatch) shortcode = postMatch[1];
    
    if (!shortcode) {
      throw new Error('Could not extract video ID from URL');
    }
    
    console.log(`[Video] Shortcode: ${shortcode}`);
    
    // ===== METHOD 1: Using Instagram's GraphQL API directly =====
    try {
      const response = await axios.get(`https://www.instagram.com/api/v1/media/${shortcode}/info/`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'X-IG-App-ID': '936619743392459',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 15000
      });
      
      if (response.data && response.data.items && response.data.items[0]) {
        const media = response.data.items[0];
        if (media.video_versions && media.video_versions[0]) {
          const videoUrl = media.video_versions[0].url;
          console.log('[Video] Found via Instagram API');
          return {
            title: media.caption?.text?.slice(0, 100) || 'Instagram Reel',
            type: 'video',
            url: videoUrl,
            quality: media.video_versions[0].type || 'HD',
            thumbnail: media.image_versions2?.candidates?.[0]?.url,
            download_url: videoUrl
          };
        }
      }
    } catch (err) {
      console.log('[Video] Instagram API failed:', err.message);
    }
    
    // ===== METHOD 2: Using RapidAPI Instagram Downloader (FREE) =====
    // You need to get a free API key from https://rapidapi.com/rockethearts/api/instagram-scraper-api2
    // Then uncomment this section and add your key
    
    /*
    try {
      const response = await axios.get('https://instagram-scraper-api2.p.rapidapi.com/v1/media_info', {
        params: { code: shortcode },
        headers: {
          'X-RapidAPI-Key': 'YOUR_RAPIDAPI_KEY_HERE',
          'X-RapidAPI-Host': 'instagram-scraper-api2.p.rapidapi.com'
        },
        timeout: 15000
      });
      
      if (response.data && response.data.data && response.data.data.video_url) {
        console.log('[Video] Found via RapidAPI');
        return {
          title: response.data.data.caption || 'Instagram Reel',
          type: 'video',
          url: response.data.data.video_url,
          quality: 'HD',
          thumbnail: response.data.data.thumbnail_url,
          download_url: response.data.data.video_url
        };
      }
    } catch (err) {
      console.log('[Video] RapidAPI failed:', err.message);
    }
    */
    
    // ===== METHOD 3: Using alternative public API =====
    try {
      const response = await axios.get(`https://instagram-video-downloader.vercel.app/api?url=${encodeURIComponent(url)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      });
      
      if (response.data && response.data.url) {
        const videoUrl = response.data.url;
        if (videoUrl && !videoUrl.includes('.jpg')) {
          console.log('[Video] Found via alternative API');
          return {
            title: response.data.title || 'Instagram Reel',
            type: 'video',
            url: videoUrl,
            quality: 'HD',
            download_url: videoUrl
          };
        }
      }
    } catch (err) {
      console.log('[Video] Alternative API failed:', err.message);
    }
    
    // ===== METHOD 4: Using tikwm API =====
    try {
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
      console.log('[Video] Tikwm API failed:', err.message);
    }
    
    throw new Error('Could not extract video URL. The reel might be private or deleted.');
    
  } catch (error) {
    throw new Error(`Video download failed: ${error.message}`);
  }
}

module.exports = app;
