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
// For images only: /api/insta?p={url}
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
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      developer: DEV_INFO 
    });
  }
});

// ============= INSTAGRAM VIDEO ENDPOINT =============
// For videos only: /api/insta?v={url}
app.get('/api/insta/video', async (req, res) => {
  try {
    const url = req.query.v || req.query.url;
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide Instagram URL using ?v= parameter for videos', 
        developer: DEV_INFO,
        usage: '/api/insta/video?v=https://www.instagram.com/reel/CODE/'
      });
    }

    const result = await downloadInstagramVideo(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      developer: DEV_INFO 
    });
  }
});

// POST endpoints
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
    res.status(500).json({ 
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
        error: 'Please provide Instagram URL for videos', 
        developer: DEV_INFO 
      });
    }
    const result = await downloadInstagramVideo(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      developer: DEV_INFO 
    });
  }
});

// Instagram Image Downloader
async function downloadInstagramImage(url) {
  try {
    url = url.split('?')[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    
    const shortcode = extractShortcode(url);
    if (!shortcode) throw new Error('Invalid Instagram URL');
    
    const images = [];
    let title = 'Instagram Image';
    
    // Method 1: Instagram API
    try {
      const response = await axios.get(`https://www.instagram.com/p/${shortcode}/?__a=1&__d=1`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });
      
      const data = response.data.graphql.shortcode_media;
      title = data.edge_media_to_caption.edges[0]?.node?.text || 'Instagram Image';
      
      // Single image
      if (data.__typename === 'GraphImage' && data.display_url) {
        images.push({
          url: data.display_url,
          quality: 'HD'
        });
      }
      
      // Carousel images
      if (data.__typename === 'GraphSidecar') {
        data.edge_sidecar_to_children.edges.forEach(edge => {
          if (edge.node.__typename === 'GraphImage') {
            images.push({
              url: edge.node.display_url,
              quality: 'HD'
            });
          }
        });
      }
      
    } catch (err) {}
    
    // Method 2: oEmbed
    if (images.length === 0) {
      try {
        const response = await axios.get(`https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`);
        if (response.data && response.data.thumbnail_url) {
          images.push({
            url: response.data.thumbnail_url,
            quality: 'HD'
          });
          title = response.data.title || 'Instagram Image';
        }
      } catch (err) {}
    }
    
    if (images.length === 0) {
      throw new Error('No images found in this post');
    }
    
    return {
      title: title,
      type: 'image',
      images: images,
      count: images.length,
      shortcode: shortcode,
      download_urls: images.map(img => img.url)
    };
    
  } catch (error) {
    throw new Error(`Image download failed: ${error.message}`);
  }
}

// Instagram Video Downloader
async function downloadInstagramVideo(url) {
  try {
    url = url.split('?')[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    
    const shortcode = extractShortcode(url);
    if (!shortcode) throw new Error('Invalid Instagram URL');
    
    let videoUrl = null;
    let title = 'Instagram Video';
    let thumbnail = null;
    
    // Method 1: Instagram API
    try {
      const response = await axios.get(`https://www.instagram.com/p/${shortcode}/?__a=1&__d=1`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });
      
      const data = response.data.graphql.shortcode_media;
      title = data.edge_media_to_caption.edges[0]?.node?.text || 'Instagram Video';
      
      // Single video
      if (data.__typename === 'GraphVideo' && data.video_url) {
        videoUrl = data.video_url;
        thumbnail = data.thumbnail_src;
      }
      
      // Reel video
      if (data.__typename === 'GraphReel' && data.video_url) {
        videoUrl = data.video_url;
        thumbnail = data.thumbnail_src;
      }
      
      // Carousel video
      if (data.__typename === 'GraphSidecar') {
        for (const edge of data.edge_sidecar_to_children.edges) {
          if (edge.node.__typename === 'GraphVideo' && edge.node.video_url) {
            videoUrl = edge.node.video_url;
            thumbnail = edge.node.thumbnail_src;
            break;
          }
        }
      }
      
    } catch (err) {}
    
    // Method 2: Alternative API
    if (!videoUrl) {
      try {
        const response = await axios.post('https://v3.instadownloader.online/api/ajaxSearch', 
          new URLSearchParams({ q: url, t: 'media', lang: 'en' }),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        
        if (response.data?.data?.video) {
          videoUrl = response.data.data.video;
          title = response.data.title || 'Instagram Video';
        }
      } catch (err) {}
    }
    
    if (!videoUrl) {
      throw new Error('No video found in this post');
    }
    
    return {
      title: title,
      type: 'video',
      url: videoUrl,
      quality: 'HD',
      thumbnail: thumbnail,
      shortcode: shortcode,
      download_url: videoUrl
    };
    
  } catch (error) {
    throw new Error(`Video download failed: ${error.message}`);
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
