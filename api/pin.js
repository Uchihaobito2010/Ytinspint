const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(require('cors')());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Pinterest Downloader
app.get('/api/pin', async (req, res) => {
  try {
    const url = req.query.p || req.query.url;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Please provide Pinterest URL using ?p= parameter'
      });
    }

    const result = await downloadPinterest(url);
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/pin', async (req, res) => {
  try {
    const url = req.body.p || req.body.url;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Please provide Pinterest URL'
      });
    }

    const result = await downloadPinterest(url);
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

async function downloadPinterest(url) {
  try {
    // Clean URL
    url = url.split('?')[0];
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    // Extract pin ID
    const pinId = extractPinId(url);
    
    // Try oEmbed first
    try {
      const oembedResponse = await axios.get(`https://www.pinterest.com/oembed/?url=${encodeURIComponent(url)}`, {
        timeout: 5000
      });
      
      if (oembedResponse.data && oembedResponse.data.thumbnail_url) {
        return {
          title: oembedResponse.data.title || 'Pinterest Pin',
          media: {
            type: 'image',
            url: oembedResponse.data.thumbnail_url,
            quality: 'HD'
          },
          pin_id: pinId
        };
      }
    } catch (err) {
      // Continue to next method
    }
    
    // Try widget API
    if (pinId) {
      try {
        const widgetResponse = await axios.get(`https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${pinId}`, {
          timeout: 5000
        });
        
        if (widgetResponse.data && widgetResponse.data.data && widgetResponse.data.data[0]) {
          const pin = widgetResponse.data.data[0];
          let media;
          
          if (pin.video_url) {
            media = {
              type: 'video',
              url: pin.video_url,
              quality: 'HD'
            };
          } else if (pin.images && pin.images.orig) {
            media = {
              type: 'image',
              url: pin.images.orig.url,
              quality: 'HD'
            };
          } else if (pin.image_url) {
            media = {
              type: 'image',
              url: pin.image_url,
              quality: 'HD'
            };
          }
          
          if (media) {
            return {
              title: pin.title || pin.description || 'Pinterest Pin',
              description: pin.description,
              media: media,
              pin_id: pinId
            };
          }
        }
      } catch (err) {
        // Continue
      }
    }
    
    // Direct scraping as last resort
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    let mediaUrl = null;
    let mediaType = 'image';
    
    // Look for video
    $('video source').each((i, el) => {
      const src = $(el).attr('src');
      if (src && !mediaUrl) mediaUrl = src;
    });
    
    if (!mediaUrl) {
      $('video').each((i, el) => {
        const src = $(el).attr('src');
        if (src && !mediaUrl) mediaUrl = src;
      });
    }
    
    // Look for image
    if (!mediaUrl) {
      mediaUrl = $('meta[property="og:image"]').attr('content');
      if (mediaUrl && mediaUrl.includes('originals')) {
        mediaType = 'image';
      }
    }
    
    if (!mediaUrl) {
      $('img[src*="originals"]').each((i, el) => {
        const src = $(el).attr('src');
        if (src && !mediaUrl) mediaUrl = src;
      });
    }
    
    if (!mediaUrl) {
      throw new Error('No media found in this pin');
    }
    
    const title = $('title').text().replace(' - Pinterest', '') || 'Pinterest Pin';
    
    return {
      title: title,
      media: {
        type: mediaUrl.includes('.mp4') ? 'video' : 'image',
        url: mediaUrl,
        quality: 'HD'
      },
      pin_id: pinId
    };
    
  } catch (error) {
    throw new Error(`Pinterest download failed: ${error.message}`);
  }
}

function extractPinId(url) {
  const patterns = [
    /pinterest\.com\/pin\/(\d+)/,
    /pin\.it\/([^\/]+)/,
    /pinterest\.com\/pin\/[^\/]+\/(\d+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

module.exports = app;
