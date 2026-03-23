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

// ============= INSTAGRAM IMAGE ENDPOINT =============
// For images only: /api/insta?p={url}
app.get('/api/insta', async (req, res) => {
  try {
    const url = req.query.p || req.query.url;
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide Instagram URL using ?p= parameter for images', 
        developer: DEV_INFO,
        usage: '/api/insta?p=https://www.instagram.com/p/CODE/'
      });
    }

    const result = await downloadInstagramImage(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      developer: DEV_INFO 
    });
  }
});

// ============= INSTAGRAM VIDEO ENDPOINT =============
// For videos only: /api/insta?v={url}
app.get('/api/insta/video', async (req, res) => {
  try {
    const url = req.query.v || req.query.url;
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide Instagram video URL using ?v= parameter', 
        developer: DEV_INFO,
        usage: '/api/insta/video?v=https://www.instagram.com/reel/CODE/'
      });
    }

    const result = await downloadInstagramVideo(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      developer: DEV_INFO 
    });
  }
});

// ============= POST ENDPOINTS =============
app.post('/api/insta', async (req, res) => {
  try {
    const url = req.body.p || req.body.url;
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide Instagram URL for images', 
        developer: DEV_INFO 
      });
    }
    const result = await downloadInstagramImage(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      developer: DEV_INFO 
    });
  }
});

app.post('/api/insta/video', async (req, res) => {
  try {
    const url = req.body.v || req.body.url;
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide Instagram video URL', 
        developer: DEV_INFO 
      });
    }
    const result = await downloadInstagramVideo(url);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      developer: DEV_INFO 
    });
  }
});

// ============= IMAGE DOWNLOADER =============
async function downloadInstagramImage(url) {
  try {
    // Clean URL
    url = url.split('?')[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    
    // Extract shortcode
    const shortcode = extractShortcode(url);
    if (!shortcode) throw new Error('Invalid Instagram URL');
    
    // Method 1: Using Instagram oEmbed API
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
    } catch (err) {}
    
    // Method 2: Using Instagram Graph API
    try {
      const response = await axios.get(`https://www.instagram.com/p/${shortcode}/?__a=1&__d=1`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const data = response.data.graphql.shortcode_media;
      const images = [];
      
      // Single image
      if (data.__typename === 'GraphImage' && data.display_url) {
        images.push({ url: data.display_url, quality: 'HD' });
      }
      
      // Carousel images
      if (data.__typename === 'GraphSidecar') {
        data.edge_sidecar_to_children.edges.forEach(edge => {
          if (edge.node.__typename === 'GraphImage') {
            images.push({ url: edge.node.display_url, quality: 'HD' });
          }
        });
      }
      
      if (images.length > 0) {
        return {
          title: data.edge_media_to_caption.edges[0]?.node?.text || 'Instagram Image',
          type: 'image',
          images: images,
          count: images.length,
          download_urls: images.map(img => img.url)
        };
      }
    } catch (err) {}
    
    throw new Error('No images found in this post');
    
  } catch (error) {
    throw new Error(`Image download failed: ${error.message}`);
  }
}

// ============= VIDEO DOWNLOADER - FIXED =============
async function downloadInstagramVideo(url) {
  try {
    // Clean URL
    url = url.split('?')[0];
    if (!url.startsWith('http')) url = 'https://' + url;
    
    console.log(`[Instagram Video] Processing: ${url}`);
    
    // Extract shortcode
    const shortcode = extractShortcode(url);
    if (!shortcode) throw new Error('Invalid Instagram URL');
    
    // ===== METHOD 1: Using saveclip.app API =====
    try {
      console.log('[Video] Trying saveclip.app API...');
      const response = await axios.post('https://saveclip.app/api/ajaxSearch', 
        new URLSearchParams({
          q: url,
          t: 'media',
          lang: 'en'
        }),
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://saveclip.app/'
          },
          timeout: 15000
        }
      );
      
      const data = response.data;
      if (data && data.data) {
        let videoUrl = null;
        if (data.data.video) videoUrl = data.data.video;
        if (!videoUrl && data.data[0] && data.data[0].video) videoUrl = data.data[0].video;
        
        if (videoUrl && !videoUrl.includes('.jpg')) {
          console.log('[Video] Found via saveclip.app');
          return {
            title: data.title || 'Instagram Reel',
            type: 'video',
            url: videoUrl,
            quality: 'HD',
            thumbnail: data.data.thumbnail || data.data[0]?.thumbnail,
            download_url: videoUrl
          };
        }
      }
    } catch (err) {
      console.log('[Video] saveclip.app failed:', err.message);
    }
    
    // ===== METHOD 2: Using insta-save.com API =====
    try {
      console.log('[Video] Trying insta-save.com API...');
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
        let videoUrl = null;
        if (data.data.video) videoUrl = data.data.video;
        if (!videoUrl && data.data[0] && data.data[0].video) videoUrl = data.data[0].video;
        
        if (videoUrl && !videoUrl.includes('.jpg')) {
          console.log('[Video] Found via insta-save.com');
          return {
            title: data.title || 'Instagram Reel',
            type: 'video',
            url: videoUrl,
            quality: 'HD',
            thumbnail: data.data.thumbnail,
            download_url: videoUrl
          };
        }
      }
    } catch (err) {
      console.log('[Video] insta-save.com failed:', err.message);
    }
    
    // ===== METHOD 3: Using Instagram Graph API directly =====
    try {
      console.log('[Video] Trying Instagram Graph API...');
      const response = await axios.get(`https://www.instagram.com/p/${shortcode}/?__a=1&__d=1`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        timeout: 15000
      });
      
      const media = response.data?.graphql?.shortcode_media;
      if (media) {
        // Check for video
        if (media.is_video && media.video_url) {
          console.log('[Video] Found via Graph API');
          return {
            title: media.edge_media_to_caption?.edges[0]?.node?.text || 'Instagram Reel',
            type: 'video',
            url: media.video_url,
            quality: 'HD',
            thumbnail: media.thumbnail_src,
            download_url: media.video_url
          };
        }
        
        // Check carousel for video
        if (media.__typename === 'GraphSidecar' && media.edge_sidecar_to_children) {
          for (const edge of media.edge_sidecar_to_children.edges) {
            if (edge.node.is_video && edge.node.video_url) {
              console.log('[Video] Found video in carousel');
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
      console.log('[Video] Graph API failed:', err.message);
    }
    
    // ===== METHOD 4: Using public downloader API =====
    try {
      console.log('[Video] Trying public downloader API...');
      const response = await axios.get(`https://api.tikwm.com/api/instagram?url=${encodeURIComponent(url)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      });
      
      if (response.data && response.data.data && response.data.data.play) {
        const videoUrl = response.data.data.play;
        if (videoUrl && !videoUrl.includes('.jpg')) {
          console.log('[Video] Found via tikwm API');
          return {
            title: response.data.data.title || 'Instagram Reel',
            type: 'video',
            url: videoUrl,
            quality: 'HD',
            thumbnail: response.data.data.cover,
            download_url: videoUrl
          };
        }
      }
    } catch (err) {
      console.log('[Video] Public API failed:', err.message);
    }
    
    // ===== METHOD 5: Direct page scraping =====
    try {
      console.log('[Video] Trying direct page scraping...');
      const response = await axios.get(`https://www.instagram.com/reel/${shortcode}/`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      });
      
      const html = response.data;
      
      // Look for video URL patterns
      const patterns = [
        /"video_url":"([^"]+)"/,
        /"video_versions":\[{"url":"([^"]+)"/,
        /https:\/\/[^"]+\.mp4[^"]*/,
        /https:\/\/scontent[^"]+\/video\/[^"]+/
      ];
      
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          let videoUrl = match[1] || match[0];
          videoUrl = videoUrl.replace(/\\u0026/g, '&');
          if (videoUrl && !videoUrl.includes('.jpg')) {
            console.log('[Video] Found via scraping');
            return {
              title: 'Instagram Reel',
              type: 'video',
              url: videoUrl,
              quality: 'HD',
              download_url: videoUrl
            };
          }
        }
      }
    } catch (err) {
      console.log('[Video] Scraping failed:', err.message);
    }
    
    throw new Error('Could not extract video URL. Make sure the reel is public and try again.');
    
  } catch (error) {
    throw new Error(`Video download failed: ${error.message}`);
  }
}

// ============= HELPER FUNCTION =============
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
