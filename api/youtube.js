const axios = require('axios');
const cheerio = require('cheerio');

class YouTubeDownloader {
  async download(url) {
    try {
      // Extract video ID
      const videoId = this.extractVideoId(url);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      // Use multiple public APIs as fallbacks
      const methods = [
        () => this.downloadViaY2mate(videoId),
        () => this.downloadViaSaveFrom(videoId),
        () => this.downloadViaYouTubeAPI(videoId)
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

      throw new Error('Failed to fetch video data from all sources');

    } catch (error) {
      throw new Error(`YouTube download failed: ${error.message}`);
    }
  }

  extractVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?#]+)/,
      /youtube\.com\/shorts\/([^/?]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  async downloadViaY2mate(videoId) {
    const response = await axios.get(`https://www.y2mate.com/mates/en${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const title = $('title').text().replace(' - YouTube', '');
    
    // Extract video formats
    const formats = [];
    $('a[data-quality]').each((i, el) => {
      const quality = $(el).data('quality');
      const url = $(el).attr('href');
      if (url && quality) {
        formats.push({
          quality: quality,
          type: 'video',
          url: url
        });
      }
    });
    
    return {
      title: title,
      duration: $('meta[property="video:duration"]').attr('content') || 'Unknown',
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      videos: formats,
      audios: []
    };
  }

  async downloadViaSaveFrom(videoId) {
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
        videos: [
          {
            quality: 'HD',
            type: 'video',
            url: response.data.url
          }
        ],
        audios: []
      };
    }
    
    throw new Error('No download URL found');
  }

  async downloadViaYouTubeAPI(videoId) {
    // Using invidious/alternative YouTube API
    const invidiousUrls = [
      'https://invidious.snopyta.org',
      'https://yewtu.be',
      'https://inv.riverside.rocks'
    ];
    
    for (const baseUrl of invidiousUrls) {
      try {
        const response = await axios.get(`${baseUrl}/api/v1/videos/${videoId}`);
        const data = response.data;
        
        const formats = [];
        if (data.formatStreams) {
          data.formatStreams.forEach(stream => {
            if (stream.type === 'video/mp4') {
              formats.push({
                quality: stream.qualityLabel || stream.quality,
                type: 'video',
                url: stream.url
              });
            }
          });
        }
        
        return {
          title: data.title,
          duration: data.lengthSeconds,
          thumbnail: data.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          videos: formats,
          audios: []
        };
      } catch (err) {
        continue;
      }
    }
    
    throw new Error('Failed to fetch via YouTube API');
  }
}

module.exports = new YouTubeDownloader();
