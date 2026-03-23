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

// YouTube Downloader
app.get('/api/yt', async (req, res) => {
  try {
    const url = req.query.p || req.query.url;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Please provide video URL using ?p= parameter',
        developer: DEV_INFO
      });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL',
        developer: DEV_INFO
      });
    }

    const result = await downloadYouTube(videoId);
    
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

app.post('/api/yt', async (req, res) => {
  try {
    const url = req.body.p || req.body.url;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Please provide video URL',
        developer: DEV_INFO
      });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL',
        developer: DEV_INFO
      });
    }

    const result = await downloadYouTube(videoId);
    
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

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function downloadYouTube(videoId) {
  try {
    // Method 1: Using y2mate
    const downloadUrl = await getY2mateDownload(videoId);
    
    // Method 2: Using savefrom.net
    let savefromUrl = null;
    if (!downloadUrl) {
      savefromUrl = await getSaveFromDownload(videoId);
    }
    
    const videos = [];
    
    if (downloadUrl) {
      videos.push({
        quality: 'HD (720p/1080p)',
        type: 'video',
        url: downloadUrl,
        source: 'y2mate'
      });
    }
    
    if (savefromUrl) {
      videos.push({
        quality: 'HD',
        type: 'video',
        url: savefromUrl,
        source: 'savefrom'
      });
    }
    
    if (videos.length === 0) {
      throw new Error('No video URLs found. The video might be private or age-restricted.');
    }
    
    return {
      title: 'YouTube Video',
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      videoId: videoId,
      videos: videos
    };
    
  } catch (error) {
    console.error('Download error:', error.message);
    throw new Error(`Failed to download: ${error.message}`);
  }
}

async function getY2mateDownload(videoId) {
  try {
    const response = await axios.get(`https://www.y2mate.com/mates/en${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    
    const html = response.data;
    const k_match = html.match(/var k__id = "([^"]+)"/);
    const k_id = k_match ? k_match[1] : null;
    
    if (k_id) {
      const convertResponse = await axios.post('https://www.y2mate.com/mates/convert', 
        new URLSearchParams({
          type: 'youtube',
          _id: k_id,
          v_id: videoId,
          ajax: '1',
          token: '',
          ftype: 'mp4',
          fquality: '360'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      
      if (convertResponse.data && convertResponse.data.dlink) {
        return convertResponse.data.dlink;
      }
    }
    
    return null;
  } catch (error) {
    console.log('Y2mate failed:', error.message);
    return null;
  }
}

async function getSaveFromDownload(videoId) {
  try {
    const response = await axios.post('https://en.savefrom.net/1-ajax/', 
      new URLSearchParams({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        ajax: '1'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      }
    );
    
    if (response.data && response.data.url) {
      return response.data.url;
    }
    
    return null;
  } catch (error) {
    console.log('SaveFrom failed:', error.message);
    return null;
  }
}

module.exports = app;
