const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(require('cors')());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Instagram Downloader
app.get('/api/insta', async (req, res) => {
  try {
    const url = req.query.p || req.query.url;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Please provide Instagram URL using ?p= parameter'
      });
    }

    const result = await downloadInstagram(url);
    
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

app.post('/api/insta', async (req, res) => {
  try {
    const url = req.body.p || req.body.url;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Please provide Instagram URL'
      });
    }

    const result = await downloadInstagram(url);
    
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

async function downloadInstagram(url) {
  try {
    // Clean URL
    url = url.split('?')[0];
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    // Fetch the page
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract media
    const media = [];
    
    // Check for video
    const videoUrl = $('meta[property="og:video"]').attr('content') || 
                     $('meta[property="og:video:url"]').attr('content');
    
    if (videoUrl) {
      media.push({
        type: 'video',
        url: videoUrl,
        quality: 'HD'
      });
    }
    
    // Check for images
    const imageUrl = $('meta[property="og:image"]').attr('content');
    if (imageUrl && !videoUrl) {
      media.push({
        type: 'image',
        url: imageUrl,
        quality: 'HD'
      });
    }
    
    // Check for carousel
    $('meta[property="og:image:secure_url"]').each((i, el) => {
      const imgUrl = $(el).attr('content');
      if (imgUrl && !media.some(m => m.url === imgUrl)) {
        media.push({
          type: 'image',
          url: imgUrl,
          quality: 'HD'
        });
      }
    });
    
    const title = $('meta[property="og:title"]').attr('content') || 
                  $('title').text() || 
                  'Instagram Media';
    
    if (media.length === 0) {
      throw new Error('No media found in this post');
    }
    
    return {
      title: title,
      media: media,
      url: url,
      count: media.length
    };
    
  } catch (error) {
    throw new Error(`Instagram download failed: ${error.message}`);
  }
}

module.exports = app;
