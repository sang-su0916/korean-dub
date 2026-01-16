# Korean Dub 배포 진행상황

**최종 업데이트**: 2026-01-16

---

## 현재 상태: Hugging Face Spaces 배포 대기 중

### 완료된 작업

1. **YouTube URL 직접 입력 기능** ✅
   - `index.html:1447-1627` - YouTube URL 탭/다운로드 UI
   - `server.js:240-397` - yt-dlp 다운로드 API

2. **배포 설정 파일 생성** ✅
   - `Dockerfile` - Docker 빌드 설정 (ffmpeg, yt-dlp 포함)
   - `render.yaml` - Render 설정
   - `nixpacks.toml` - Railway/Nixpacks 설정
   - `koyeb.yaml` - Koyeb 설정
   - `fly.toml` - Fly.io 설정
   - `README.md` - Hugging Face Spaces 메타데이터 추가됨

3. **GitHub 푸시 완료** ✅
   - 저장소: https://github.com/sang-su0916/korean-dub
   - 최신 커밋: `chore: Koyeb 배포 설정 추가`

---

## 시도한 플랫폼 및 결과

| 플랫폼 | 결과 | 사유 |
|--------|------|------|
| Railway | ❌ 실패 | 트라이얼 만료 |
| Render | ❌ 실패 | 무료플랜 Docker 미지원 |
| Fly.io | ❌ 실패 | 결제 정보 필요 |
| Koyeb | ⏸️ 보류 | 512MB RAM 부족 우려 |
| **Hugging Face Spaces** | 🔄 진행중 | **2GB RAM, 무료, Docker 지원** |

---

## 다음 단계: Hugging Face Spaces 배포

### 방법 1: 웹에서 직접 생성 (권장)

1. https://huggingface.co 접속
2. **GitHub 계정으로 로그인** (Sign Up → Continue with GitHub)
3. https://huggingface.co/new-space 접속
4. 설정:
   - **Space name**: `korean-dub`
   - **SDK**: Docker
   - **Hardware**: CPU basic (Free)
5. **Create Space** 클릭
6. Space가 생성되면 Git URL 복사 (예: `https://huggingface.co/spaces/USERNAME/korean-dub`)
7. 터미널에서:
   ```bash
   cd /Users/isangsu/Downloads/korean-dub
   git remote add hf https://huggingface.co/spaces/USERNAME/korean-dub
   git push hf main
   ```

### 방법 2: CLI로 배포

1. https://huggingface.co/settings/tokens 에서 **Write** 권한 토큰 생성
2. 터미널에서:
   ```bash
   cd /Users/isangsu/Downloads/korean-dub
   python3 -c "from huggingface_hub import login; login(token='YOUR_TOKEN')"
   python3 -c "from huggingface_hub import create_repo; create_repo('korean-dub', repo_type='space', space_sdk='docker')"
   git remote add hf https://huggingface.co/spaces/USERNAME/korean-dub
   git push hf main
   ```

---

## 필요한 환경변수 (배포 후 설정)

Hugging Face Space Settings에서 Secrets로 추가:

```
OPENAI_API_KEY=your_openai_key
XAI_API_KEY=your_xai_key
ELEVENLABS_API_KEY=your_elevenlabs_key
```

---

## 프로젝트 구조

```
korean-dub/
├── server.js          # Express 서버 (메인)
├── index.html         # 프론트엔드 UI
├── Dockerfile         # Docker 빌드 (ffmpeg, yt-dlp)
├── README.md          # HF Spaces 메타데이터 포함
├── package.json       # Node.js 의존성
├── koyeb.yaml         # Koyeb 설정
├── fly.toml           # Fly.io 설정
├── render.yaml        # Render 설정
└── nixpacks.toml      # Railway 설정
```

---

## 배포 완료 후 예상 URL

- Hugging Face: `https://huggingface.co/spaces/USERNAME/korean-dub`
