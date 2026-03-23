const axios = require('axios');
const cheerio = require('cheerio');

class InstagramDownloader {
  async download(url) {
    try {
      // Clean URL
      url = this.cleanUrl(url);
      
      // Try multiple methods
      const methods = [
        () => this.downloadViaInstagramAPI(url),
        () => this.downloadViaSaveFrom(url),
        () => this.downloadViaInstagramDL(url)
      ];
      
      for (const method of methods) {
        try {
          const result = await method();
          if (result && result.media && result.media.length > 0) {
            return result;
          }
        } catch (err) {
          console.log(`Method failed: ${err.message}`);
          continue;
        }
      }
      
      throw new Error('Failed to fetch Instagram content');
      
    } catch (error) {
      throw new Error(`Instagram download failed: ${error.message}`);
    }
  }
  
  cleanUrl(url) {
    // Remove tracking parameters
    url = url.split('?')[0];
    // Ensure https
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    return url;
  }
  
  async downloadViaInstagramAPI(url) {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract video URL from meta tags
    const videoMeta = $('meta[property="og:video"]').attr('content');
    const videoUrl = videoMeta || $('meta[property="og:video:url"]').attr('content');
    
    // Extract image URL
    const imageMeta = $('meta[property="og:image"]').attr('content');
    
    // Extract title/caption
    const title = $('meta[property="og:title"]').attr('content') || 
                  $('meta[name="description"]').attr('content') || 
                  'Instagram Post';
    
    const media = [];
    
    if (videoUrl) {
      media.push({
        type: 'video',
        url: videoUrl,
        quality: 'HD'
      });
    }
    
    if (imageMeta && !videoUrl) {
      media.push({
        type: 'image',
        url: imageMeta,
        quality: 'HD'
      });
    }
    
    // Check for carousel items
    const carouselItems = [];
    $('meta[property="og:image:secure_url"]').each((i, el) => {
      const imgUrl = $(el).attr('content');
      if (imgUrl && !carouselItems.includes(imgUrl)) {
        carouselItems.push(imgUrl);
      }
    });
    
    if (carouselItems.length > 0 && !videoUrl) {
      carouselItems.forEach(imgUrl => {
        media.push({
          type: 'image',
          url: imgUrl,
          quality: 'HD'
        });
      });
    }
    
    return {
      title: title,
      media: media,
      url: url
    };
  }
  
  async downloadViaSaveFrom(url) {
    const response = await axios.post('https://en.savefrom.net/1-ajax/', 
      new URLSearchParams({
        url: url,
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
        title: response.data.meta?.title || 'Instagram Media',
        media: [{
          type: response.data.url.includes('.mp4') ? 'video' : 'image',
          url: response.data.url,
          quality: 'HD'
        }],
        url: url
      };
    }
    
    throw new Error('No download URL found');
  }
  
  async downloadViaInstagramDL(url) {
    // Using public instagram-dl API
    const apiUrls = [
      `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`,
      `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=YOUR_ACCESS_TOKEN`
    ];
    
    for (const apiUrl of apiUrls) {
      try {
        const response = await axios.get(apiUrl);
        if (response.data && response.data.thumbnail_url) {
          return {
            title: response.data.title || 'Instagram Media',
            media: [{
              type: 'image',
              url: response.data.thumbnail_url,
              quality: 'HD'
            }],
            url: url
          };
        }
      } catch (err) {
        continue;
      }
    }
    
    throw new Error('Failed via Instagram DL');
  }
}

module.exports = new InstagramDownloader();
