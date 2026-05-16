# YouTube Video Downloader - Setup Guide

A modern, industrial-styled web application for downloading YouTube videos using yt-dlp.

## Features

✨ **Download Modes:**
- **Popular Videos**: Get the most viewed videos from a channel (sorted by views)
- **Recent Videos**: Get the latest uploads from a channel
- **Specific Video**: Download a single video by direct link

📊 **Video Information:**
- View counts
- Video duration
- Upload date
- Thumbnail previews

⚡ **Batch Operations:**
- Download multiple videos at once
- Customizable limits (1-100 videos)

## Prerequisites

- **Node.js** (v14 or higher)
- **yt-dlp** installed on your system
- **npm** or **yarn** for package management

## Installation

### 1. Install yt-dlp

**On macOS:**
```bash
brew install yt-dlp
```

**On Ubuntu/Debian:**
```bash
sudo apt install yt-dlp
```

**On Windows (with Chocolatey):**
```bash
choco install yt-dlp
```

**Or using pip (any OS):**
```bash
pip install yt-dlp
```

### 2. Setup Node.js Project

```bash
# Create project directory
mkdir youtube-downloader
cd youtube-downloader

# Initialize npm
npm init -y

# Install dependencies
npm install express cors
```

### 3. Create Backend File

Copy the `app.js` file into your project directory.

## Running the Application

### Start the Backend Server

```bash
node app.js
```

You should see:
```
Server running on http://localhost:3000
Downloads will be saved to: /Users/yourname/Downloads/YouTubeVideos
```

### Open the Frontend

The HTML frontend can be:
1. **Saved as an HTML file** and opened in your browser
2. **Served by the Express server** (modify app.js to serve static files)
3. **Used as provided** in the Claude chat interface

## Usage

### Getting a Channel Link

YouTube channels have URLs like:
- `https://www.youtube.com/c/ChannelName`
- `https://www.youtube.com/@ChannelHandle`
- `https://www.youtube.com/channel/UCxxxxxx`

### Getting a Video Link

Individual video URLs look like:
- `https://www.youtube.com/watch?v=dQw4w9WgXcQ`

### How to Use the Application

1. **Enter a URL**: Paste your YouTube channel or video link in the input field
2. **Select Mode**:
   - `Popular Videos`: Shows most-viewed content
   - `Recent Videos`: Shows latest uploads
   - `Specific Video`: Use a direct video link
3. **Set Limit**: Choose how many videos to fetch (1-100)
4. **Fetch Videos**: Click the button to retrieve video list
5. **Download**: 
   - Click individual "Download" buttons for specific videos
   - Click "Download All" to batch download all fetched videos

### Downloads Location

Downloaded videos are saved to:
- **macOS/Linux**: `~/Downloads/YouTubeVideos/`
- **Windows**: `%USERPROFILE%\Downloads\YouTubeVideos\`

## API Endpoints

### POST `/api/channel`
Get channel information
```json
{
  "url": "https://www.youtube.com/c/ChannelName"
}
```

### POST `/api/videos`
Fetch videos from a channel or get a specific video
```json
{
  "url": "https://www.youtube.com/c/ChannelName",
  "type": "popular",
  "limit": 20
}
```

Options for `type`: `popular`, `recent`, `specific`

### POST `/api/download`
Download a single video
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

## Customization

### Change Download Location

Edit `app.js` line 12:
```javascript
const downloadDir = path.join(os.homedir(), 'Downloads', 'YouTubeVideos');
```

Change to your preferred path:
```javascript
const downloadDir = '/path/to/your/folder';
```

### Change Video Quality

Edit `app.js` line 132:
```javascript
'-f', 'best',  // Downloads best available format
```

Options:
- `'best'` - Best quality available
- `'bestvideo'` - Best video, separate from audio
- `'worst'` - Lowest quality
- `'18'` - Standard MP4 format

### Change Video Format

You can specify format in the download args:
```javascript
'-o', path.join(downloadDir, '%(title)s.%(ext)s'),
// Change to save as specific format:
'-f', 'best[ext=mp4]',  // Only MP4
'-f', 'best[ext=webm]', // Only WebM
```

## Troubleshooting

### "yt-dlp command not found"
- Ensure yt-dlp is installed: `yt-dlp --version`
- On some systems, you may need to use `python -m yt_dlp` instead
- Update the backend to use the correct command path

### CORS Issues
The backend includes CORS headers. If still having issues:
- Ensure backend is running on localhost:3000
- Check browser console for specific error messages

### Downloads Not Saving
- Check that the downloads directory exists and is writable
- Verify the path in `app.js` is correct
- Check file system permissions

### Videos Not Showing
- Verify the URL is correct and public
- Check that the channel/video isn't restricted or private
- Some content may be restricted by YouTube

## Advanced Usage

### Download Playlists

Modify the download endpoint to handle playlists:
```javascript
app.post('/api/download-playlist', async (req, res) => {
  const { url } = req.body;
  const args = [
    url,
    '-o', path.join(downloadDir, '%(playlist)s/%(title)s.%(ext)s'),
    '-f', 'best',
  ];
  // ... rest of implementation
});
```

### Add Audio-Only Download

```javascript
app.post('/api/download-audio', async (req, res) => {
  const { url } = req.body;
  const args = [
    url,
    '-o', path.join(downloadDir, '%(title)s.%(ext)s'),
    '-f', 'bestaudio',
    '-x',
    '--audio-format', 'mp3',
  ];
  // ... rest of implementation
});
```

## License

This application uses:
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Video downloader
- [Express.js](https://expressjs.com/) - Web framework
- [CORS](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing) - Cross-origin requests

Respect copyright and terms of service when downloading content.
