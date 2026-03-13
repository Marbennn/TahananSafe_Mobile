# TahananSafe

# How To Run in terminal

npm install expo
"Run on ios"
npx expo start -c --dev-client --tunnel
"Run on android"
npx expo start -c

# install Dependencies in terminal

npx expo install react-native-safe-area-context expo-linear-gradient react-native-svg @expo/vector-icons react-native-screens react-native-gesture-handler react-native-reanimated
npm install react-native-svg-transformer @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs

npx expo install expo-constants
npx expo install @react-native-async-storage/async-storage
npx expo install @react-native-community/datetimepicker
npx expo install @react-native-community/datetimepicker
npx expo install expo-location

npx expo install expo-local-authentication expo-secure-store

# Download Cloudflared on (CMD)

winget install Cloudflare.cloudflared

# then start CloudFlared server

cloudflared tunnel --url http://localhost:8000

cloudflared tunnel run tahanansafe-api

# For Instaling Pre Build

cd C:\Users\INTEL\OneDrive\Documents\GitHub\TahananSafe_Mobile

cd android

cmd /c "set ""JAVA_HOME=C:\Program Files\Java\jdk-17.0.2"" && set ""PATH=%JAVA_HOME%\bin;%PATH%"" && gradlew.bat :app:installDebug"
