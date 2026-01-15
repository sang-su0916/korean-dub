# Video Translation & Dubbing Service PRD

## Product Requirements Document

**Project Name**: KoreanDub - AI-Powered Video Translation & Dubbing Service  
**Version**: 1.0  
**Date**: January 14, 2026  
**Author**: Product Team

---

## 1. Executive Summary

### 1.1 Product Vision
KoreanDub is an AI-powered video translation and dubbing service that transforms English content into Korean with professional-quality dubbed audio and accurate subtitles. Inspired by HeyGen's Video Translate API, this service leverages state-of-the-art AI technologies to deliver seamless multilingual content localization.

### 1.2 Target Users
- **Content Creators**: YouTubers, educators, and influencers wanting to expand their Korean audience
- **Media Companies**: Production houses localizing content for Korean markets
- **E-learning Platforms**: Educational content providers targeting Korean learners
- **Enterprises**: Companies producing training materials and marketing content

### 1.3 Key Value Propositions
1. **End-to-End Automation**: From speech recognition to final video output
2. **High-Quality Korean TTS**: Natural-sounding Korean voices via ElevenLabs
3. **Accurate Translation**: Contextually aware translation using Grok's reasoning model
4. **Cost-Effective**: ~70% cheaper than HeyGen for equivalent functionality

---

## 2. Technical Architecture

### 2.1 Pipeline Overview

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Input      │    │    Speech    │    │  Translation │    │     TTS      │    │    Video     │
│   Video      │───▶│  Recognition │───▶│   (Grok)     │───▶│ (ElevenLabs) │───▶│   Merge      │
│   (EN)       │    │  (Whisper)   │    │              │    │              │    │   Output     │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                           │                   │                   │                   │
                           ▼                   ▼                   ▼                   ▼
                    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
                    │  Timestamps  │    │   Korean     │    │   Korean     │    │ Final Video  │
                    │  + English   │    │   Subtitles  │    │    Audio     │    │ + Subtitles  │
                    │  Subtitles   │    │    (SRT)     │    │   (.mp3)     │    │ + Dubbed     │
                    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

### 2.2 Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Speech Recognition** | OpenAI Whisper API (`whisper-1`) | Industry-leading accuracy, word-level timestamps, 99+ language support |
| **Translation** | xAI Grok (`grok-4-1-fast-reasoning`) | Superior reasoning for contextual translation, fast inference |
| **Text-to-Speech** | ElevenLabs (`eleven_multilingual_v2`) | Natural Korean voices, emotional expression, low latency |
| **Video Processing** | FFmpeg | Industry standard, open-source, comprehensive format support |
| **Backend** | Python + FastAPI | Async support, excellent AI library ecosystem |
| **Queue System** | Celery + Redis | Reliable task queue for long-running jobs |

### 2.3 Reference: pyvideotrans Architecture

Based on analysis of [pyvideotrans](https://github.com/jianchang512/pyvideotrans) (15.8k stars):

**Core Modules**:
- `videotrans/recognition/` - Speech recognition integrations (Whisper, faster-whisper)
- `videotrans/translator/` - Translation service integrations
- `videotrans/tts/` - Text-to-speech engine integrations
- `videotrans/task/` - Task orchestration and workflow management
- `videotrans/util/` - FFmpeg wrappers and utility functions

**Key Learnings**:
1. Modular plugin architecture for swappable AI engines
2. Time-code preservation throughout pipeline
3. Audio-video sync handling via rubberband
4. Batch processing support for efficiency

---

## 3. Functional Requirements

### 3.1 Core Features

#### FR-1: Video Upload & Input
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | Support video upload (MP4, MOV, AVI, MKV, WebM) | P0 |
| FR-1.2 | Support URL input (YouTube, Vimeo, direct links) | P1 |
| FR-1.3 | Maximum file size: 2GB | P0 |
| FR-1.4 | Maximum duration: 120 minutes | P0 |
| FR-1.5 | Automatic format detection and validation | P0 |

#### FR-2: Speech Recognition (Whisper)
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | Transcribe English audio to text with timestamps | P0 |
| FR-2.2 | Generate word-level timestamps for subtitle sync | P0 |
| FR-2.3 | Support speaker diarization for multi-speaker videos | P1 |
| FR-2.4 | Handle background music/noise filtering | P1 |
| FR-2.5 | Provide transcription confidence scores | P2 |

#### FR-3: Translation (Grok)
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | Translate English subtitles to Korean | P0 |
| FR-3.2 | Preserve context across subtitle segments | P0 |
| FR-3.3 | Handle technical terminology appropriately | P1 |
| FR-3.4 | Support translation style preferences (formal/casual) | P1 |
| FR-3.5 | Glossary/terminology customization | P2 |

#### FR-4: Text-to-Speech (ElevenLabs)
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | Generate Korean audio from translated text | P0 |
| FR-4.2 | Match original video timing (time-stretching) | P0 |
| FR-4.3 | Multiple voice selection (male/female, age, tone) | P0 |
| FR-4.4 | Emotion/style matching from original | P1 |
| FR-4.5 | Voice cloning from user samples | P2 |

#### FR-5: Video Composition
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-5.1 | Merge dubbed audio with original video | P0 |
| FR-5.2 | Embed Korean subtitles (soft/hard) | P0 |
| FR-5.3 | Preserve original audio as secondary track | P1 |
| FR-5.4 | Adjustable subtitle styling | P1 |
| FR-5.5 | Multiple output formats (MP4, WebM) | P1 |

#### FR-6: User Interface
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-6.1 | Web-based upload interface | P0 |
| FR-6.2 | Real-time progress tracking | P0 |
| FR-6.3 | Subtitle preview and editing | P1 |
| FR-6.4 | Audio preview before final render | P1 |
| FR-6.5 | Batch upload support | P2 |

### 3.2 API Requirements

#### REST API Endpoints

```yaml
POST /api/v1/translate
  description: Initiate video translation job
  request:
    video_url: string (required)
    source_language: string (default: "en")
    target_language: string (default: "ko")
    voice_id: string (optional)
    subtitle_style: object (optional)
  response:
    job_id: string
    status: "queued"
    estimated_time: integer (seconds)

GET /api/v1/translate/{job_id}/status
  description: Check translation job status
  response:
    job_id: string
    status: "queued" | "transcribing" | "translating" | "synthesizing" | "composing" | "completed" | "failed"
    progress: integer (0-100)
    current_step: string
    error: string (if failed)

GET /api/v1/translate/{job_id}/result
  description: Get completed translation result
  response:
    video_url: string (expires in 7 days)
    subtitle_url: string
    transcript_url: string
    metadata:
      duration: integer
      word_count: integer
      processing_time: integer

GET /api/v1/voices
  description: List available Korean voices
  response:
    voices: array
      - id: string
        name: string
        gender: "male" | "female"
        age: string
        preview_url: string
```

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Processing Speed | 1:3 ratio (1 min video = 3 min processing) | Average across all videos |
| API Response Time | < 500ms for status checks | p95 latency |
| Concurrent Jobs | 50 simultaneous translations | Peak load |
| Queue Wait Time | < 5 minutes during peak | Average wait time |

### 4.2 Scalability

| Dimension | Requirement |
|-----------|-------------|
| Horizontal Scaling | Auto-scale workers based on queue depth |
| Storage | Object storage (S3-compatible) for video files |
| Database | PostgreSQL for job metadata, Redis for caching |
| CDN | CloudFront/Cloudflare for video delivery |

### 4.3 Reliability

| Metric | Target |
|--------|--------|
| Uptime | 99.5% monthly |
| Job Completion Rate | 98%+ |
| Data Retention | 30 days for completed videos |
| Backup Frequency | Daily incremental, weekly full |

### 4.4 Security

| Requirement | Implementation |
|-------------|----------------|
| Authentication | API keys + OAuth 2.0 |
| Encryption | TLS 1.3 in transit, AES-256 at rest |
| Access Control | Role-based permissions |
| Compliance | GDPR-ready data handling |

---

## 5. API Integration Specifications

### 5.1 OpenAI Whisper API

**Endpoint**: `POST https://api.openai.com/v1/audio/transcriptions`

**Configuration**:
```python
{
    "model": "whisper-1",
    "language": "en",
    "response_format": "verbose_json",
    "timestamp_granularities": ["word", "segment"]
}
```

**Cost**: $0.006/minute  
**Rate Limit**: Handle with exponential backoff  
**Max File Size**: 25MB (chunk larger files)

**Output Format**:
```json
{
    "text": "Hello world",
    "segments": [
        {
            "id": 0,
            "start": 0.0,
            "end": 2.5,
            "text": "Hello world",
            "words": [
                {"word": "Hello", "start": 0.0, "end": 0.5},
                {"word": "world", "start": 0.5, "end": 1.0}
            ]
        }
    ]
}
```

### 5.2 xAI Grok API

**Endpoint**: `POST https://api.x.ai/v1/chat/completions`

**Configuration**:
```python
{
    "model": "grok-4-1-fast-reasoning",
    "messages": [
        {
            "role": "system",
            "content": "You are a professional English-to-Korean translator specializing in video content localization. Translate naturally while preserving meaning and tone. Output ONLY the Korean translation."
        },
        {
            "role": "user",
            "content": "Translate: [English text with context]"
        }
    ],
    "temperature": 0.3
}
```

**Pricing** (from xAI docs):
- Input: ~$5/1M tokens
- Output: ~$15/1M tokens  
- Context Window: 131,072 tokens

**Translation Strategy**:
1. Batch subtitle segments (respect token limits)
2. Include context from surrounding segments
3. Post-process for consistency

### 5.3 ElevenLabs TTS API

**Endpoint**: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`

**Configuration**:
```python
{
    "text": "안녕하세요",
    "model_id": "eleven_multilingual_v2",
    "voice_settings": {
        "stability": 0.5,
        "similarity_boost": 0.75,
        "style": 0.0,
        "use_speaker_boost": True
    },
    "output_format": "mp3_44100_128"
}
```

**Recommended Korean Voices**:
| Voice ID | Name | Description |
|----------|------|-------------|
| `4JJwo477JUAx3HV0T7n7` | YohanKoo | Confident male, 30s |
| `AW5wrnG1jVizOYY7R1Oo` | JiYoung | Warm female, natural |
| `DMkRitQrfpiddSQT5adl` | Jjeong | Calm female, Seoul dialect |

**Pricing**: ~$0.30/minute at Creator tier

---

## 6. Cost Analysis

### 6.1 Per-Video Cost Breakdown (10-minute video)

| Service | Usage | Unit Cost | Total |
|---------|-------|-----------|-------|
| Whisper | 10 min audio | $0.006/min | $0.06 |
| Grok | ~5,000 tokens | ~$0.01/1K tokens | $0.05 |
| ElevenLabs | ~10 min Korean audio | $0.03/min | $0.30 |
| FFmpeg/Infra | Processing | - | $0.05 |
| **Total** | | | **$0.46** |

### 6.2 Comparison with HeyGen

| Service | 10-min Video Cost | Monthly (100 videos) |
|---------|-------------------|---------------------|
| HeyGen Video Translate | ~$2.50 | ~$250 |
| KoreanDub (This Service) | ~$0.50 | ~$50 |
| **Savings** | **80%** | **$200/month** |

### 6.3 Pricing Model Recommendation

| Tier | Monthly Fee | Included Minutes | Overage |
|------|-------------|------------------|---------|
| Free | $0 | 10 min | N/A |
| Starter | $29 | 120 min | $0.35/min |
| Pro | $99 | 500 min | $0.25/min |
| Enterprise | Custom | Unlimited | Negotiated |

---

## 7. Implementation Phases

### Phase 1: MVP (Weeks 1-4)
**Goal**: Basic end-to-end pipeline

- [ ] Video upload and storage
- [ ] Whisper transcription integration
- [ ] Grok translation integration
- [ ] ElevenLabs TTS integration (single voice)
- [ ] FFmpeg video composition
- [ ] Basic web UI for upload/download
- [ ] Job status tracking

**Deliverables**: Working prototype processing English→Korean videos

### Phase 2: Enhancement (Weeks 5-8)
**Goal**: Production-ready features

- [ ] Multiple Korean voice options
- [ ] Subtitle styling customization
- [ ] Progress tracking with real-time updates
- [ ] Subtitle preview/editing interface
- [ ] API authentication and rate limiting
- [ ] Error handling and retry logic
- [ ] Basic analytics dashboard

**Deliverables**: Beta-ready service

### Phase 3: Scale (Weeks 9-12)
**Goal**: Production deployment

- [ ] Horizontal scaling infrastructure
- [ ] Batch processing optimization
- [ ] Voice cloning support
- [ ] Speaker diarization
- [ ] Webhook notifications
- [ ] Usage billing integration
- [ ] Documentation and API reference

**Deliverables**: Production launch

---

## 8. Verification & Testing Plan

### 8.1 Unit Testing

| Component | Test Cases |
|-----------|------------|
| Whisper Integration | Transcription accuracy, timestamp precision, error handling |
| Grok Translation | Translation quality, context preservation, edge cases |
| ElevenLabs TTS | Audio quality, timing accuracy, voice consistency |
| FFmpeg Processing | Format compatibility, subtitle embedding, audio sync |

### 8.2 Integration Testing

| Scenario | Validation |
|----------|------------|
| End-to-end pipeline | Complete video processing without errors |
| Error recovery | Graceful handling of API failures |
| Concurrent processing | Multiple jobs without resource conflicts |
| Large file handling | 1GB+ videos processed correctly |

### 8.3 Quality Assurance

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Translation Accuracy | 90%+ human evaluation | Native speaker review (sample) |
| Audio Naturalness | 4.0/5.0 MOS score | User feedback surveys |
| Subtitle Sync | < 200ms drift | Automated timing analysis |
| Video Quality | No degradation | VMAF comparison |

### 8.4 Sample Test Cases

**Test Video Set**:
1. TED Talk (10 min) - Clear speech, single speaker
2. YouTube tutorial (15 min) - Technical terminology
3. Movie clip (5 min) - Multiple speakers, background music
4. News segment (3 min) - Fast speech, formal tone
5. Podcast (20 min) - Casual conversation, filler words

**Success Criteria**:
- [ ] All videos process without errors
- [ ] Subtitles sync within 200ms
- [ ] Translation reviewed as "acceptable" by native speaker
- [ ] Audio quality rated 4+/5 by users

---

## 9. Risk Assessment

### 9.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Whisper accuracy issues | Medium | High | Add manual review option, improve prompting |
| Translation context loss | Medium | Medium | Batch with context, add glossary support |
| Audio-video sync drift | High | High | Implement rubberband time-stretching |
| API rate limits | Medium | Medium | Implement queuing, caching, retries |

### 9.2 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API pricing changes | Low | High | Monitor announcements, budget buffer |
| Competitor launch | Medium | Medium | Focus on quality and UX |
| Copyright concerns | Medium | High | Terms of service, content filtering |

---

## 10. Success Metrics

### 10.1 Launch Metrics (Month 1)

| Metric | Target |
|--------|--------|
| Videos Processed | 1,000+ |
| User Registrations | 500+ |
| Processing Success Rate | 95%+ |
| Average Processing Time | < 5x video duration |

### 10.2 Growth Metrics (Month 3)

| Metric | Target |
|--------|--------|
| Monthly Active Users | 2,000+ |
| Videos Processed | 10,000+ |
| Paid Conversions | 5%+ |
| NPS Score | 40+ |

---

## 11. Appendix

### A. API Key Requirements

| Service | Key Required | Console URL |
|---------|-------------|-------------|
| OpenAI | `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| xAI | `XAI_API_KEY` | https://console.x.ai |
| ElevenLabs | `ELEVENLABS_API_KEY` | https://elevenlabs.io/app/settings/api-keys |

### B. Reference Documentation

- [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text)
- [xAI Grok API](https://docs.x.ai/docs/overview)
- [ElevenLabs TTS API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)
- [pyvideotrans Repository](https://github.com/jianchang512/pyvideotrans)
- [HeyGen Video Translate](https://docs.heygen.com/docs/video-translate-api)

### C. Korean Voice Samples

| Voice | Sample Text | Use Case |
|-------|-------------|----------|
| YohanKoo | "안녕하세요, 오늘의 뉴스입니다." | News, formal presentations |
| JiYoung | "반갑습니다! 오늘도 좋은 하루 되세요." | Tutorials, friendly content |
| Jjeong | "지금부터 설명을 시작하겠습니다." | Educational, calm delivery |

---

*Document Version: 1.0*  
*Last Updated: January 14, 2026*
