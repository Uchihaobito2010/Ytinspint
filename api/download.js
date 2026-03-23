const express = require('express');
const cors = require('cors');
const pinterestDownloader = require('./pinterest');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/api/download', async (req, res) => {
  try {
    const { url, platform } = req.body;

    if (!url) {
      return res.status(400).json({ 
        error: 'URL is required',
        success: false 
      });
    }

    let result;
    
    // Auto-detect platform if not specified
    let detectedPlatform = platform;
    if (!detectedPlatform) {
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        detectedPlatform = 'youtube';
      } else if (url.includes('instagram.com')) {
        detectedPlatform = 'instagram';
      } else if (url.includes('pinterest.com') || url.includes('pin.it')) {
        detectedPlatform = 'pinterest';
      } else {
        return res.status(400).json({
          error: 'Unsupported platform. Please specify platform or use a supported URL',
          success: false
        });
      }
    }

    // Route to appropriate downloader
    switch (detectedPlatform.toLowerCase()) {
      case 'youtube':
        result = await youtubeDownloader.download(url);
        break;
      case 'instagram':
        result = await instagramDownloader.download(url);
        break;
      case 'pinterest':
        result = await pinterestDownloader.download(url);
        break;
      default:
        return res.status(400).json({
          error: 'Unsupported platform',
          success: false
        });
    }

    res.json({
      success: true,
      data: result,
      platform: detectedPlatform
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to download content'
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    platforms: ['youtube', 'instagram', 'pinterest'],
    version: '1.0.0'
  });
});

app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

module.exports = app;
