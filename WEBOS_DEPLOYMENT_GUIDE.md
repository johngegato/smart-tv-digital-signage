# LG webOS TV & Devant Smart TV Deployment Guide

This guide provides instructions for deploying and playing the **Smart TV Digital Signage** application on **Devant Smart TVs** and **LG webOS TVs**.

---

## 🚀 App Package Details

- **App ID:** `com.devant.smarttv.signage`
- **Resolution:** `1920x1080` (Full HD TV optimized canvas)
- **Target OS:** LG webOS TV 3.0+ / Devant Smart TV (webOS Edition)
- **Remote Controls Supported:** LG Magic Remote, Standard D-Pad Remote, Virtual D-Pad Overlay, Keyboard (`Arrow Keys`, `Enter`, `KeyCode 461 Back Button`, `Color Shortcut Keys`)

---

## 📌 Method 1: Native Installation via webOS CLI (`ares-package`)

If you have the **LG webOS TV SDK** (webOS TV CLI) installed on your computer:

### Step 1: Install webOS TV CLI (Optional)
Download from [LG webOS TV Developer Site](https://webostv.developer.lge.com/develop/tools/cli-dev-guide).

### Step 2: Package the App into `.ipk`
Open your terminal in `smart-tv-digital-signage-webos/` and run:
```bash
ares-package . --no mini
```
This generates `com.devant.smarttv.signage_1.0.0_all.ipk`.

### Step 3: Connect to your Devant / LG TV
Enable **Developer Mode** on your TV via the **Developer Mode App** (available on LG webOS Content Store):
```bash
# Add TV device (Replace TV_IP with your Devant TV IP address)
ares-setup-device

# Install package onto TV
ares-install --device devant-tv com.devant.smarttv.signage_1.0.0_all.ipk

# Launch application on TV
ares-launch --device devant-tv com.devant.smarttv.signage
```

---

## 💾 Method 2: Sideloading via USB Drive (Devant / LG webOS TV)

You can run the web app directly from a USB flash drive on your Devant Smart TV:

1. Format a USB Flash Drive to **FAT32** or **NTFS**.
2. Create a folder named `developer` at the root of the USB drive.
3. Inside `developer`, create `apps/usr/palm/applications/com.devant.smarttv.signage/`.
4. Copy all files from `smart-tv-digital-signage-webos/` into that folder:
   ```
   USB:\developer\apps\usr\palm\applications\com.devant.smarttv.signage\
     ├── appinfo.json
     ├── index.html
     ├── css/
     ├── js/
     └── assets/
   ```
5. Plug the USB drive into your Devant Smart TV USB port.
6. Open **Developer Mode App** on the TV or select the app icon from the TV app menu launcher.

---

## 🌐 Method 3: Local Network Hosting / Browser Mode

You can also host the application on your local network and launch it using your Devant Smart TV's built-in web browser:

1. Run the local HTTP server on your computer:
   ```powershell
   python -m http.server 3000
   ```
2. Find your computer's local IP address (e.g. `192.168.1.100` via `ipconfig`).
3. On your Devant Smart TV, open the **Web Browser app**.
4. Enter the URL: `http://192.168.1.100:3000`
5. Press **F** (or click the Fullscreen button ⛶) to hide browser toolbars and enter 100% full-screen digital signage mode!

---

## 🎮 Remote Control Key Mapping Reference

| Key / Button | Action |
|---|---|
| **D-Pad Up / Down / Left / Right** | 4-Directional Spatial Element Focus Navigation |
| **OK / Enter / Space** | Select Focused Element / Play & Pause Media |
| **Back Key (KeyCode 461 / Esc)** | Close Studio Drawer / Modal / Control Overlay |
| **🔴 Red Button (Key 1)** | Switch to **Fullscreen Layout** |
| **🟢 Green Button (Key 2)** | Switch to **Split-Screen Layout** |
| **🟡 Yellow Button (Key 3)** | Switch to **Grid Layout** |
| **🔵 Blue Button (Key S)** | Open / Close **Campaign Studio Drawer** |
| **Media Play / Pause / Stop** | Control video/ad playback directly |
| **M / Mute Key** | Mute / Unmute Audio |

---

## 🔒 Auto-Play & TV Audio Policy Note
Smart TV browsers mute audio by default upon initial launch. Press **OK / Enter / Space** or click the **Audio Muted** banner on the TV screen once to activate unmuted audio playback. Screen saver prevention is handled automatically via `js/webos.js`.


tobe add:


# Implementation Plan - TV Profiles, Clean Media Display & Desktop QR Manager

Add multi-device TV Profiles (allowing individual TV targeting for media uploads), remove file-name campaign title overlays from display media, and enable editing the QR Code widget directly from the Desktop Signage Manager.

## User Review Required

> [!IMPORTANT]
> 1. **Multi-TV Profile Support**: Each TV app will now have a unique **Device Profile ID & Name** (e.g. "Lobby Screen", "Menu Board A"). In the Desktop Manager, operators can view connected TV profiles and send media/playlists to **All TVs** or a **Specific TV Profile**.
> 2. **Clean Display (Remove Filename Titles)**: The lower-third caption overlay displaying raw media file names on top of videos/images during playback will be removed/disabled for clean commercial presentation.
> 3. **Desktop QR Code Editor**: Adds a QR Code editor panel in Desktop Signage Manager to update QR URL and label on TV screens remotely.

## Proposed Changes

### TV Web Application

#### [MODIFY] [player.js](file:///c:/Users/ADMIN/Documents/ANTIGRAVITY/DIGITAL%20SIGNAGE/smart-tv-digital-signage-webos/js/player.js)
- Disable/hide the auto-displaying lower third caption overlay (`#media-caption-overlay`) so media plays cleanly without filename titles overlaid.

#### [MODIFY] [index.html](file:///c:/Users/ADMIN/Documents/ANTIGRAVITY/DIGITAL%20SIGNAGE/smart-tv-digital-signage-webos/index.html)
- Add "TV Profile Name" input field in the Desktop Remote Server connect card in Studio drawer so users can label each TV (e.g. `Lobby TV`, `Menu Screen`).

#### [MODIFY] [websocket.js](file:///c:/Users/ADMIN/Documents/ANTIGRAVITY/DIGITAL%20SIGNAGE/smart-tv-digital-signage-webos/js/websocket.js)
- Include `deviceId` and `deviceName` in WebSocket identification: `{ type: 'identify', role: 'tv', deviceId, deviceName }`.
- Add listener for `{ type: 'set_qr', url, label }` command to update QR Code widget remotely.

#### [MODIFY] [app.js](file:///c:/Users/ADMIN/Documents/ANTIGRAVITY/DIGITAL%20SIGNAGE/smart-tv-digital-signage-webos/js/app.js)
- Save and pass TV Device Profile ID/Name to WebSocket client.
- Handle remote `set_qr` command from server.

---

### Desktop Manager Backend & Web UI

#### [MODIFY] [server.js](file:///c:/Users/ADMIN/Documents/ANTIGRAVITY/DIGITAL%20SIGNAGE/smart-tv-digital-signage-webos/server/server.js)
- Upgrade WebSocket server to maintain a map of active TV devices by `deviceId` / `deviceName`.
- Support profile-targeted message routing (`targetDeviceId: 'all'` or specific `deviceId`).

#### [MODIFY] [manager.js](file:///c:/Users/ADMIN/Documents/ANTIGRAVITY/DIGITAL%20SIGNAGE/smart-tv-digital-signage-webos/server/public/manager.js)
#### [MODIFY] [index.html (Server Public)](file:///c:/Users/ADMIN/Documents/ANTIGRAVITY/DIGITAL%20SIGNAGE/smart-tv-digital-signage-webos/server/public/index.html)
- Add **TV Profile Selector** dropdown in header/upload form to select target TV (`All Connected TVs` or specific TV profile).
- Add **QR Code Manager** section in Desktop Signage Manager to edit QR target URL and caption text, broadcasting `set_qr` to TVs.
- Filter playlist display per selected TV profile.

## Verification Plan

### Automated Tests
- Syntax & ES Module import verification.

### Manual Verification
- Test setting custom TV Profile Names on TV app (e.g., `TV-1 Lobby`, `TV-2 Kitchen`).
- Verify Desktop Manager lists connected TV profiles and allows selecting specific TV target for uploads.
- Verify media playback renders clean without filename overlay titles.
- Verify changing QR Code URL & label in Desktop Signage Manager updates TV screen instantly over WebSocket.
