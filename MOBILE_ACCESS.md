# 📱 Accessing the App from Mobile Device

## Quick Start

1. **Start the dev server for mobile access:**
   ```bash
   yarn dev:mobile
   ```
   or
   ```bash
   npm run dev:mobile
   ```

2. **Find your local IP address:**
   ```bash
   bash scripts/get-local-ip.sh
   ```
   
   Or manually:
   - **Windows**: Run `ipconfig` and look for "IPv4 Address"
   - **macOS/Linux**: Run `ifconfig` or `ip addr` and look for your network interface IP

3. **On your mobile device:**
   - Make sure your phone is connected to the **same Wi-Fi network** as your computer
   - Open your mobile browser (Chrome, Safari, etc.)
   - Go to: `http://YOUR_IP:3000`
   
   Example: `http://192.168.1.11:3000`

## Your Current IP Address

Based on your system, your local IP is likely: **192.168.1.11**

So you would access it at: **http://192.168.1.11:3000**

## Troubleshooting

### Can't access from mobile?

1. **Check firewall:**
   - Make sure your firewall allows connections on port 3000
   - On Linux, you might need to run:
     ```bash
     sudo ufw allow 3000
     ```

2. **Verify same network:**
   - Both devices must be on the same Wi-Fi network
   - Check your phone's Wi-Fi settings

3. **Try different IP:**
   - Your IP might have changed
   - Run `bash scripts/get-local-ip.sh` again to get the current IP

4. **Check if server is running:**
   - Make sure you started the server with `yarn dev:mobile`
   - You should see "Ready" message in the terminal

### Testing PWA Features

Once you can access the app on mobile:
- You can test the "Add to Home Screen" feature
- The app will show "Hotshot Social" as the name
- Your logo will appear as the icon

## Commands Summary

| Command | Description |
|---------|-------------|
| `yarn dev` | Start dev server (localhost only) |
| `yarn dev:mobile` | Start dev server (accessible from network) |
| `bash scripts/get-local-ip.sh` | Find your local IP address |

