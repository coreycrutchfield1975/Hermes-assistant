@echo off
:: KITT Jarvis Bridge — Auto-start script
:: Run this when Windows boots to start the Hermes bridge + Cloudflare tunnel

echo =============================================
echo   KITT Jarvis Bridge — Starting Services
echo =============================================
echo.

:: Kill any stale processes
echo [+] Cleaning up old processes...
taskkill /f /fi "WINDOWTITLE eq hermes-bridge" 2>nul
taskkill /f /im node.exe 2>nul
taskkill /f /im cloudflared.exe 2>nul
timeout /t 2 /nobreak >nul

:: Start the Hermes bridge server
echo [+] Starting Hermes Bridge Server...
start "hermes-bridge" /min cmd /c "cd /d C:\Users\corey\hermes-assistant && node server/hermes-bridge.js"

:: Wait for bridge to be ready
timeout /t 4 /nobreak >nul

:: Start Cloudflare tunnel
echo [+] Starting Cloudflare Tunnel...
start "cloudflared" /min cmd /c "C:\Users\corey\hermes-assistant\cloudflared.exe tunnel --url http://127.0.0.1:8645"

:: Wait for tunnel
timeout /t 6 /nobreak >nul

:: Update the tunnel URL on Vercel (grab it from cloudflared's log output)
echo [+] Updating tunnel URL on Vercel...

:: Get the tunnel URL from cloudflared process output
:: (We'll have to parse the cloudflared log or prompt)
:: For now, just print and let user verify

echo.
echo =============================================
echo   KITT Bridge is running!
echo =============================================
echo.
echo   Important: The Cloudflare tunnel URL changes
echo   each time. You need to update the HERMES_BRIDGE_URL
echo   env var on Vercel with the new URL.
echo.
echo   To find the URL:
echo     Look for "Your quick Tunnel has been created!"
echo     line in this terminal window.
echo.
echo   To update Vercel:
echo     hermes config or Vercel dashboard
echo.
echo   Open KITT at:
echo     https://hermes-jarvis-app.vercel.app
echo.
pause
