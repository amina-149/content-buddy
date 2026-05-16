const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('mongo-sanitize');
const validator = require('validator');

const app = express();

// Hash admin password once at boot
let ADMIN_PASSWORD_HASH;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
(async () => {
  if (!ADMIN_PASSWORD) {
    console.error('FATAL: ADMIN_PASSWORD env var not set');
    process.exit(1);
  }
  ADMIN_PASSWORD_HASH = await bcrypt.hash(ADMIN_PASSWORD, 12);
  console.log('Admin password hashed at boot');
})();

app.use(helmet());
app.use(mongoSanitize());
app.use(express.json({ limit: '10kb' }));
app.use(express.static('public'));

const JWT_SECRET = process.env.JWT_SECRET;
const NODE_ENV = process.env.NODE_ENV || 'development';

const downloadDir = path.join(os.homedir(), 'Downloads', 'YouTubeVideos');
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true });
}

const downloadsLogFile = path.join(os.homedir(), '.ytdownloader', 'downloads.json');
const statsFile = path.join(os.homedir(), '.ytdownloader', 'stats.json');
const errorsLogFile = path.join(os.homedir(), '.ytdownloader', 'errors.json');

const logDir = path.dirname(downloadsLogFile);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

if (!fs.existsSync(downloadsLogFile)) {
  fs.writeFileSync(downloadsLogFile, JSON.stringify([]));
}
if (!fs.existsSync(statsFile)) {
  fs.writeFileSync(statsFile, JSON.stringify({ totalDownloads: 0, totalDataTransferred: 0, successRate: 100 }));
}
if (!fs.existsSync(errorsLogFile)) {
  fs.writeFileSync(errorsLogFile, JSON.stringify([]));
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => NODE_ENV === 'development'
});

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many downloads, please wait before trying again',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => NODE_ENV === 'development'
});

function logError(error, type, url = '') {
  try {
    const errors = JSON.parse(fs.readFileSync(errorsLogFile, 'utf8'));
    errors.push({
      timestamp: new Date().toISOString(),
      type,
      message: error.message,
      url,
      stack: NODE_ENV === 'development' ? error.stack : undefined
    });
    fs.writeFileSync(errorsLogFile, JSON.stringify(errors.slice(-1000), null, 2));
  } catch (e) {
    console.error('Error logging:', e);
  }
}

function getDownloadStats() {
  try {
    return JSON.parse(fs.readFileSync(statsFile, 'utf8'));
  } catch {
    return { totalDownloads: 0, totalDataTransferred: 0, successRate: 100 };
  }
}

function updateStats(dataSize) {
  try {
    const stats = getDownloadStats();
    stats.totalDownloads = (stats.totalDownloads || 0) + 1;
    stats.totalDataTransferred = (stats.totalDataTransferred || 0) + (dataSize || 0);
    stats.lastUpdated = new Date().toISOString();
    fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
  } catch (e) {
    console.error('Error updating stats:', e);
  }
}

function logDownload(title, url, quality, type = 'video', size = 0, subtitles = false, success = true) {
  try {
    const downloads = JSON.parse(fs.readFileSync(downloadsLogFile, 'utf8'));
    downloads.push({
      id: Date.now(),
      title: validator.escape(title),
      url: validator.escape(url),
      quality,
      type,
      size,
      subtitles,
      success,
      timestamp: new Date().toISOString(),
      ipAddress: 'hidden-for-privacy',
      userAgent: 'hidden-for-privacy'
    });
    fs.writeFileSync(downloadsLogFile, JSON.stringify(downloads.slice(-10000), null, 2));
  } catch (e) {
    console.error('Error logging download:', e);
  }
}

function isValidYouTubeUrl(url) {
  const youtubeRegex = /(youtube\.com|youtu\.be)\/(watch|playlist|channel|c|@)?/;
  return youtubeRegex.test(url);
}

function parseQuality(quality) {
  const qualityMap = {
    'best': 'bestvideo+bestaudio/best',
    'high': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
    'medium': 'bestvideo[height<=480]+bestaudio/best[height<=480]',
    'low': 'bestvideo[height<=360]+bestaudio/best[height<=360]',
    'audio': 'bestaudio/best',
    'worst': 'worst'
  };
  return qualityMap[quality] || qualityMap['best'];
}

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const process = spawn('yt-dlp', args);
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
      }
    });

    setTimeout(() => {
      process.kill();
      reject(new Error('Download timeout: took too long to complete'));
    }, 300000);
  });
}

app.post('/api/admin/login', loginLimiter, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password required',
        errorCode: 'MISSING_PASSWORD'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

    if (!isPasswordValid) {
      logError(new Error('Failed admin login attempt'), 'AUTH_FAILURE');
      return res.status(401).json({
        success: false,
        error: 'Invalid password',
        errorCode: 'INVALID_PASSWORD'
      });
    }

    const token = jwt.sign(
      { role: 'admin', loginTime: new Date() },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      expiresIn: 86400
    });
  } catch (error) {
    logError(error, 'AUTH_ERROR');
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      errorCode: 'AUTH_ERROR'
    });
  }
});

function verifyAdminToken(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No authentication token provided',
        errorCode: 'NO_TOKEN'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        errorCode: 'FORBIDDEN'
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please login again.',
        errorCode: 'TOKEN_EXPIRED'
      });
    }

    res.status(401).json({
      success: false,
      error: 'Invalid authentication token',
      errorCode: 'INVALID_TOKEN'
    });
  }
}

app.post('/api/download', downloadLimiter, async (req, res) => {
  try {
    const { url, quality = 'best', subtitles = false } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid URL',
        errorCode: 'INVALID_URL'
      });
    }

    if (!isValidYouTubeUrl(url)) {
      logError(new Error('Invalid YouTube URL'), 'INVALID_URL_FORMAT', url);
      return res.status(400).json({
        success: false,
        error: 'This doesn\'t look like a YouTube link. Make sure you copied it from YouTube.',
        errorCode: 'NOT_YOUTUBE_URL'
      });
    }

    const qualityFormat = parseQuality(quality);
    const args = [
      url,
      '-o', path.join(downloadDir, '%(title)s.%(ext)s'),
      '-f', qualityFormat,
      '--no-warnings'
    ];

    if (subtitles) {
      args.push('--write-subs', '--sub-langs', 'en.*,es.*,fr.*,de.*,it.*,pt.*,ja.*,zh.*');
    }

    const output = await runYtDlp(args);

    if (!output) {
      throw new Error('Download completed but no output received');
    }

    logDownload('Downloaded from ' + url, url, quality, 'video', 0, subtitles, true);
    updateStats(0);

    res.json({
      success: true,
      message: subtitles ? 'Video and subtitles downloaded successfully!' : 'Video downloaded successfully!',
      downloadDir
    });
  } catch (error) {
    let errorCode = 'UNKNOWN_ERROR';
    let userMessage = 'An error occurred during download. Please try again.';

    if (error.message.includes('Video unavailable')) {
      errorCode = 'VIDEO_NOT_FOUND';
      userMessage = 'This video has been deleted or is no longer available. Try checking if the link works in your browser.';
    } else if (error.message.includes('private')) {
      errorCode = 'PRIVATE_VIDEO';
      userMessage = 'This video is private or unlisted. Only the creator can download it.';
    } else if (error.message.includes('age')) {
      errorCode = 'AGE_RESTRICTED';
      userMessage = 'This video is age-restricted (18+). Try downloading it from a different device.';
    } else if (error.message.includes('yt-dlp') || error.message.includes('command')) {
      errorCode = 'QUALITY_UNAVAILABLE';
      userMessage = 'The selected quality isn\'t available for this video. Downloading the best available quality instead.';
    } else if (error.message.includes('timeout')) {
      errorCode = 'DOWNLOAD_TIMEOUT';
      userMessage = 'Download took too long. The video might be too large or your connection is slow. Try again with a lower quality.';
    }

    logError(error, errorCode, req.body.url);
    logDownload(req.body.url, req.body.url, req.body.quality, 'video', 0, false, false);

    res.status(400).json({
      success: false,
      error: userMessage,
      errorCode
    });
  }
});

app.post('/api/download-playlist', downloadLimiter, async (req, res) => {
  try {
    const { url, quality = 'best', limit = 50, subtitles = false } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid URL',
        errorCode: 'INVALID_URL'
      });
    }

    if (limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Playlist limit is 100 videos maximum. You can download another batch after.',
        errorCode: 'PLAYLIST_TOO_LARGE'
      });
    }

    if (!url.includes('playlist')) {
      return res.status(400).json({
        success: false,
        error: 'This URL doesn\'t look like a playlist. Make sure it\'s a YouTube playlist link.',
        errorCode: 'NOT_PLAYLIST'
      });
    }

    const qualityFormat = parseQuality(quality);
    const args = [
      url,
      '-o', path.join(downloadDir, 'playlist/%(title)s.%(ext)s'),
      '-f', qualityFormat,
      `--playlist-items=1-${limit}`,
      '--no-warnings'
    ];

    if (subtitles) {
      args.push('--write-subs', '--sub-langs', 'en.*,es.*,fr.*');
    }

    const output = await runYtDlp(args);

    logDownload('Playlist (' + limit + ' videos)', url, quality, 'playlist', 0, subtitles, true);
    updateStats(0);

    res.json({
      success: true,
      message: `Downloaded ${limit} videos from playlist!${subtitles ? ' Subtitles included.' : ''}`,
      downloadDir
    });
  } catch (error) {
    let errorCode = 'UNKNOWN_ERROR';
    let userMessage = 'Failed to download playlist. Please try again.';

    if (error.message.includes('does not exist')) {
      errorCode = 'PLAYLIST_NOT_FOUND';
      userMessage = 'This playlist doesn\'t exist or is private. Check if the link is correct.';
    }

    logError(error, errorCode, url);
    res.status(400).json({
      success: false,
      error: userMessage,
      errorCode
    });
  }
});

app.get('/api/admin/stats', verifyAdminToken, (req, res) => {
  try {
    const stats = getDownloadStats();
    const downloads = JSON.parse(fs.readFileSync(downloadsLogFile, 'utf8'));
    const errors = JSON.parse(fs.readFileSync(errorsLogFile, 'utf8'));

    const today = new Date().toDateString();
    const todayDownloads = downloads.filter(d => new Date(d.timestamp).toDateString() === today).length;

    const downloadsByType = {
      video: downloads.filter(d => d.type === 'video' && d.success).length,
      playlist: downloads.filter(d => d.type === 'playlist' && d.success).length,
      failed: downloads.filter(d => !d.success).length
    };

    const topErrors = {};
    errors.slice(-1000).forEach(e => {
      topErrors[e.type] = (topErrors[e.type] || 0) + 1;
    });

    res.json({
      success: true,
      stats: {
        totalDownloads: stats.totalDownloads,
        totalDataTransferred: (stats.totalDataTransferred / 1024 / 1024 / 1024).toFixed(2) + ' GB',
        successRate: ((downloads.filter(d => d.success).length / downloads.length) * 100).toFixed(1) + '%',
        todayDownloads,
        downloadsByType,
        topErrors: Object.entries(topErrors)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([type, count]) => ({ type, count })),
        totalUsers: new Set(downloads.map(d => d.ipAddress)).size,
        averageDownloadSize: downloads.length > 0 
          ? (downloads.reduce((sum, d) => sum + d.size, 0) / downloads.length / 1024 / 1024).toFixed(2) + ' MB'
          : '0 MB'
      }
    });
  } catch (error) {
    logError(error, 'STATS_ERROR');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics',
      errorCode: 'STATS_ERROR'
    });
  }
});

app.get('/api/admin/downloads', verifyAdminToken, (req, res) => {
  try {
    const downloads = JSON.parse(fs.readFileSync(downloadsLogFile, 'utf8'));
    const { limit = 100, offset = 0 } = req.query;

    const paginated = downloads
      .reverse()
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      downloads: paginated,
      total: downloads.length
    });
  } catch (error) {
    logError(error, 'DOWNLOADS_FETCH_ERROR');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve downloads',
      errorCode: 'DOWNLOADS_FETCH_ERROR'
    });
  }
});

app.get('/api/admin/errors', verifyAdminToken, (req, res) => {
  try {
    const errors = JSON.parse(fs.readFileSync(errorsLogFile, 'utf8'));
    const { limit = 100, offset = 0 } = req.query;

    const paginated = errors
      .reverse()
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      errors: paginated,
      total: errors.length
    });
  } catch (error) {
    logError(error, 'ERRORS_FETCH_ERROR');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve errors',
      errorCode: 'ERRORS_FETCH_ERROR'
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Boot guard for JWT_SECRET
const DEFAULT_SECRET = 'your-secret-key-change-in-production';

if (!JWT_SECRET || JWT_SECRET === DEFAULT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set or is the default placeholder.');
  console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

const JWT_SECRET_VALUE = JWT_SECRET;
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Downloads saved to: ${downloadDir}`);
  console.log(`🔐 JWT Secret: ${JWT_SECRET_VALUE === DEFAULT_SECRET ? '⚠️  CHANGE IN PRODUCTION' : '✅ Configured'}`);
  console.log(`🔑 Admin password: ${ADMIN_PASSWORD === 'admin123' ? '⚠️  CHANGE IN PRODUCTION' : '✅ Configured'}\n`);
});

module.exports = app;
