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

// Instagram Video Endpoint - Using saveclip.app method
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
    
    console.log(`[Instagram Video] Processing: ${url}`);
    
    // METHOD 1: Use saveclip.app directly (scrape their site)
    try {
      console.log('[Instagram] Trying saveclip.app...');
      
      // First, get the page with the download button
      const response = await axios.get(`https://saveclip.app/en?url=${encodeURIComponent(url)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://saveclip.app/'
        },
        timeout: 15000
      });
      
      const $ = cheerio.load(response.data);
      
      // Find video download link
      let videoUrl = null;
      
      // Look for video source
      $('video source').each((i, el) => {
        const src = $(el).attr('src');
        if (src && (src.includes('.mp4') || src.includes('video'))) {
          videoUrl = src;
        }
      });
      
      // Look for download button link
      if (!videoUrl) {
        $('a[download]').each((i, el) => {
          const href = $(el).attr('href');
          if (href && (href.includes('.mp4') || href.includes('video'))) {
            videoUrl = href;
          }
        });
      }
      
      // Look for any MP4 link
      if (!videoUrl) {
        $('a').each((i, el) => {
          const href = $(el).attr('href');
          if (href && href.includes('.mp4')) {
            videoUrl = href;
          }
        });
      }
      
      // Look in script tags for video URL
      if (!videoUrl) {
        const scripts = $('script').get();
        for (const script of scripts) {
          const content = $(script).html();
          if (content) {
            const mp4Match = content.match(/https?:\/\/[^"']+\.mp4[^"']*/);
            if (mp4Match) {
              videoUrl = mp4Match[0];
              break;
            }
            const videoMatch = content.match(/https?:\/\/[^"']+\/video\/[^"']*/);
            if (videoMatch) {
              videoUrl = videoMatch[0];
              break;
            }
          }
        }
      }
      
      if (videoUrl) {
        console.log('[Instagram] Found video via saveclip.app');
        return {
          title: $('title').text().replace(' - saveclip', '').replace('SaveInsta |', '').trim() || 'Instagram Reel',
          type: 'video',
          url: videoUrl,
          quality: 'HD',
          download_url: videoUrl
        };
      }
    } catch (err) {
      console.log('[Instagram] saveclip.app failed:', err.message);
    }
    
    // METHOD 2: Use insta-save.com API (similar to saveclip)
    try {
      console.log('[Instagram] Trying insta-save.com...');
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
      
      if (data && data.data) {
        if (data.data.video) {
          console.log('[Instagram] Found video via insta-save');
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
          console.log('[Instagram] Found video via insta-save (array)');
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
      console.log('[Instagram] insta-save.com failed:', err.message);
    }
    
    // METHOD 3: Use direct Instagram Graph API
    try {
      const shortcode = extractShortcode(url);
      if (shortcode) {
        console.log(`[Instagram] Trying Graph API for shortcode: ${shortcode}`);
        const response = await axios.get(`https://www.instagram.com/p/${shortcode}/?__a=1&__d=1`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 15000
        });
        
        const media = response.data?.graphql?.shortcode_media;
        if (media && media.is_video && media.video_url) {
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
      }
    } catch (err) {
      console.log('[Instagram] Graph API failed:', err.message);
    }
    
    throw new Error('Could not extract video URL. Try a different Instagram reel URL or contact @Aotpy');
    
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
