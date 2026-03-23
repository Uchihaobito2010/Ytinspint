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
    
    console.log(`[Instagram] Processing URL: ${url}`);
    
    // Extract shortcode
    const shortcode = extractShortcode(url);
    if (!shortcode) {
      throw new Error('Could not extract video ID from URL');
    }
    
    console.log(`[Instagram] Extracted shortcode: ${shortcode}`);
    
    // METHOD 1: Using insta-save.com API (works like saveclip)
    try {
      console.log('[Instagram] Trying insta-save.com API...');
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
          timeout: 15000
        }
      );
      
      const data = response.data;
      
      // Check for video URL in response
      if (data && data.data) {
        if (data.data.video) {
          console.log('[Instagram] Found video URL via insta-save');
          return {
            title: data.title || 'Instagram Reel',
            type: 'video',
            url: data.data.video,
            quality: 'HD',
            thumbnail: data.data.thumbnail,
            download_url: data.data.video
          };
        }
        if (data.data[0] && data.data[0].video) {
          console.log('[Instagram] Found video URL in array');
          return {
            title: data.title || 'Instagram Reel',
            type: 'video',
            url: data.data[0].video,
            quality: 'HD',
            download_url: data.data[0].video
          };
        }
      }
    } catch (err) {
      console.log('[Instagram] insta-save failed:', err.message);
    }
    
    // METHOD 2: Using savefrom.net
    try {
      console.log('[Instagram] Trying savefrom.net API...');
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
      
      if (response.data && response.data.url) {
        console.log('[Instagram] Found video URL via savefrom');
        return {
          title: 'Instagram Reel',
          type: 'video',
          url: response.data.url,
          quality: 'HD',
          download_url: response.data.url
        };
      }
    } catch (err) {
      console.log('[Instagram] savefrom failed:', err.message);
    }
    
    // METHOD 3: Direct Instagram Graph API
    try {
      console.log('[Instagram] Trying Instagram Graph API...');
      const response = await axios.get(`https://www.instagram.com/p/${shortcode}/?__a=1&__d=1`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 15000
      });
      
      const data = response.data;
      if (data && data.graphql && data.graphql.shortcode_media) {
        const media = data.graphql.shortcode_media;
        
        // Check for video
        if (media.is_video && media.video_url) {
          console.log('[Instagram] Found video via Graph API');
          return {
            title: media.edge_media_to_caption?.edges[0]?.node?.text || 'Instagram Reel',
            type: 'video',
            url: media.video_url,
            quality: 'HD',
            thumbnail: media.thumbnail_src,
            download_url: media.video_url
          };
        }
        
        // Check carousel for videos
        if (media.__typename === 'GraphSidecar' && media.edge_sidecar_to_children) {
          for (const edge of media.edge_sidecar_to_children.edges) {
            if (edge.node.is_video && edge.node.video_url) {
              console.log('[Instagram] Found video in carousel');
              return {
                title: 'Instagram Video',
                type: 'video',
                url: edge.node.video_url,
                quality: 'HD',
                thumbnail: edge.node.thumbnail_src,
                download_url: edge.node.video_url
              };
            }
          }
        }
      }
    } catch (err) {
      console.log('[Instagram] Graph API failed:', err.message);
    }
    
    // METHOD 4: Using public instagram video downloader API
    try {
      console.log('[Instagram] Trying public downloader API...');
      const apiUrls = [
        `https://api.tikwm.com/api/instagram?url=${encodeURIComponent(url)}`,
        `https://instagram-downloader.vercel.app/api?url=${encodeURIComponent(url)}`
      ];
      
      for (const apiUrl of apiUrls) {
        try {
          const response = await axios.get(apiUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
          });
          
          if (response.data && response.data.video) {
            console.log('[Instagram] Found video via public API');
            return {
              title: response.data.title || 'Instagram Reel',
              type: 'video',
              url: response.data.video,
              quality: 'HD',
              download_url: response.data.video
            };
          }
          
          if (response.data && response.data.data && response.data.data.play) {
            console.log('[Instagram] Found video via tikwm API');
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
          continue;
        }
      }
    } catch (err) {
      console.log('[Instagram] Public APIs failed:', err.message);
    }
    
    throw new Error('Could not extract video URL. The reel might be private, deleted, or the service is temporarily unavailable.');
    
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
