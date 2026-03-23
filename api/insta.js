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

// Instagram Video Endpoint - FIXED FOR REELS
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
    // Using public Instagram oEmbed API
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
    // Backup method: Try to get from page
    try {
      const shortcode = extractShortcode(url);
      if (!shortcode) throw new Error('Invalid URL');
      
      const response = await axios.get(`https://www.instagram.com/p/${shortcode}/?__a=1`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const data = response.data.graphql.shortcode_media;
      const images = [];
      
      if (data.__typename === 'GraphImage' && data.display_url) {
        images.push({ url: data.display_url, quality: 'HD' });
      }
      
      if (data.__typename === 'GraphSidecar') {
        data.edge_sidecar_to_children.edges.forEach(edge => {
          if (edge.node.__typename === 'GraphImage') {
            images.push({ url: edge.node.display_url, quality: 'HD' });
          }
        });
      }
      
      if (images.length > 0) {
        return {
          title: data.edge_media_to_caption.edges[0]?.node?.text || 'Instagram Image',
          type: 'image',
          images: images,
          count: images.length,
          download_urls: images.map(img => img.url)
        };
      }
    } catch (backupError) {}
    
    throw new Error('Failed to download Instagram image');
  }
}

async function downloadInstagramVideo(url) {
  try {
    // Clean URL
    url = url.split('?')[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    
    const shortcode = extractShortcode(url);
    if (!shortcode) throw new Error('Could not extract video ID');
    
    console.log(`Downloading Instagram video: ${shortcode}`);
    
    // Method 1: Using instagram-stories API (works for reels)
    try {
      const apiUrl = `https://instagram-api.vercel.app/api/instagram?url=${encodeURIComponent(url)}`;
      const response = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      });
      
      if (response.data && response.data.video) {
        return {
          title: response.data.title || 'Instagram Video',
          type: 'video',
          url: response.data.video,
          quality: 'HD',
          thumbnail: response.data.thumbnail,
          download_url: response.data.video
        };
      }
    } catch (err) {
      console.log('Method 1 failed:', err.message);
    }
    
    // Method 2: Using tikwm API (works for reels)
    try {
      const apiUrl = `https://tikwm.com/api/instagram?url=${encodeURIComponent(url)}`;
      const response = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      });
      
      if (response.data && response.data.data && response.data.data.play) {
        return {
          title: response.data.data.title || 'Instagram Reel',
          type: 'video',
          url: response.data.data.play,
          quality: 'HD',
          thumbnail: response.data.data.cover,
          download_url: response.data.data.play
        };
      }
    } catch (err) {
      console.log('Method 2 failed:', err.message);
    }
    
    // Method 3: Direct Instagram API
    try {
      const response = await axios.get(`https://www.instagram.com/p/${shortcode}/?__a=1&__d=1`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 15000
      });
      
      const data = response.data.graphql.shortcode_media;
      
      // Check if it's a video/reel
      if (data.is_video && data.video_url) {
        return {
          title: data.edge_media_to_caption.edges[0]?.node?.text || 'Instagram Reel',
          type: 'video',
          url: data.video_url,
          quality: 'HD',
          thumbnail: data.thumbnail_src,
          download_url: data.video_url
        };
      }
      
      // Check carousel for videos
      if (data.__typename === 'GraphSidecar') {
        for (const edge of data.edge_sidecar_to_children.edges) {
          if (edge.node.is_video && edge.node.video_url) {
            return {
              title: edge.node.edge_media_to_caption.edges[0]?.node?.text || 'Instagram Video',
              type: 'video',
              url: edge.node.video_url,
              quality: 'HD',
              thumbnail: edge.node.thumbnail_src,
              download_url: edge.node.video_url
            };
          }
        }
      }
    } catch (err) {
      console.log('Method 3 failed:', err.message);
    }
    
    // Method 4: Using rapidapi (if you have API key)
    // You can sign up for a free API key at https://rapidapi.com/rockethearts/api/instagram-scraper-api2
    // Then uncomment this section
    
    /*
    try {
      const options = {
        method: 'GET',
        url: 'https://instagram-scraper-api2.p.rapidapi.com/v1/media_info',
        params: { code: shortcode },
        headers: {
          'X-RapidAPI-Key': 'YOUR_RAPIDAPI_KEY',
          'X-RapidAPI-Host': 'instagram-scraper-api2.p.rapidapi.com'
        }
      };
      
      const response = await axios.request(options);
      if (response.data && response.data.data && response.data.data.video_url) {
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
      console.log('Method 4 failed:', err.message);
    }
    */
    
    throw new Error('Could not extract video URL. The reel might be private or deleted.');
    
  } catch (error) {
    throw new Error(`Failed to download Instagram video: ${error.message}`);
  }
}

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
