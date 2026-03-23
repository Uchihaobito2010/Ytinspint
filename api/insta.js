const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(require('cors')());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Developer Info
const DEV_INFO = {
  developer: "Aotpy",
  telegram: "https://t.me/Aotpy",
  channel: "https://t.me/obitostuffs",
  portfolio: "https://Aotpy.vercel.app",
  github: "Uchihaobito2010"
};

// Instagram Downloader - Fixed Version
app.get('/api/insta', async (req, res) => {
  try {
    const url = req.query.p || req.query.url;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Please provide Instagram URL using ?p= parameter',
        developer: DEV_INFO
      });
    }

    const result = await downloadInstagram(url);
    
    res.json({
      success: true,
      data: result,
      developer: DEV_INFO
    });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      developer: DEV_INFO
    });
  }
});

app.post('/api/insta', async (req, res) => {
  try {
    const url = req.body.p || req.body.url;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Please provide Instagram URL',
        developer: DEV_INFO
      });
    }

    const result = await downloadInstagram(url);
    
    res.json({
      success: true,
      data: result,
      developer: DEV_INFO
    });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      developer: DEV_INFO
    });
  }
});

async function downloadInstagram(url) {
  try {
    // Clean URL
    url = url.split('?')[0];
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    // Method 1: Using Instagram API (via rapidapi or public APIs)
    const media = [];
    
    // Try multiple public Instagram downloader APIs
    const apis = [
      `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`,
      `https://instagram.com/p/${extractCode(url)}/?__a=1&__d=1`,
      `https://i.instagram.com/api/v1/media/${extractCode(url)}/info/`
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
        
        // Parse different response formats
        if (response.data && response.data.thumbnail_url) {
          media.push({
            type: response.data.thumbnail_url.includes('.mp4') ? 'video' : 'image',
            url: response.data.thumbnail_url,
            quality: 'HD'
          });
        }
        
        if (response.data && response.data.graphql) {
          const post = response.data.graphql.shortcode_media;
          if (post.is_video) {
            media.push({
              type: 'video',
              url: post.video_url,
              quality: 'HD',
              thumbnail: post.thumbnail_src
            });
          } else if (post.display_url) {
            media.push({
              type: 'image',
              url: post.display_url,
              quality: 'HD'
            });
          }
          
          // Handle carousel posts
          if (post.edge_sidecar_to_children) {
            post.edge_sidecar_to_children.edges.forEach(edge => {
              const node = edge.node;
              if (node.is_video) {
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
        }
        
        if (media.length > 0) break;
        
      } catch (err) {
        console.log(`API ${apiUrl} failed:`, err.message);
        continue;
      }
    }
    
    // Method 2: Scrape from page if API fails
    if (media.length === 0) {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract from meta tags
      const videoUrl = $('meta[property="og:video"]').attr('content') || 
                       $('meta[property="og:video:url"]').attr('content');
      
      if (videoUrl) {
        media.push({
          type: 'video',
          url: videoUrl,
          quality: 'HD'
        });
      }
      
      const imageUrl = $('meta[property="og:image"]').attr('content');
      if (imageUrl && !videoUrl) {
        media.push({
          type: 'image',
          url: imageUrl,
          quality: 'HD'
        });
      }
      
      // Extract from script tags
      const scripts = $('script').get();
      for (const script of scripts) {
        const content = $(script).html();
        if (content && content.includes('video_url')) {
          const match = content.match(/video_url":"([^"]+)"/);
          if (match && match[1]) {
            media.push({
              type: 'video',
              url: match[1].replace(/\\/g, ''),
              quality: 'HD'
            });
          }
        }
      }
    }
    
    if (media.length === 0) {
      throw new Error('No media found in this post. The post might be private or deleted.');
    }
    
    // Get title/caption
    let title = 'Instagram Media';
    try {
      const oembedResponse = await axios.get(`https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`);
      title = oembedResponse.data.title || 'Instagram Media';
    } catch (err) {
      // Use default title
    }
    
    return {
      title: title,
      media: media,
      url: url,
      count: media.length,
      types: media.map(m => m.type).filter((v, i, a) => a.indexOf(v) === i)
    };
    
  } catch (error) {
    throw new Error(`Instagram download failed: ${error.message}`);
  }
}

function extractCode(url) {
  const patterns = [
    /instagram\.com\/p\/([^\/?#]+)/,
    /instagram\.com\/reel\/([^\/?#]+)/,
    /instagram\.com\/tv\/([^\/?#]+)/,
    /instagram\.com\/stories\/([^\/?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

module.exports = app;
