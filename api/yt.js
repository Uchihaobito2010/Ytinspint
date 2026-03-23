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
      return res.status(400).json({ success: false, error: 'Please provide video URL using ?p= parameter', developer: DEV_INFO });
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
    // Using multiple working download APIs
    const methods = [
      () => downloadViaY2mate(videoId),
      () => downloadViaYt1s(videoId),
      () => downloadViaSaveFrom(videoId)
    ];
    
    for (const method of methods) {
      try {
        const result = await method();
        if (result && result.videos && result.videos.length > 0) {
          return result;
        }
      } catch (err) {
        console.log(`Method failed: ${err.message}`);
        continue;
      }
    }
    
    throw new Error('No video URLs found');
  } catch (error) {
    throw new Error(`Download failed: ${error.message}`);
  }
}

async function downloadViaY2mate(videoId) {
  try {
    // Get video page
    const response = await axios.get(`https://www.y2mate.com/mates/analyze/ajax`, {
      params: {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        q_auto: 1,
        ajax: 1
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.y2mate.com/'
      }
    });
    
    if (response.data && response.data.result) {
      const html = response.data.result;
      const titleMatch = html.match(/<div class="caption">(.+?)<\/div>/);
      const title = titleMatch ? titleMatch[1] : 'YouTube Video';
      
      // Extract video URLs
      const videoUrls = [];
      const mp4Matches = html.match(/<a[^>]*href="([^"]+mp4[^"]+)"[^>]*>/gi);
      
      if (mp4Matches) {
        mp4Matches.forEach(match => {
          const urlMatch = match.match(/href="([^"]+)"/);
          if (urlMatch) {
            let url = urlMatch[1];
            url = url.replace(/\\/g, '');
            videoUrls.push({
              quality: 'HD',
              url: url,
              type: 'video'
            });
          }
        });
      }
      
      return {
        title: title,
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        videoId: videoId,
        videos: videoUrls
      };
    }
    throw new Error('No data from y2mate');
  } catch (error) {
    console.log('Y2mate error:', error.message);
    throw error;
  }
}

async function downloadViaYt1s(videoId) {
  try {
    const formData = new URLSearchParams();
    formData.append('url', `https://www.youtube.com/watch?v=${videoId}`);
    formData.append('q_auto', '0');
    formData.append('ajax', '1');
    
    const response = await axios.post('https://yt1s.com/api/ajaxSearch/index', formData, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (response.data && response.data.links) {
      const videos = [];
      const mp4Links = response.data.links.mp4;
      
      for (const [quality, link] of Object.entries(mp4Links)) {
        if (link && link.k && link.k !== '') {
          videos.push({
            quality: quality,
            url: `https://yt1s.com/api/ajaxConvert/convert?vid=${response.data.vid}&k=${link.k}`,
            type: 'video'
          });
        }
      }
      
      return {
        title: response.data.title || 'YouTube Video',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        videoId: videoId,
        videos: videos
      };
    }
    throw new Error('No links found');
  } catch (error) {
    console.log('Yt1s error:', error.message);
    throw error;
  }
}

async function downloadViaSaveFrom(videoId) {
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
        }
      }
    );
    
    if (response.data && response.data.url) {
      return {
        title: response.data.meta?.title || 'YouTube Video',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        videoId: videoId,
        videos: [{
          quality: 'HD',
          url: response.data.url,
          type: 'video'
        }]
      };
    }
    throw new Error('No URL found');
  } catch (error) {
    console.log('SaveFrom error:', error.message);
    throw error;
  }
}

module.exports = app;
