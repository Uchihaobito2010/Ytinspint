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
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide Pinterest URL using ?p= parameter for images', 
        developer: DEV_INFO,
        usage: '/api/pin?p=https://pin.it/abc123'
      });
    }

    const result = await downloadPinterestImage(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      developer: DEV_INFO 
    });
  }
});

app.get('/api/pin/video', async (req, res) => {
  try {
    const url = req.query.v || req.query.url;
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide Pinterest URL using ?v= parameter for videos', 
        developer: DEV_INFO,
        usage: '/api/pin/video?v=https://pin.it/abc123'
      });
    }

    const result = await downloadPinterestVideo(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      developer: DEV_INFO 
    });
  }
});

app.post('/api/pin', async (req, res) => {
  try {
    const url = req.body.p || req.body.url;
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide Pinterest URL for images', 
        developer: DEV_INFO 
      });
    }
    const result = await downloadPinterestImage(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      developer: DEV_INFO 
    });
  }
});

app.post('/api/pin/video', async (req, res) => {
  try {
    const url = req.body.v || req.body.url;
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide Pinterest URL for videos', 
        developer: DEV_INFO 
      });
    }
    const result = await downloadPinterestVideo(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      developer: DEV_INFO 
    });
  }
});

async function downloadPinterestImage(url) {
  try {
    url = url.split('?')[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    
    const pinId = extractPinId(url);
    let imageUrl = null;
    let title = 'Pinterest Image';
    
    if (pinId) {
      try {
        const response = await axios.get(`https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${pinId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 10000
        });
        
        if (response.data?.data?.[0]) {
          const pin = response.data.data[0];
          title = pin.title || pin.description || 'Pinterest Image';
          
          if (pin.images?.orig?.url) {
            imageUrl = pin.images.orig.url;
          } else if (pin.images?.564x?.url) {
            imageUrl = pin.images['564x'].url;
          } else if (pin.image_url) {
            imageUrl = pin.image_url;
          }
        }
      } catch (err) {}
    }
    
    if (!imageUrl) {
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      
      const $ = cheerio.load(response.data);
      title = $('title').text().replace(' - Pinterest', '') || 'Pinterest Image';
      
      imageUrl = $('meta[property="og:image"]').attr('content') ||
                 $('img[src*="originals"]').first().attr('src') ||
                 $('img[src*="736x"]').first().attr('src');
    }
    
    if (!imageUrl) {
      throw new Error('No image found in this pin');
    }
    
    return {
      title: title,
      type: 'image',
      url: imageUrl,
      quality: 'HD',
      pin_id: pinId,
      download_url: imageUrl
    };
    
  } catch (error) {
    throw new Error(`Image download failed: ${error.message}`);
  }
}

async function downloadPinterestVideo(url) {
  try {
    url = url.split('?')[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    
    const pinId = extractPinId(url);
    let videoUrl = null;
    let title = 'Pinterest Video';
    let thumbnail = null;
    
    if (pinId) {
      try {
        const response = await axios.get(`https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${pinId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 10000
        });
        
        if (response.data?.data?.[0]) {
          const pin = response.data.data[0];
          title = pin.title || pin.description || 'Pinterest Video';
          thumbnail = pin.images?.orig?.url;
          
          if (pin.video_url) {
            videoUrl = pin.video_url;
            if (videoUrl.includes('.m3u8')) {
              videoUrl = await convertM3U8ToMP4(videoUrl);
            }
          }
        }
      } catch (err) {}
    }
    
    if (!videoUrl) {
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      
      const $ = cheerio.load(response.data);
      title = $('title').text().replace(' - Pinterest', '') || 'Pinterest Video';
      thumbnail = $('meta[property="og:image"]').attr('content');
      
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
      
      if (!videoUrl) {
        videoUrl = $('meta[property="og:video"]').attr('content') ||
                   $('meta[property="og:video:secure_url"]').attr('content');
      }
      
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
      
      if (videoUrl && videoUrl.includes('.m3u8')) {
        videoUrl = await convertM3U8ToMP4(videoUrl);
      }
    }
    
    if (!videoUrl) {
      throw new Error('No video found in this pin');
    }
    
    return {
      title: title,
      type: 'video',
      url: videoUrl,
      quality: 'HD',
      thumbnail: thumbnail,
      pin_id: pinId,
      download_url: videoUrl
    };
    
  } catch (error) {
    throw new Error(`Video download failed: ${error.message}`);
  }
}

async function convertM3U8ToMP4(m3u8Url) {
  try {
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
