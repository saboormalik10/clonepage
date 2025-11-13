#!/bin/bash
# Script to get your local IP address for mobile access

echo "🌐 Finding your local IP address..."
echo ""

# Try different methods to get local IP
if command -v ip &> /dev/null; then
    # Linux with ip command
    IP=$(ip route get 8.8.8.8 2>/dev/null | grep -oP 'src \K\S+' | head -1)
elif command -v ifconfig &> /dev/null; then
    # macOS/Linux with ifconfig
    IP=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1)
elif command -v hostname &> /dev/null; then
    # Fallback method
    IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

if [ -z "$IP" ]; then
    echo "❌ Could not automatically detect IP address"
    echo ""
    echo "Please find your IP manually:"
    echo "  - Windows: ipconfig (look for IPv4 Address)"
    echo "  - macOS/Linux: ifconfig or ip addr"
    echo ""
    echo "Then access the app at: http://YOUR_IP:3000"
else
    echo "✅ Your local IP address is: $IP"
    echo ""
    echo "📱 To access from your mobile device:"
    echo "   1. Make sure your phone is on the same Wi-Fi network"
    echo "   2. Open your mobile browser"
    echo "   3. Go to: http://$IP:3000"
    echo ""
    echo "💡 If it doesn't work, check your firewall settings"
fi

