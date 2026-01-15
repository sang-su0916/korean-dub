const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');

const PORT = 3000;
const TEMP_DIR = path.join(__dirname, 'temp');
const MAX_VIDEO_DURATION = 600; // 10 minutes limit

// Check for yt-dlp availability
let HAS_YTDLP = false;
let YTDLP_CMD = 'yt-dlp';
try {
    execSync('yt-dlp --version', { encoding: 'utf-8' });
    HAS_YTDLP = true;
} catch (e) {
    try {
        execSync('youtube-dl --version', { encoding: 'utf-8' });
        HAS_YTDLP = true;
        YTDLP_CMD = 'youtube-dl';
    } catch (e2) {
        HAS_YTDLP = false;
    }
}

// Audio processing limits
const MAX_RUBBERBAND_STRETCH = 1.3;  // Maximum pitch-preserving stretch
const MAX_ATEMPO_FALLBACK = 2.0;     // Maximum atempo (fallback, affects pitch)

// Check for rubberband filter availability
let HAS_RUBBERBAND = false;
try {
    const result = execSync('ffmpeg -filters 2>&1 | grep rubberband', { encoding: 'utf-8' });
    HAS_RUBBERBAND = result.includes('rubberband');
} catch (e) {
    HAS_RUBBERBAND = false;
}

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.wasm': 'application/wasm'
};

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

async function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const boundary = req.headers['content-type'].split('boundary=')[1];
        const chunks = [];
        
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const parts = {};
            const boundaryBuffer = Buffer.from(`--${boundary}`);
            
            let partStart = buffer.indexOf(boundaryBuffer);
            
            while (partStart !== -1) {
                const nextBoundary = buffer.indexOf(boundaryBuffer, partStart + boundaryBuffer.length);
                if (nextBoundary === -1) break;
                
                const partData = buffer.slice(partStart + boundaryBuffer.length + 2, nextBoundary - 2);
                const headerEnd = partData.indexOf('\r\n\r\n');
                
                if (headerEnd !== -1) {
                    const headers = partData.slice(0, headerEnd).toString();
                    const content = partData.slice(headerEnd + 4);
                    
                    const nameMatch = headers.match(/name="([^"]+)"/);
                    const filenameMatch = headers.match(/filename="([^"]+)"/);
                    
                    if (nameMatch) {
                        const name = nameMatch[1];
                        if (filenameMatch) {
                            parts[name] = { filename: filenameMatch[1], data: content };
                        } else {
                            parts[name] = content.toString();
                        }
                    }
                }
                
                partStart = nextBoundary;
            }
            
            resolve(parts);
        });
        req.on('error', reject);
    });
}

function getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'csv=p=0',
            filePath
        ]);
        
        let output = '';
        ffprobe.stdout.on('data', data => output += data.toString());
        ffprobe.on('close', code => {
            if (code === 0) {
                resolve(parseFloat(output.trim()) || 0);
            } else {
                resolve(0);
            }
        });
        ffprobe.on('error', () => resolve(0));
    });
}

function runFFmpeg(args) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', args);
        let stderr = '';
        
        ffmpeg.stderr.on('data', data => {
            stderr += data.toString();
        });
        
        ffmpeg.on('close', code => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`FFmpeg error: ${stderr.slice(-500)}`));
            }
        });
        
        ffmpeg.on('error', reject);
    });
}

async function adjustAudioTempo(inputPath, targetDuration, outputPath, segmentInfo = {}) {
    const actualDuration = await getAudioDuration(inputPath);
    
    if (actualDuration <= 0 || targetDuration <= 0) {
        await runFFmpeg(['-i', inputPath, '-ar', '44100', '-ac', '2', '-y', outputPath]);
        return { stretchFactor: 1.0, actualDuration, adjusted: false };
    }
    
    const ratio = actualDuration / targetDuration;
    
    if (ratio <= 1.05) {
        await runFFmpeg([
            '-i', inputPath,
            '-af', `apad=whole_dur=${targetDuration}`,
            '-t', targetDuration.toString(),
            '-ar', '44100', '-ac', '2',
            '-y', outputPath
        ]);
        console.log(`  ✓ Duration OK: ${actualDuration.toFixed(2)}s fits in ${targetDuration.toFixed(2)}s`);
        return { stretchFactor: 1.0, actualDuration, adjusted: false, finalDuration: targetDuration };
    }
    
    const maxStretch = HAS_RUBBERBAND ? MAX_RUBBERBAND_STRETCH : MAX_ATEMPO_FALLBACK;
    const stretchFactor = Math.min(ratio, maxStretch);
    const filterType = HAS_RUBBERBAND ? 'rubberband' : 'atempo';
    
    console.log(`  Original: ${actualDuration.toFixed(2)}s → Target: ${targetDuration.toFixed(2)}s (ratio: ${ratio.toFixed(2)})`);
    if (segmentInfo.ttsSpeed) console.log(`  TTS speed was: ${segmentInfo.ttsSpeed}x`);
    console.log(`  Applying ${filterType}: ${stretchFactor.toFixed(2)}x`);
    
    const filterCmd = HAS_RUBBERBAND 
        ? `rubberband=tempo=${stretchFactor}:pitch=1.0`
        : `atempo=${stretchFactor}`;
    
    const tempPath = path.join(TEMP_DIR, `temp_stretch_${Date.now()}.wav`);
    
    await runFFmpeg([
        '-i', inputPath,
        '-filter:a', filterCmd,
        '-ar', '44100', '-ac', '2',
        '-y', tempPath
    ]);
    
    const stretchedDuration = await getAudioDuration(tempPath);
    
    if (stretchedDuration > targetDuration) {
        const fadeStart = Math.max(0, targetDuration - 0.15);
        await runFFmpeg([
            '-i', tempPath,
            '-t', targetDuration.toString(),
            '-af', `afade=t=out:st=${fadeStart}:d=0.15`,
            '-ar', '44100', '-ac', '2',
            '-y', outputPath
        ]);
        console.log(`  Applied fade-out: ${stretchedDuration.toFixed(2)}s → ${targetDuration.toFixed(2)}s`);
    } else {
        await runFFmpeg([
            '-i', tempPath,
            '-af', `apad=whole_dur=${targetDuration}`,
            '-t', targetDuration.toString(),
            '-ar', '44100', '-ac', '2',
            '-y', outputPath
        ]);
    }
    
    fs.unlinkSync(tempPath);
    
    const finalDuration = Math.min(stretchedDuration, targetDuration);
    return { 
        stretchFactor, 
        actualDuration, 
        adjusted: true, 
        finalDuration,
        filterUsed: filterType
    };
}

async function createSilence(durationSec, outputPath) {
    await runFFmpeg([
        '-f', 'lavfi',
        '-i', `anullsrc=r=44100:cl=stereo`,
        '-t', durationSec.toString(),
        '-y', outputPath
    ]);
}

// YouTube download functions
async function getYoutubeInfo(url) {
    return new Promise((resolve, reject) => {
        const args = [
            '--dump-json',
            '--no-playlist',
            url
        ];

        const proc = spawn(YTDLP_CMD, args);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', data => stdout += data.toString());
        proc.stderr.on('data', data => stderr += data.toString());

        proc.on('close', code => {
            if (code === 0) {
                try {
                    const info = JSON.parse(stdout);
                    resolve({
                        id: info.id,
                        title: info.title,
                        duration: info.duration,
                        thumbnail: info.thumbnail,
                        channel: info.uploader || info.channel,
                        description: info.description?.substring(0, 200)
                    });
                } catch (e) {
                    reject(new Error('Failed to parse video info'));
                }
            } else {
                reject(new Error(stderr || 'Failed to get video info'));
            }
        });

        proc.on('error', () => reject(new Error('yt-dlp not found')));
    });
}

async function downloadYoutubeVideo(url, outputPath) {
    return new Promise((resolve, reject) => {
        const args = [
            '-f', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
            '--merge-output-format', 'mp4',
            '--no-playlist',
            '-o', outputPath,
            url
        ];

        console.log(`Downloading: ${YTDLP_CMD} ${args.join(' ')}`);

        const proc = spawn(YTDLP_CMD, args);
        let stderr = '';

        proc.stderr.on('data', data => {
            const line = data.toString();
            stderr += line;
            if (line.includes('%')) {
                const match = line.match(/(\d+\.?\d*)%/);
                if (match) {
                    process.stdout.write(`\r  Download progress: ${match[1]}%`);
                }
            }
        });

        proc.stdout.on('data', data => {
            const line = data.toString();
            if (line.includes('%')) {
                const match = line.match(/(\d+\.?\d*)%/);
                if (match) {
                    process.stdout.write(`\r  Download progress: ${match[1]}%`);
                }
            }
        });

        proc.on('close', code => {
            console.log(''); // New line after progress
            if (code === 0 && fs.existsSync(outputPath)) {
                resolve(outputPath);
            } else {
                reject(new Error(stderr || 'Download failed'));
            }
        });

        proc.on('error', () => reject(new Error('yt-dlp not found')));
    });
}

async function handleYoutubeDownload(req, res) {
    try {
        let body = '';
        for await (const chunk of req) {
            body += chunk;
        }
        const { url, download } = JSON.parse(body);

        if (!url) {
            res.writeHead(400, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'URL is required' }));
            return;
        }

        if (!HAS_YTDLP) {
            res.writeHead(500, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'yt-dlp가 설치되지 않았습니다. brew install yt-dlp 또는 pip install yt-dlp로 설치해주세요.' }));
            return;
        }

        console.log(`\n📺 YouTube request: ${url}`);

        // Get video info first
        const info = await getYoutubeInfo(url);
        console.log(`  Title: ${info.title}`);
        console.log(`  Duration: ${info.duration}s`);

        if (info.duration > MAX_VIDEO_DURATION) {
            res.writeHead(400, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: `영상이 너무 깁니다 (${Math.floor(info.duration / 60)}분). 최대 ${MAX_VIDEO_DURATION / 60}분까지 지원됩니다.`
            }));
            return;
        }

        if (!download) {
            // Just return info
            res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
            res.end(JSON.stringify(info));
            return;
        }

        // Download the video
        const id = crypto.randomBytes(8).toString('hex');
        const outputPath = path.join(TEMP_DIR, `${id}_youtube.mp4`);

        console.log(`  Downloading to: ${outputPath}`);
        await downloadYoutubeVideo(url, outputPath);

        // Read and send the file
        const videoData = fs.readFileSync(outputPath);
        console.log(`  ✅ Download complete: ${(videoData.length / 1024 / 1024).toFixed(2)} MB`);

        // Clean up
        fs.unlinkSync(outputPath);

        res.writeHead(200, {
            ...CORS_HEADERS,
            'Content-Type': 'video/mp4',
            'Content-Length': videoData.length
        });
        res.end(videoData);

    } catch (error) {
        console.error('❌ YouTube error:', error.message);
        res.writeHead(500, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
    }
}

async function composeWithSegments(id, videoPath, segments, audioFiles, duration, subtitlePath) {
    const outputPath = path.join(TEMP_DIR, `${id}_output.mp4`);
    const combinedAudioPath = path.join(TEMP_DIR, `${id}_combined.wav`);
    
    console.log('\n--- Processing audio segments ---');
    console.log(`Filter: ${HAS_RUBBERBAND ? 'rubberband (pitch-preserving)' : 'atempo (fallback)'}`);
    console.log(`Max stretch: ${HAS_RUBBERBAND ? MAX_RUBBERBAND_STRETCH : MAX_ATEMPO_FALLBACK}x`);
    
    const processedFiles = [];
    const processingStats = [];
    let currentTime = 0;
    
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const segStart = seg.start;
        const segEnd = seg.end;
        const targetDuration = segEnd - segStart;
        
        console.log(`\n[Segment ${i}] ${segStart.toFixed(2)}s - ${segEnd.toFixed(2)}s (target: ${targetDuration.toFixed(2)}s)`);
        
        if (segStart > currentTime) {
            const silenceDuration = segStart - currentTime;
            const silencePath = path.join(TEMP_DIR, `${id}_silence_${i}.wav`);
            console.log(`  Adding silence: ${silenceDuration.toFixed(2)}s`);
            await createSilence(silenceDuration, silencePath);
            processedFiles.push(silencePath);
        }
        
        const adjustedPath = path.join(TEMP_DIR, `${id}_adjusted_${i}.wav`);
        const result = await adjustAudioTempo(audioFiles[i], targetDuration, adjustedPath, seg);
        processedFiles.push(adjustedPath);
        
        processingStats.push({
            segment: i,
            original: result.actualDuration,
            target: targetDuration,
            final: result.finalDuration || targetDuration,
            stretch: result.stretchFactor,
            adjusted: result.adjusted
        });
        
        currentTime = segEnd;
    }
    
    if (currentTime < duration) {
        const silenceDuration = duration - currentTime;
        const silencePath = path.join(TEMP_DIR, `${id}_silence_end.wav`);
        console.log(`\nAdding trailing silence: ${silenceDuration.toFixed(2)}s`);
        await createSilence(silenceDuration, silencePath);
        processedFiles.push(silencePath);
    }
    
    const totalOriginal = processingStats.reduce((sum, s) => sum + s.original, 0);
    const totalFinal = processingStats.reduce((sum, s) => sum + s.final, 0);
    const adjustedCount = processingStats.filter(s => s.adjusted).length;
    
    console.log('\n--- Processing Summary ---');
    console.log(`Total segments: ${segments.length}`);
    console.log(`Segments adjusted: ${adjustedCount}/${segments.length}`);
    console.log(`Total original audio: ${totalOriginal.toFixed(2)}s`);
    console.log(`Total final audio: ${totalFinal.toFixed(2)}s`);
    if (totalOriginal > totalFinal) {
        console.log(`Compression: ${((1 - totalFinal/totalOriginal) * 100).toFixed(1)}%`);
    }
    
    console.log('\n--- Concatenating audio segments ---');
    
    const listPath = path.join(TEMP_DIR, `${id}_list.txt`);
    const listContent = processedFiles.map(f => `file '${f}'`).join('\n');
    fs.writeFileSync(listPath, listContent);
    
    await runFFmpeg([
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        '-ac', '2',
        '-ar', '44100',
        '-y', combinedAudioPath
    ]);
    
    console.log('\n--- Merging with video ---');
    
    let videoArgs;
    if (subtitlePath) {
        videoArgs = [
            '-i', videoPath,
            '-i', combinedAudioPath,
            '-vf', `subtitles=${subtitlePath}:force_style='FontSize=24,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,MarginV=30'`,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-c:a', 'aac',
            '-map', '0:v:0',
            '-map', '1:a:0',
            '-shortest',
            '-y',
            outputPath
        ];
    } else {
        videoArgs = [
            '-i', videoPath,
            '-i', combinedAudioPath,
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-map', '0:v:0',
            '-map', '1:a:0',
            '-shortest',
            '-y',
            outputPath
        ];
    }
    
    await runFFmpeg(videoArgs);
    
    fs.unlinkSync(combinedAudioPath);
    fs.unlinkSync(listPath);
    processedFiles.forEach(f => fs.existsSync(f) && fs.unlinkSync(f));
    
    return outputPath;
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS_HEADERS);
        res.end();
        return;
    }
    
    // YouTube download endpoint
    if (req.method === 'POST' && req.url === '/api/youtube-download') {
        await handleYoutubeDownload(req, res);
        return;
    }

    if (req.method === 'POST' && req.url === '/api/compose-segments') {
        try {
            console.log('\n========================================');
            console.log('New composition request');
            console.log('========================================');
            
            const parts = await parseMultipart(req);
            const id = crypto.randomBytes(8).toString('hex');
            
            const videoPath = path.join(TEMP_DIR, `${id}_video.mp4`);
            fs.writeFileSync(videoPath, parts.video.data);
            
            const segments = JSON.parse(parts.segments);
            const duration = parseFloat(parts.duration);
            
            console.log(`Total segments: ${segments.length}`);
            console.log(`Video duration: ${duration}s`);
            
            const audioFiles = [];
            for (let i = 0; i < segments.length; i++) {
                const audioKey = `audio_${i}`;
                if (parts[audioKey]) {
                    const audioPath = path.join(TEMP_DIR, `${id}_audio_${i}.mp3`);
                    fs.writeFileSync(audioPath, parts[audioKey].data);
                    audioFiles.push(audioPath);
                }
            }
            
            let subtitlePath = null;
            if (parts.subtitles) {
                subtitlePath = path.join(TEMP_DIR, `${id}_subs.srt`);
                fs.writeFileSync(subtitlePath, parts.subtitles);
            }
            
            const outputPath = await composeWithSegments(id, videoPath, segments, audioFiles, duration, subtitlePath);
            
            const outputData = fs.readFileSync(outputPath);
            
            fs.unlinkSync(videoPath);
            audioFiles.forEach(f => fs.existsSync(f) && fs.unlinkSync(f));
            fs.unlinkSync(outputPath);
            if (subtitlePath) fs.unlinkSync(subtitlePath);
            
            console.log('\n✅ Composition complete!\n');
            
            res.writeHead(200, {
                ...CORS_HEADERS,
                'Content-Type': 'video/mp4',
                'Content-Length': outputData.length
            });
            res.end(outputData);
            
        } catch (error) {
            console.error('❌ Compose error:', error);
            res.writeHead(500, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }
    
    let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    filePath = path.join(__dirname, filePath);
    
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
            return;
        }
        
        res.writeHead(200, {
            'Content-Type': contentType,
            ...CORS_HEADERS
        });
        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`
🎬 KoreanDub Server v3.1
========================
http://localhost:${PORT}

Audio Processing:
  ${HAS_RUBBERBAND ? '✓' : '✗'} Rubberband filter: ${HAS_RUBBERBAND ? 'available (pitch-preserving)' : 'NOT available'}
  ✓ Max stretch: ${HAS_RUBBERBAND ? MAX_RUBBERBAND_STRETCH : MAX_ATEMPO_FALLBACK}x
  ✓ Adaptive TTS speed support
  ✓ Fade-out instead of hard trim

YouTube Support:
  ${HAS_YTDLP ? '✓' : '✗'} yt-dlp: ${HAS_YTDLP ? `available (${YTDLP_CMD})` : 'NOT available - install with: brew install yt-dlp'}
  ✓ Max video duration: ${MAX_VIDEO_DURATION / 60} minutes

Features:
  ✓ Per-segment TTS generation
  ✓ Timestamp-synced audio
  ✓ Optional subtitle burn-in
  ${HAS_YTDLP ? '✓' : '✗'} YouTube URL direct download

Ready for requests...
`);
});
