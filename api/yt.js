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

app.get('/api/yt', async (req, res) => {
  try {
    const url = req.query.p || req.query.url;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Please provide video URL', developer: DEV_INFO });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ success: false, error: 'Invalid YouTube URL', developer: DEV_INFO });
    }

    const result = await downloadYouTube(videoId);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, developer: DEV_INFO });
  }
});

app.post('/api/yt', async (req, res) => {
  try {
    const url = req.body.p || req.body.url;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Please provide video URL', developer: DEV_INFO });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ success: false, error: 'Invalid YouTube URL', developer: DEV_INFO });
    }

    const result = await downloadYouTube(videoId);
    res.json({ success: true, data: result, developer: DEV_INFO });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, developer: DEV_INFO });
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
    // Using multiple working download services
    const services = [
      { name: 'yt5s', url: 'https://yt5s.com/api/ajaxSearch' },
      { name: 'yt1s', url: 'https://yt1s.com/api/ajaxSearch/index' },
      { name: 'y2mate', url: 'https://www.y2mate.com/mates/analyze/ajax' }
    ];
    
    for (const service of services) {
      try {
        const result = await tryDownloadService(service, videoId);
        if (result && result.videos && result.videos.length > 0) {
          return result;
        }
      } catch (err) {
        console.log(`${service.name} failed:`, err.message);
        continue;
      }
    }
    
    throw new Error('No video URLs found. The video might be private or age-restricted.');
  } catch (error) {
    throw new Error(`Failed to download: ${error.message}`);
  }
}

async function tryDownloadService(service, videoId) {
  const formData = new URLSearchParams();
  formData.append('url', `https://www.youtube.com/watch?v=${videoId}`);
  formData.append('ajax', '1');
  
  const response = await axios.post(service.url, formData, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    timeout: 15000
  });
  
  const data = response.data;
  const videos = [];
  
  // Parse different response formats
  if (data.links && data.links.mp4) {
    for (const [quality, link] of Object.entries(data.links.mp4)) {
      if (link && link.k) {
        videos.push({
          quality: quality,
          url: `https://yt5s.com/api/ajaxConvert/convert?vid=${data.vid}&k=${link.k}`,
          type: 'video'
        });
      }
    }
  } else if (data.result) {
    // Parse HTML result for video URLs
    const html = data.result;
    const urlMatches = html.match(/href="([^"]+\.mp4[^"]+)"/gi);
    if (urlMatches) {
      urlMatches.forEach(match => {
        const urlMatch = match.match(/href="([^"]+)"/);
        if (urlMatch) {
          videos.push({
            quality: 'HD',
            url: urlMatch[1],
            type: 'video'
          });
        }
      });
    }
  }
  
  if (videos.length === 0) {
    throw new Error('No video URLs found');
  }
  
  return {
    title: data.title || data.meta?.title || 'YouTube Video',
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    videoId: videoId,
    videos: videos
  };
}

module.exports = app;
