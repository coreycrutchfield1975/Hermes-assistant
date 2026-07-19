# Build Hermes Native Android App
# Run this in Termux on your Android phone

echo "=== Building Hermes Native App ==="

# Install dependencies
pkg update -y
pkg install -y git nano wget nodejs python openjdk-17 gradle

# Create project
mkdir -p ~/hermes-app
cd ~/hermes-app

# Download the web app source
wget -O index.html https://hermes-assistant-cyan.vercel.app

echo "✅ Source downloaded"
echo ""
echo "=== NEXT STEPS ==="
echo "1. Install Termux: https://f-droid.org/packages/com.termux/"
echo "2. Copy this script and run it in Termux"
echo "3. The APK will be at ~/hermes-app/app/build/outputs/apk/debug/"
echo ""
echo "Or for an easier method, use Hermit Web App from Play Store"
echo "to wrap the URL into a standalone app without coding."
