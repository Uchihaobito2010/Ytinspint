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

app.get('/api/pin', async (req, res) => {
  try {
    const url = req.query.p || req.query.url;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Please provide Pinterest URL using ?p= parameter',
        developer: DEV_INFO
      });
    }

    const result = await downloadPinterest(url);
    
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

app.post('/api/pin', async (req, res) => {
  try {
    const url = req.body.p || req.body.url;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Please provide Pinterest URL',
        developer: DEV_INFO
      });
    }

    const result = await downloadPinterest(url);
    
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

async function downloadPinterest(url) {
  try {
    // Clean URL
    url = url.split('?')[0];
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    // Extract pin ID
    const pinId = extractPinId(url);
    let media = null;
    let title = 'Pinterest Pin';
    
    // Method 1: Try Pinterest widget API (best for videos)
    if (pinId) {
      try {
        const widgetResponse = await axios.get(`https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${pinId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        });
        
        if (widgetResponse.data && widgetResponse.data.data && widgetResponse.data.data[0]) {
          const pin = widgetResponse.data.data[0];
          title = pin.title || pin.description || 'Pinterest Pin';
          
          // Check for video (multiple video URL formats)
          if (pin.video_url) {
            // Convert m3u8 to direct video URL if needed
            let videoUrl = pin.video_url;
            if (videoUrl.includes('.m3u8')) {
              videoUrl = await convertM3U8ToMP4(videoUrl);
            }
            
            media = {
              type: 'video',
              url: videoUrl,
              quality: pin.video_quality || 'HD',
              thumbnail: pin.images?.orig?.url || pin.image_url,
              duration: pin.video_duration || 'Unknown'
            };
          } 
          // Check for video from v1.pinimg.com
          else if (pin.images && pin.images.orig && pin.images.orig.url) {
            const imageUrl = pin.images.orig.url;
            if (imageUrl.includes('videos') || imageUrl.includes('.mp4')) {
              media = {
                type: 'video',
                url: imageUrl,
                quality: 'HD',
                thumbnail: imageUrl
              };
            } else {
              media = {
                type: 'image',
                url: imageUrl,
                quality: 'HD'
              };
            }
          } 
          // Check for regular image
          else if (pin.image_url) {
            media = {
              type: 'image',
              url: pin.image_url,
              quality: 'HD'
            };
          }
        }
      } catch (err) {
        console.log('Widget API failed:', err.message);
      }
    }
    
    // Method 2: Scrape from page if widget API fails
    if (!media) {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      title = $('title').text().replace(' - Pinterest', '') || 'Pinterest Pin';
      
      // Look for video in various places
      let videoUrl = null;
      
      // Check video element
      $('video source').each((i, el) => {
        const src = $(el).attr('src');
        if (src && !videoUrl) {
          videoUrl = src;
        }
      });
      
      if (!videoUrl) {
        $('video').each((i, el) => {
          const src = $(el).attr('src');
          if (src && !videoUrl) {
            videoUrl = src;
          }
        });
      }
      
      // Check meta tags for video
      if (!videoUrl) {
        videoUrl = $('meta[property="og:video"]').attr('content') ||
                   $('meta[property="og:video:url"]').attr('content') ||
                   $('meta[name="twitter:player"]').attr('content');
      }
      
      // Check script tags for video URL
      if (!videoUrl) {
        const scripts = $('script').get();
        for (const script of scripts) {
          const content = $(script).html();
          if (content) {
            // Look for video_url in JSON
            const videoMatch = content.match(/video_url["']?\s*:\s*["']([^"']+\.mp4[^"']*)["']/);
            if (videoMatch && videoMatch[1]) {
              videoUrl = videoMatch[1];
              break;
            }
            
            // Look for .mp4 in URLs
            const mp4Match = content.match(/https?:\/\/[^"']+\.mp4[^"']*/);
            if (mp4Match && mp4Match[0]) {
              videoUrl = mp4Match[0];
              break;
            }
          }
        }
      }
      
      if (videoUrl) {
        // Convert m3u8 to MP4 if needed
        if (videoUrl.includes('.m3u8')) {
          videoUrl = await convertM3U8ToMP4(videoUrl);
        }
        
        media = {
          type: 'video',
          url: videoUrl,
          quality: 'HD',
          thumbnail: $('meta[property="og:image"]').attr('content')
        };
      } else {
        // Get image if no video
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
      title: title,
      media: media,
      pin_id: pinId || 'Unknown',
      type: media.type
    };
    
  } catch (error) {
    throw new Error(`Pinterest download failed: ${error.message}`);
  }
}

async function convertM3U8ToMP4(m3u8Url) {
  // If it's an m3u8, try to get the highest quality MP4
  // This is a simplified version - in production, you'd want to parse the m3u8 playlist
  try {
    // Try to get the MP4 version by replacing .m3u8 with .mp4
    const mp4Url = m3u8Url.replace('.m3u8', '.mp4');
    
    // Check if MP4 exists
    const response = await axios.head(mp4Url, { timeout: 5000 });
    if (response.status === 200) {
      return mp4Url;
    }
  } catch (err) {
    // Return original m3u8 if MP4 doesn't exist
    return m3u8Url;
  }
  
  return m3u8Url;
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
