@echo off

echo =====================================
echo Switching to production config...
echo =====================================

(
echo {
echo   "appId": "com.dreamhouse.app",
echo   "appName": "DreamHouse",
echo   "webDir": "dist"
echo }
) > capacitor.config.json

echo.
echo Config ready

echo =====================================
echo Building React App
echo =====================================

call npm run build

echo.
echo Build finished

echo =====================================
echo Copying to Android
echo =====================================

call npx cap copy android

echo.
echo Copy finished

echo =====================================
echo Sync Capacitor
echo =====================================

call npx cap sync android

echo.
echo Sync finished

echo =====================================
echo Opening Android Studio
echo =====================================

call npx cap open android

echo.
echo Done