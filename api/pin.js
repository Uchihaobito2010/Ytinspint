const axios = require('axios');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let pinUrl;
    
    if (req.method === 'GET') {
      pinUrl = req.query.p;
    } else if (req.method === 'POST') {
      pinUrl = req.body.url;
    }

    if (!pinUrl) {
      return res.status(400).json({ 
        error: 'Missing URL',
        message: 'Please provide ?p=PINTEREST_URL for GET or { "url": "URL" } for POST' 
      });
    }

    // Validate URL
    const patterns = [
      /^https?:\/\/(www\.)?pinterest\.com\/pin\/\d+/i,
      /^https?:\/\/(www\.)?pinterest\.com\/pin\/[^\/]+\/\d+/i,
      /^https?:\/\/(www\.)?pin\.it\/[a-zA-Z0-9]+/i,
      /^https?:\/\/(www\.)?pinterest\.com\/[^\/]+\/[^\/]+\/\d+/i
    ];
    
    const isValid = patterns.some(pattern => pattern.test(pinUrl));
    
    if (!isValid) {
      return res.status(400).json({ 
        error: 'Invalid URL',
        message: 'Please provide a valid Pinterest URL' 
      });
    }

    // Clean URL
    const cleanUrl = pinUrl.split('?')[0];
    
    // Fetch Pinterest page
    const response = await axios.get(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      timeout: 10000
    });
    
    const html = response.data;
    
    // Try to find video
    const videoMatch = html.match(/video[^>]*src="([^"]+\.(mp4|mov|webm)[^"]*)"/i) ||
                      html.match(/contentUrl["\s:]+["']([^"']+\.(mp4|mov|webm)[^"']*)["']/i) ||
                      html.match(/"video_list":\s*{[^}]*"video_url":\s*"([^"]+)"/i);
    
    if (videoMatch && videoMatch[1]) {
      let videoUrl = videoMatch[1].replace(/\\/g, '');
      const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(' - Pinterest', '').trim() : 'Pinterest Video';
      const thumbnailMatch = html.match(/property="og:image"\s+content="([^"]+)"/i);
      const thumbnail = thumbnailMatch ? thumbnailMatch[1] : null;
      
      return res.json({
        success: true,
        type: 'video',
        url: videoUrl,
        title: title,
        thumbnail: thumbnail
      });
    }
    
    // Try to find image
    const imageMatch = html.match(/property="og:image"\s+content="([^"]+)"/i) ||
                      html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                      html.match(/"image":\s*"([^"]+)"/i);
    
    if (imageMatch && imageMatch[1]) {
      let imageUrl = imageMatch[1].replace(/\\/g, '');
      const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(' - Pinterest', '').trim() : 'Pinterest Image';
      
      return res.json({
        success: true,
        type: 'image',
        url: imageUrl,
        title: title,
        thumbnail: imageUrl
      });
    }
    
    // Try JSON data
    const jsonMatch = html.match(/<script[^>]*id="__PWS_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonMatch && jsonMatch[1]) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        const pinData = data.props?.initialReduxState?.pins || data.props?.pageProps?.initialReduxState?.pins;
        
        if (pinData) {
          const pinId = Object.keys(pinData)[0];
          const pin = pinData[pinId];
          
          if (pin?.videos?.video_list?.V_720P?.url) {
            return res.json({
              success: true,
              type: 'video',
              url: pin.videos.video_list.V_720P.url,
              title: pin.title || 'Pinterest Video',
              thumbnail: pin.images?.orig?.url || null
            });
          } else if (pin?.images?.orig?.url) {
            return res.json({
              success: true,
              type: 'image',
              url: pin.images.orig.url,
              title: pin.title || 'Pinterest Image',
              thumbnail: pin.images.orig.url
            });
          }
        }
      } catch (e) {
        // JSON parse error, continue
      }
    }
    
    return res.status(404).json({
      success: false,
      error: 'Not found',
      message: 'No downloadable content found'
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
        message: 'Pin not found or has been removed'
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Download failed',
      message: error.message || 'Failed to fetch content'
    });
  }
};
