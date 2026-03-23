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

app.get('/api/pin', async (req, res) => {
  try {
    const url = req.query.p || req.query.url;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Please provide Pinterest URL using ?p= parameter', developer: DEV_INFO });
    }
    const result = await downloadPinterest(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, developer: DEV_INFO });
  }
});

app.post('/api/pin', async (req, res) => {
  try {
    const url = req.body.p || req.body.url;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Please provide Pinterest URL', developer: DEV_INFO });
    }
    const result = await downloadPinterest(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, developer: DEV_INFO });
  }
});

async function downloadPinterest(url) {
  try {
    url = url.split('?')[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    
    const pinId = extractPinId(url);
    let media = null;
    
    // Method 1: Pinterest widget API
    if (pinId) {
      try {
        const response = await axios.get(`https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${pinId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 10000
        });
        
        if (response.data?.data?.[0]) {
          const pin = response.data.data[0];
          
          // Get video URL
          if (pin.video_url) {
            let videoUrl = pin.video_url;
            if (videoUrl.includes('.m3u8')) {
              videoUrl = await getMp4FromM3U8(videoUrl);
            }
            media = {
              type: 'video',
              url: videoUrl,
              quality: 'HD',
              thumbnail: pin.images?.orig?.url,
              duration: pin.video_duration
            };
          }
          // Get image
          else if (pin.images?.orig?.url) {
            media = {
              type: 'image',
              url: pin.images.orig.url,
              quality: 'HD'
            };
          }
        }
      } catch (err) {}
    }
    
    // Method 2: Direct scraping
    if (!media) {
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      
      const $ = cheerio.load(response.data);
      
      // Look for video URL
      let videoUrl = null;
      
      // Check video elements
      $('video source').each((i, el) => {
        const src = $(el).attr('src');
        if (src && src.includes('.mp4')) videoUrl = src;
      });
      
      if (!videoUrl) {
        $('video').each((i, el) => {
          const src = $(el).attr('src');
          if (src && src.includes('.mp4')) videoUrl = src;
        });
      }
      
      // Check meta tags
      if (!videoUrl) {
        videoUrl = $('meta[property="og:video"]').attr('content') ||
                   $('meta[property="og:video:secure_url"]').attr('content');
      }
      
      // Check scripts for video URL
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
          }
        }
      }
      
      if (videoUrl) {
        if (videoUrl.includes('.m3u8')) {
          videoUrl = await getMp4FromM3U8(videoUrl);
        }
        media = {
          type: 'video',
          url: videoUrl,
          quality: 'HD'
        };
      } else {
        // Get image
        const imageUrl = $('meta[property="og:image"]').attr('content') ||
                        $('img[src*="originals"]').first().attr('src');
        if (imageUrl) {
          media = {
            type: 'image',
            url: imageUrl,
            quality: 'HD'
          };
        }
      }
    }
    
    if (!media) {
      throw new Error('No media found in this pin');
    }
    
    return {
      title: 'Pinterest Pin',
      media: media,
      pin_id: pinId,
      type: media.type
    };
    
  } catch (error) {
    throw new Error(`Failed: ${error.message}`);
  }
}

async function getMp4FromM3U8(m3u8Url) {
  try {
    // Try to get MP4 by replacing extension
    const mp4Url = m3u8Url.replace('.m3u8', '.mp4');
    const response = await axios.head(mp4Url, { timeout: 5000 });
    if (response.status === 200) return mp4Url;
  } catch (err) {}
  return m3u8Url;
}

function extractPinId(url) {
  const patterns = [
    /pinterest\.com\/pin\/(\d+)/,
    /pin\.it\/([^\/]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

module.exports = app;
