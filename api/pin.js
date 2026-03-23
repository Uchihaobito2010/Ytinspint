const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function validatePinUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  const patterns = [
    /^https?:\/\/(www\.)?pinterest\.com\/pin\/\d+/i,
    /^https?:\/\/(www\.)?pinterest\.com\/pin\/[^\/]+\/\d+/i,
    /^https?:\/\/(www\.)?pin\.it\/[a-zA-Z0-9]+/i,
    /^https?:\/\/(www\.)?pinterest\.com\/[^\/]+\/[^\/]+\/\d+/i
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

async function downloadPinterestContent(pinUrl) {
  try {
    const cleanUrl = pinUrl.split('?')[0];
    
    const response = await axios.get(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 10000
    });
    
    const html = response.data;
    
    const videoMatch = html.match(/video[^>]*src="([^"]+\.(mp4|mov|webm)[^"]*)"/i) ||
                      html.match(/contentUrl["\s:]+["']([^"']+\.(mp4|mov|webm)[^"']*)["']/i) ||
                      html.match(/"video_list":\s*{[^}]*"video_url":\s*"([^"]+)"/i);
    
    if (videoMatch && videoMatch[1]) {
      let videoUrl = videoMatch[1].replace(/\\/g, '');
      const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(' - Pinterest', '') : 'Pinterest Video';
      const thumbnailMatch = html.match(/property="og:image"\s+content="([^"]+)"/i);
      const thumbnail = thumbnailMatch ? thumbnailMatch[1] : null;
      
      return {
        success: true,
        type: 'video',
        url: videoUrl,
        title: title.trim(),
        thumbnail: thumbnail
      };
    }
    
    const imageMatch = html.match(/property="og:image"\s+content="([^"]+)"/i) ||
                      html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                      html.match(/"image":\s*"([^"]+)"/i) ||
                      html.match(/<img[^>]*src="([^"]*original[^"]*\.(jpg|jpeg|png|webp)[^"]*)"/i);
    
    if (imageMatch && imageMatch[1]) {
      let imageUrl = imageMatch[1].replace(/\\/g, '');
      const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(' - Pinterest', '') : 'Pinterest Image';
      
      return {
        success: true,
        type: 'image',
        url: imageUrl,
        title: title.trim(),
        thumbnail: imageUrl
      };
    }
    
    const jsonMatch = html.match(/<script[^>]*id="__PWS_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonMatch && jsonMatch[1]) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        const pinData = data.props?.initialReduxState?.pins || data.props?.pageProps?.initialReduxState?.pins;
        
        if (pinData) {
          const pinId = Object.keys(pinData)[0];
          const pin = pinData[pinId];
          
          if (pin?.videos?.video_list?.V_720P?.url) {
            return {
              success: true,
              type: 'video',
              url: pin.videos.video_list.V_720P.url,
              title: pin.title || 'Pinterest Video',
              thumbnail: pin.images?.orig?.url || null
            };
          } else if (pin?.images?.orig?.url) {
            return {
              success: true,
              type: 'image',
              url: pin.images.orig.url,
              title: pin.title || 'Pinterest Image',
              thumbnail: pin.images.orig.url
            };
          }
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
      }
    }
    
    return {
      success: false,
      message: 'No downloadable content found'
    };
    
  } catch (error) {
    console.error('Error:', error.message);
    
    if (error.response?.status === 404) {
      return {
        success: false,
        message: 'Pin not found'
      };
    }
    
    return {
      success: false,
      message: `Failed: ${error.message}`
    };
  }
}

app.get('/api/pin', async (req, res) => {
  try {
    const { p: pinUrl } = req.query;
    
    if (!pinUrl) {
      return res.status(400).json({ 
        error: 'Missing URL',
        message: 'Please provide ?p=PINTEREST_URL' 
      });
    }
    
    if (!validatePinUrl(pinUrl)) {
      return res.status(400).json({ 
        error: 'Invalid URL',
        message: 'Please provide a valid Pinterest URL' 
      });
    }
    
    const result = await downloadPinterestContent(pinUrl);
    
    if (!result.success) {
      return res.status(404).json({ 
        error: 'Not found',
        message: result.message 
      });
    }
    
    res.json({
      success: true,
      type: result.type,
      url: result.url,
      title: result.title,
      thumbnail: result.thumbnail
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Download failed',
      message: error.message 
    });
  }
});

app.post('/api/pin', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'Missing URL',
        message: 'Please provide URL in request body' 
      });
    }
    
    if (!validatePinUrl(url)) {
      return res.status(400).json({ 
        error: 'Invalid URL',
        message: 'Please provide a valid Pinterest URL' 
      });
    }
    
    const result = await downloadPinterestContent(url);
    
    if (!result.success) {
      return res.status(404).json({ 
        error: 'Not found',
        message: result.message 
      });
    }
    
    res.json({
      success: true,
      type: result.type,
      url: result.url,
      title: result.title,
      thumbnail: result.thumbnail
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Download failed',
      message: error.message 
    });
  }
});

module.exports = app;
