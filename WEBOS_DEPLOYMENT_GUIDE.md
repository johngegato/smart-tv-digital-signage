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
ares-package .
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
