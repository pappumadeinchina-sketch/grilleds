# PulseChat 💬👓
### Professional Full-Stack WhatsApp Alternative, Account Automation API & Smart Glasses IoT Bridge

PulseChat is a modern, responsive web application designed for desktop, tablet, and mobile browsers with WhatsApp-grade chat features, real-time WebRTC audio/video calling, rich multimedia support (PDF in-app viewer, voice notes, stickers, music), personal automation REST API keys, and specialized headless endpoints for wearable hardware projects like **Bluetooth Glasses + Raspberry Pi**.

---

## 🚀 Key Features

### 1. WhatsApp-Grade GUI (All Devices)
- **Glassmorphic WhatsApp Dark & Light Modes**: Seamless responsive experience across mobile phones, tablets, and wide monitors.
- **Real-Time Messaging**: Built on Socket.IO with double ticks (`✓✓` delivered/read), online status, and typing indicators.
- **🎙️ Voice Notes**: In-browser recording with animated waveform equalizer and one-touch playback.
- **📄 In-App PDF Viewer**: Open, read, and inspect PDF attachments without navigating away from the chat screen.
- **🎵 Music & Songs**: Built-in audio track player for shared songs, recordings, and audio files.
- **🎨 Stickers & Emojis**: Curated sticker drawer with high-resolution vector and animated stickers.
- **📷 Photos & Videos**: Inline image previews and video playback.

### 2. Peer-to-Peer WebRTC Audio & Video Calling
- Browser-to-browser voice and video calling.
- Real-time ringtone notifications, incoming call accept/reject modals, microphone mute, and camera toggle controls.

### 3. Developer Account Automation API
Every registered user has their own personal **API Key** (accessible directly in the UI under Developer API):
- **Send Messages**: `POST /api/v1/messages/send`
- **Read Recent Messages**: `GET /api/v1/messages/recent`
- **Trigger Calls**: `POST /api/v1/calls/initiate`

### 4. 👓 Bluetooth Glasses + Raspberry Pi Integration
Dedicated low-overhead headless endpoints engineered specifically for wearable computing:
- `GET /api/v1/iot/glasses/status`: Checks active incoming calls and unread counts for bone-conduction audio chime alerts.
- `POST /api/v1/iot/glasses/voice-command`: Transmits voice-to-text transcriptions or audio files spoken into the glasses microphone.
- `POST /api/v1/iot/glasses/quick-call`: Triggers one-touch voice calls to contacts directly from glasses touch buttons.
- Ready-to-run Python client included in [`client-pi/glasses_client.py`](file:///C:/Users/7yf57/.gemini/antigravity/scratch/pulsechat/client-pi/glasses_client.py).

---

## 🛠️ Local Quickstart

### Prerequisites
- Node.js (v18+)
- Python 3 (optional, for Raspberry Pi client testing)

### Installation & Run
```bash
cd pulsechat
npm install
node server/seed.js   # Seeds demo accounts: alice, bob, glasses_user
node server/index.js
```
Open **`http://localhost:3000`** in your browser.

---

## 🌐 Deploying to Render.com

PulseChat is pre-configured for **Render** via [`render.yaml`](file:///C:/Users/7yf57/.gemini/antigravity/scratch/pulsechat/render.yaml) and [`Dockerfile`](file:///C:/Users/7yf57/.gemini/antigravity/scratch/pulsechat/Dockerfile):

1. Push this folder to a GitHub or GitLab repository.
2. In [Render Dashboard](https://dashboard.render.com), click **New +** -> **Web Service**.
3. Select your repository.
4. Set:
   - **Environment**: `Node`
   - **Build Command**: `npm install && node server/seed.js`
   - **Start Command**: `node server/index.js`
5. Render will automatically bind the service to `PORT` and provide your public HTTPS/WSS URL (`https://your-service.onrender.com`).

---

## 👓 Running on Raspberry Pi with Bluetooth Glasses

1. Pair your Bluetooth Glasses (microphone + bone conduction speakers) with your Raspberry Pi via `bluetoothctl`.
2. Copy the `client-pi` folder to your Raspberry Pi:
   ```bash
   pip install requests
   python3 glasses_client.py --server https://your-service.onrender.com --api-key <YOUR_API_KEY> --daemon
   ```
3. To test sending a voice transcription message from glasses:
   ```bash
   python3 glasses_client.py --server https://your-service.onrender.com --api-key <YOUR_API_KEY> --send-to alice --message "Testing my Bluetooth Glasses!"
   ```
