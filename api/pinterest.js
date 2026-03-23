const axios = require('axios');
const cheerio = require('cheerio');

class PinterestDownloader {
  async download(url) {
    try {
      // Clean URL
      url = this.cleanUrl(url);
      
      // Try multiple methods
      const methods = [
        () => this.downloadViaPinterestAPI(url),
        () => this.downloadViaPinterestWidget(url),
        () => this.downloadViaPinterestDL(url)
      ];
      
      for (const method of methods) {
        try {
          const result = await method();
          if (result && result.media) {
            return result;
          }
        } catch (err) {
          console.log(`Method failed: ${err.message}`);
          continue;
        }
      }
      
      throw new Error('Failed to fetch Pinterest content');
      
    } catch (error) {
      throw new Error(`Pinterest download failed: ${error.message}`);
    }
  }
  
  cleanUrl(url) {
    // Ensure https and remove tracking
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    return url.split('?')[0];
  }
  
  async downloadViaPinterestAPI(url) {
    // Extract pin ID
    const pinId = this.extractPinId(url);
    if (!pinId) {
      throw new Error('Invalid Pinterest URL');
    }
    
    // Use Pinterest's oEmbed endpoint
    const response = await axios.get(`https://www.pinterest.com/oembed/?url=${encodeURIComponent(url)}`);
    
    if (response.data && response.data.thumbnail_url) {
      return {
        title: response.data.title || 'Pinterest Pin',
        media: {
          type: 'image',
          url: response.data.thumbnail_url,
          quality: 'HD'
        },
        pin_id: pinId
      };
    }
    
    throw new Error('No media found');
  }
  
  extractPinId(url) {
    const patterns = [
      /pinterest\.com\/pin\/(\d+)/,
      /pin\.it\/([^\/]+)/,
      /pinterest\.com\/pin\/[^\/]+\/(\d+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }
  
  async downloadViaPinterestWidget(url) {
    const pinId = this.extractPinId(url);
    if (!pinId) {
      throw new Error('Invalid Pinterest URL');
    }
    
    // Use Pinterest widget API
    const response = await axios.get(`https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${pinId}`);
    
    if (response.data && response.data.data && response.data.data[0]) {
      const pin = response.data.data[0];
      let media;
      
      if (pin.video_url) {
        media = {
          type: 'video',
          url: pin.video_url,
          quality: 'HD'
        };
      } else if (pin.images && pin.images['orig']) {
        media = {
          type: 'image',
          url: pin.images['orig'].url,
          quality: 'HD'
        };
      } else {
        media = {
          type: 'image',
          url: pin.image_url,
          quality: 'HD'
        };
      }
      
      return {
        title: pin.title || pin.description || 'Pinterest Pin',
        description: pin.description,
        media: media,
        pin_id: pinId
      };
    }
    
    throw new Error('No media found via widget');
  }
  
  async downloadViaPinterestDL(url) {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Try to find video URL
    let videoUrl = null;
    let imageUrl = null;
    
    // Check for video source
    $('video source').each((i, el) => {
      const src = $(el).attr('src');
      if (src && src.includes('.mp4')) {
        videoUrl = src;
      }
    });
    
    // Check for video element
    if (!videoUrl) {
      $('video').each((i, el) => {
        const src = $(el).attr('src');
        if (src && src.includes('.mp4')) {
          videoUrl = src;
        }
      });
    }
    
    // If no video, get high-res image
    if (!videoUrl) {
      // Try to find original image
      $('img[src*="originals"]').each((i, el) => {
        const src = $(el).attr('src');
        if (src && !imageUrl) {
          imageUrl = src;
        }
      });
      
      if (!imageUrl) {
        imageUrl = $('meta[property="og:image"]').attr('content');
      }
    }
    
    if (videoUrl) {
      return {
        title: $('title').text().replace(' - Pinterest', ''),
        media: {
          type: 'video',
          url: videoUrl,
          quality: 'HD'
        }
      };
    } else if (imageUrl) {
      return {
        title: $('title').text().replace(' - Pinterest', ''),
        media: {
          type: 'image',
          url: imageUrl,
          quality: 'HD'
        }
      };
    }
    
    throw new Error('No media found');
  }
}

module.exports = new PinterestDownloader();
