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
    // Using yt5s.com (working)
    const formData = new URLSearchParams();
    formData.append('url', `https://www.youtube.com/watch?v=${videoId}`);
    formData.append('ajax', '1');
    
    const response = await axios.post('https://yt5s.com/api/ajaxSearch', formData, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://yt5s.com/'
      },
      timeout: 20000
    });
    
    const data = response.data;
    
    if (data && data.links && data.links.mp4) {
      const videos = [];
      
      // Get all available qualities
      const qualities = {
        '1080p': data.links.mp4['1080p'],
        '720p': data.links.mp4['720p'],
        '480p': data.links.mp4['480p'],
        '360p': data.links.mp4['360p'],
        '240p': data.links.mp4['240p']
      };
      
      for (const [quality, link] of Object.entries(qualities)) {
        if (link && link.k && link.k !== '') {
          // Get download URL
          const convertResponse = await axios.post('https://yt5s.com/api/ajaxConvert', 
            new URLSearchParams({
              vid: data.vid,
              k: link.k
            }),
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            }
          );
          
          if (convertResponse.data && convertResponse.data.dlink) {
            videos.push({
              quality: quality,
              url: convertResponse.data.dlink,
              type: 'video'
            });
          }
        }
      }
      
      if (videos.length > 0) {
        return {
          title: data.title || 'YouTube Video',
          thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          videoId: videoId,
          videos: videos
        };
      }
    }
    
    throw new Error('No video links found');
    
  } catch (error) {
    console.log('Primary method failed, trying backup...');
    
    // Backup method using y2mate
    try {
      const response = await axios.get(`https://www.y2mate.com/mates/en${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const html = response.data;
      const kMatch = html.match(/var k__id = "([^"]+)"/);
      const kId = kMatch ? kMatch[1] : null;
      
      if (kId) {
        const convertResponse = await axios.post('https://www.y2mate.com/mates/convert', 
          new URLSearchParams({
            type: 'youtube',
            _id: kId,
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
          return {
            title: 'YouTube Video',
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            videoId: videoId,
            videos: [{
              quality: 'HD',
              url: convertResponse.data.dlink,
              type: 'video'
            }]
          };
        }
      }
    } catch (backupError) {
      console.log('Backup method failed:', backupError.message);
    }
    
    throw new Error('Failed to get video download links');
  }
}

module.exports = app;
