FROM node:20-slim

# FFmpeg 및 rubberband 설치
RUN apt-get update && apt-get install -y \
    ffmpeg \
    librubberband-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

# temp 디렉토리 생성
RUN mkdir -p temp

EXPOSE 3000

CMD ["npm", "start"]
