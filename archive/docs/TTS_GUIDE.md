# Text-to-Speech (TTS) Feature Guide

## Overview

The Smart Reader now includes a powerful Text-to-Speech (TTS) feature that allows you to listen to PDF documents with natural human voices. This feature is perfect for:
- Accessibility
- Multitasking while consuming content
- Learning and comprehension
- Long reading sessions

## Features

### 🎙️ Natural Voice Reading
- **Multiple Voice Options**: Choose from various English voices available on your system
- **Premium Voice Support**: Automatically selects enhanced/premium voices when available
- **Cross-platform**: Works on all modern browsers that support Web Speech API

### ⚙️ Customizable Settings

#### Voice Settings
- **Voice Selection**: Choose from available English voices
- **Rate Control**: Adjust reading speed from 0.5x to 2x (default: 1x)
- **Pitch Control**: Modify voice pitch from 0.5 to 2 (default: 1)
- **Volume Control**: Set volume from 0% to 100%

#### Reading Modes
1. **Current Page**: Read only the current page
2. **Read from Here to End**: Start from current page and continue to the end
3. **Auto-continue**: Automatically move to next page when current page finishes

### 🎯 Quick Speed Presets
- **0.75x**: Slower, clearer reading
- **1x**: Normal speaking speed
- **1.25x**: Slightly faster
- **1.5x**: Fast reading

### 🎨 Visual Feedback
- **Word Highlighting** (optional): Highlights the currently spoken word
- **Playing Indicator**: Visual indicator showing TTS is active
- **Progress Tracking**: Shows current page being read

## How to Use

### Getting Started

1. **Enable TTS**
   - Open a PDF document
   - Click the speaker icon (🔊) in the toolbar
   - The TTS controls will appear

2. **Configure Voice** (Optional)
   - Click the Settings icon (⚙️)
   - Select your preferred voice from the dropdown
   - Adjust speed, pitch, and volume to your liking

3. **Start Reading**
   - Click the Play button (▶️) to start reading
   - The TTS will read the current page

### Playback Controls

| Button | Function |
|--------|----------|
| ▶️ Play | Start/Resume reading |
| ⏸️ Pause | Pause reading |
| ⏹️ Stop | Stop reading completely |
| 🔊 Settings | Open TTS settings panel |

### Keyboard Shortcuts (Coming Soon)
- `Space`: Play/Pause
- `Esc`: Stop
- `[`: Decrease speed
- `]`: Increase speed

## Reading Strategies

### Strategy 1: Page-by-Page
Best for: Detailed reading, note-taking
1. Enable TTS
2. Click "Read Current Page"
3. Navigate pages manually and read each one

### Strategy 2: Continuous Reading
Best for: Long documents, audiobook-style listening
1. Navigate to your starting page
2. Click "Read from Here to End"
3. TTS will automatically continue through all pages

### Strategy 3: Quick Review
Best for: Skimming, reviewing specific sections
1. Set speed to 1.5x or 2x
2. Use "Read Current Page" for each section
3. Pause/stop when you need to focus

## Browser Compatibility

### ✅ Fully Supported
- **Chrome/Edge**: Excellent support with premium voices
- **Safari**: Good support with natural-sounding voices
- **Firefox**: Basic support with system voices

### Voice Quality by Platform

#### Windows
- Microsoft Edge provides the best quality voices
- Includes premium voices like "Microsoft David" and "Microsoft Zira"

#### macOS
- Safari offers high-quality Siri voices
- Includes voices like "Alex", "Samantha", "Tom"

#### Linux
- Quality depends on installed speech engines
- eSpeak and Festival are common options

## Tips for Best Experience

### 1. Voice Selection
- Try different voices to find the most natural one
- Premium/Enhanced voices usually sound better
- Some voices are optimized for specific accents

### 2. Speed Optimization
- Start with 1x speed
- Gradually increase to find your comfortable pace
- Use slower speeds (0.75x) for complex content
- Use faster speeds (1.25-1.5x) for familiar material

### 3. Volume and Pitch
- Keep volume at 80-100% for clarity
- Pitch of 1.0 is usually most natural
- Adjust pitch if a voice sounds too high or low

### 4. Background Listening
- Enable TTS and minimize the browser
- TTS will continue playing in the background
- Perfect for multitasking

## Troubleshooting

### "Text-to-Speech not supported"
**Problem**: Browser doesn't support Web Speech API  
**Solution**: 
- Update your browser to the latest version
- Try Chrome, Edge, or Safari
- Check browser compatibility

### No voices available
**Problem**: No voices in the dropdown  
**Solution**:
- Check your system's text-to-speech settings
- Install additional voices from system settings
- Restart your browser

### Voice sounds robotic
**Problem**: Low-quality voice selected  
**Solution**:
- Look for "Premium", "Enhanced", or "Natural" in voice names
- Try different voices
- On Windows, use Microsoft Edge browser

### Reading stops unexpectedly
**Problem**: TTS stops mid-page  
**Solution**:
- Check if browser tab is still active
- Ensure browser has permission to run in background
- Try reducing the reading speed

### Can't pause/resume
**Problem**: Pause button doesn't work  
**Solution**:
- Stop and restart the reading
- Refresh the page
- Clear browser cache

## Advanced Features

### Text Preprocessing
The TTS engine automatically:
- Normalizes whitespace
- Adds pauses at punctuation
- Removes formatting artifacts
- Handles line breaks intelligently

### Multi-page Management
- Auto-pagination: Moves to next page when current ends
- Page tracking: Always shows which page is being read
- Smart stopping: Stops at document end

### Integration with Other Features
- **Highlighting**: Highlight important parts while listening
- **Search**: Find specific content, then read from there
- **Zoom**: Adjust zoom while listening
- **Scroll Mode**: Works in both single and continuous modes

## API Reference (For Developers)

### TTS Service
```typescript
import { ttsService } from '../services/ttsService'

// Basic usage
ttsService.speak('Hello world')

// With callbacks
ttsService.speak(
  'Hello world',
  () => console.log('Finished'),
  (word, index) => console.log('Speaking:', word)
)

// Control playback
ttsService.pause()
ttsService.resume()
ttsService.stop()

// Settings
ttsService.setVoice(voice)
ttsService.setRate(1.5)
ttsService.setPitch(1.0)
ttsService.setVolume(0.8)
```

### State Management
```typescript
const { tts, updateTTS } = useAppStore()

// Update settings
updateTTS({ 
  isEnabled: true,
  rate: 1.5,
  pitch: 1.0,
  volume: 1.0
})
```

## Future Enhancements

### Planned Features
- [ ] Sentence-level highlighting
- [ ] Bookmarking audio position
- [ ] Custom voice profiles
- [ ] Reading history
- [ ] Sleep timer
- [ ] Background mode with controls
- [ ] Keyboard shortcuts
- [ ] Export audio (if possible)

### Under Consideration
- Integration with external TTS APIs (Google, Amazon Polly)
- Offline voice packs
- Language detection and auto-voice selection
- Reading speed learning/recommendations

## Privacy & Data

### Local Processing
- All TTS processing happens in your browser
- No audio or text is sent to external servers
- Voice synthesis uses browser's built-in engine

### No Data Collection
- We don't track what you read
- We don't store voice preferences externally
- All settings are local to your browser

## Support

### Getting Help
- Check this guide first
- Review browser console for errors
- Try different voices/settings
- Update your browser

### Report Issues
- GitHub Issues: [Your Repo URL]
- Include browser version
- Describe the voice/settings used
- Provide steps to reproduce

## Credits

Built with:
- Web Speech API
- React & TypeScript
- Zustand state management

---

**Enjoy your reading! 🎧📚**
