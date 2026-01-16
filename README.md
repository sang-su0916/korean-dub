---
title: Korean Dub
emoji: 🎬
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 3000
pinned: false
license: mit
---

# KoreanDub - AI Video Translation & Dubbing

AI-powered video translation service that transforms English content into Korean with professional-quality dubbed audio and accurate subtitles.

## Features

- **YouTube URL 직접 입력** 또는 파일 업로드
- **Speech Recognition**: OpenAI Whisper API for accurate transcription
- **Translation**: xAI Grok for contextual Korean translation
- **Text-to-Speech**: ElevenLabs for natural Korean voices
- **Smart Audio Sync**:
  - Adaptive TTS speed (0.7-1.2x)
  - AI text condensation for long translations
  - Pitch-preserving rubberband time-stretch
  - Fade-out instead of hard trim

## Quick Start

```bash
# Start the server
node server.js

# Open in browser
open http://localhost:3000
```

## Requirements

- Node.js 18+
- FFmpeg with rubberband filter
- API Keys:
  - OpenAI API Key (Whisper)
  - xAI API Key (Grok)
  - ElevenLabs API Key (TTS)

## Architecture

```
Input Video (EN) → Whisper → Grok Translation → ElevenLabs TTS → FFmpeg Merge → Output (KO)
```

## License

MIT
