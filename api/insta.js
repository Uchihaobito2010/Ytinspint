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

app.get('/api/insta', async (req, res) => {
  try {
    const url = req.query.p || req.query.url;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Please provide Instagram URL using ?p= parameter', developer: DEV_INFO });
    }
    const result = await downloadInstagram(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, developer: DEV_INFO });
  }
});

app.post('/api/insta', async (req, res) => {
  try {
    const url = req.body.p || req.body.url;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Please provide Instagram URL', developer: DEV_INFO });
    }
    const result = await downloadInstagram(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, developer: DEV_INFO });
  }
});

async function downloadInstagram(url) {
  try {
    url = url.split('?')[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    
    const media = [];
    const shortcode = extractShortcode(url);
    
    // Method 1: Using public Instagram downloader API
    const apis = [
      `https://instagram.com/p/${shortcode}/?__a=1&__d=1`,
      `https://i.instagram.com/api/v1/media/${shortcode}/info/`,
      `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}`
    ];
    
    for (const apiUrl of apis) {
      try {
        const response = await axios.get(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          },
          timeout: 10000
        });
        
        // Parse Instagram graphql response
        let data = response.data;
        if (data.graphql) data = data.graphql.shortcode_media;
        
        // Get video URL
        if (data.video_url) {
          media.push({
            type: 'video',
            url: data.video_url,
            quality: 'HD',
            thumbnail: data.thumbnail_src || data.display_url
          });
        }
        
        // Get images
        if (data.display_url && !data.video_url) {
          media.push({
            type: 'image',
            url: data.display_url,
            quality: 'HD'
          });
        }
        
        // Handle carousel
        if (data.edge_sidecar_to_children) {
          data.edge_sidecar_to_children.edges.forEach(edge => {
            const node = edge.node;
            if (node.video_url) {
              media.push({
                type: 'video',
                url: node.video_url,
                quality: 'HD',
                thumbnail: node.thumbnail_src
              });
            } else if (node.display_url) {
              media.push({
                type: 'image',
                url: node.display_url,
                quality: 'HD'
              });
            }
          });
        }
        
        if (media.length > 0) break;
      } catch (err) {
        continue;
      }
    }
    
    // Method 2: Using rapid api if available
    if (media.length === 0) {
      try {
        const response = await axios.get(`https://www.instagram.com/p/${shortcode}/embed/`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        const $ = cheerio.load(response.data);
        const videoUrl = $('video').attr('src');
        if (videoUrl) {
          media.push({
            type: 'video',
            url: videoUrl,
            quality: 'HD'
          });
        }
      } catch (err) {}
    }
    
    // Method 3: Alternative downloader API
    if (media.length === 0) {
      try {
        const response = await axios.post('https://v3.instadownloader.online/api/ajaxSearch', 
          new URLSearchParams({ q: url, t: 'media', lang: 'en' }),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        
        if (response.data && response.data.data) {
          const data = response.data.data;
          if (data.video) {
            media.push({
              type: 'video',
              url: data.video,
              quality: 'HD'
            });
          }
          if (data.images) {
            data.images.forEach(img => {
              media.push({ type: 'image', url: img, quality: 'HD' });
            });
          }
        }
      } catch (err) {}
    }
    
    if (media.length === 0) {
      throw new Error('No media found. The post might be private or deleted.');
    }
    
    return {
      title: 'Instagram Media',
      media: media,
      url: url,
      count: media.length,
      types: [...new Set(media.map(m => m.type))]
    };
    
  } catch (error) {
    throw new Error(`Failed: ${error.message}`);
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
