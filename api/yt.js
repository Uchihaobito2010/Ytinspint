const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(require('cors')());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// YouTube Downloader
app.get('/api/yt', async (req, res) => {
  try {
    const url = req.query.p || req.query.url;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Please provide video URL using ?p= parameter'
      });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL'
      });
    }

    const result = await downloadYouTube(videoId);
    
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

app.post('/api/yt', async (req, res) => {
  try {
    const url = req.body.p || req.body.url;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Please provide video URL'
      });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL'
      });
    }

    const result = await downloadYouTube(videoId);
    
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
    // Try multiple invidious instances
    const invidiousUrls = [
      'https://invidious.snopyta.org',
      'https://yewtu.be',
      'https://inv.riverside.rocks'
    ];
    
    for (const baseUrl of invidiousUrls) {
      try {
        const response = await axios.get(`${baseUrl}/api/v1/videos/${videoId}`, {
          timeout: 10000
        });
        const data = response.data;
        
        const formats = [];
        if (data.formatStreams) {
          data.formatStreams.forEach(stream => {
            if (stream.type === 'video/mp4' || stream.type === 'video/webm') {
              formats.push({
                quality: stream.qualityLabel || stream.quality,
                type: 'video',
                url: stream.url,
                size: stream.size || 'Unknown'
              });
            }
          });
        }
        
        return {
          title: data.title,
          duration: data.lengthSeconds,
          views: data.viewCount,
          thumbnail: data.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          videos: formats,
          audio: data.adaptiveFormats?.find(f => f.type?.includes('audio'))?.url || null
        };
      } catch (err) {
        continue;
      }
    }
    
    throw new Error('Failed to fetch video data');
  } catch (error) {
    throw new Error(`YouTube download failed: ${error.message}`);
  }
}

module.exports = app;
