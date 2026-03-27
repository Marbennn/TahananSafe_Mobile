# TahananSafe Mobile

A React Native mobile application built with Expo for reporting and managing domestic safety incidents. Features include incident logging with AI analysis, real-time push notifications, biometric authentication, PIN security, emergency hotlines, and blockchain-backed report integrity.

## Prerequisites

- **Node.js** >= 18.x (recommended: v24+)
- **npm** >= 9.x
- **Expo CLI** (`npm install -g expo-cli`)
- **EAS CLI** (`npm install -g eas-cli`) - for building native binaries
- **Android Studio** - for Android development (with Android SDK)
- **Xcode** - for iOS development (macOS only)
- **Cloudflared** - for tunneling the backend API during development
- **Java JDK 17** - required for Android Gradle builds
- **Expo Go** or a **development build** installed on your device/emulator

## Tech Stack

- **React Native** 0.81.5
- **Expo** SDK 54
- **TypeScript** 5.9
- **React Navigation** (native-stack, bottom-tabs)
- **Expo SecureStore** - encrypted credential storage
- **Expo Notifications** - push notifications via FCM/APNs
- **Expo Local Authentication** - biometric (Face ID / fingerprint)
- **Expo Image Picker** - photo evidence capture
- **Expo Location** - geolocation for incidents
- **Expo Speech Recognition** - voice-to-text for incident logging
- **React Native Reanimated** - animations
- **React Native SVG** - vector graphics

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-org/TahananSafe_Mobile.git
cd TahananSafe_Mobile
```

### 2. Install dependencies

```bash
npm install
```

If you need to reinstall Expo-specific packages:

```bash
npx expo install react-native-safe-area-context expo-linear-gradient react-native-svg @expo/vector-icons react-native-screens react-native-gesture-handler react-native-reanimated
npm install react-native-svg-transformer @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npx expo install expo-constants @react-native-async-storage/async-storage @react-native-community/datetimepicker expo-location expo-local-authentication expo-secure-store expo-image-picker expo-notifications expo-device expo-speech-recognition expo-splash-screen expo-status-bar expo-dev-client
```

### 3. Configure environment

Create or update `src/config/` with your backend API URL. The app connects to the TahananSafe Backend API for all data operations.

### 4. Firebase setup (Android push notifications)

Place your `google-services.json` file in the project root. This is required for FCM push notifications on Android.

## Running the App

### Android (recommended for development)

```bash
npx expo start --dev-client --tunnel --clear
```

Requires a development build. Press `i` to open on an iOS simulator.

### Web (limited support)

```bash
npx expo start --web
```

## Building Native Binaries

### Development build (for testing native modules)

```bash
eas build --profile development --platform android
eas build --profile development --platform ios
```

### Android APK (manual Gradle build)

```bash
cd android
# Windows:
cmd /c "set "JAVA_HOME=C:\Program Files\Java\jdk-17.0.2" && set "PATH=%JAVA_HOME%\bin;%PATH%" && gradlew.bat :app:installDebug"
# macOS/Linux:
./gradlew :app:installDebug
```

### Production build

```bash
eas build --profile production --platform android
eas build --profile production --platform ios
```

## Backend API Tunnel (Development)

The app connects to the TahananSafe Backend API. During local development, use Cloudflared to expose your local backend:

### Install Cloudflared

```bash
# Windows
winget install Cloudflare.cloudflared

# macOS
brew install cloudflared
```

### Start the tunnel

```bash
# Quick tunnel (generates a temporary URL)
cloudflared tunnel --url http://localhost:8000

# Or use a named tunnel
cloudflared tunnel run tahanansafe-api
```

Update the API URL in your mobile app config to match the tunnel URL.

## Project Structure

```
TahananSafe_Mobile/
├── App.tsx                  # Root component, navigation, auth flow
├── index.js                 # Entry point
├── app.json                 # Expo configuration
├── eas.json                 # EAS Build profiles
├── src/
│   ├── api/                 # API client modules
│   │   ├── http.ts          # HTTP client with auth interceptor
│   │   ├── ai.ts            # AI analysis API
│   │   ├── auth.ts          # Authentication API
│   │   ├── incidents.ts     # Incident CRUD
│   │   ├── reports.ts       # Report fetching & evidence URLs
│   │   ├── pin.ts           # PIN verification API
│   │   ├── notifications.ts # Push notification API
│   │   └── ...
│   ├── auth/                # Authentication & session management
│   │   ├── AuthContext.tsx   # Auth state provider
│   │   ├── session.ts       # Token storage (SecureStore)
│   │   └── authStorage.ts   # Auth persistence helpers
│   ├── components/          # Reusable UI components
│   │   ├── BottomNavBar.tsx  # Main tab navigation
│   │   ├── IdleTimerWrapper  # Auto-lock on idle
│   │   ├── LogoutModal.tsx   # Logout confirmation
│   │   └── ...              # Screen-specific components
│   ├── screens/             # App screens
│   │   ├── HomeScreen.tsx
│   │   ├── IncidentLogScreen.tsx
│   │   ├── IncidentLogConfirmationScreen.tsx
│   │   ├── ReportScreen.tsx
│   │   ├── ReportDetailScreen.tsx
│   │   ├── EmergencyScreen.tsx
│   │   ├── HotlinesScreen.tsx
│   │   ├── PinScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── SignupScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   └── ...
│   ├── config/              # App configuration
│   ├── theme/               # Colors, styling
│   ├── utils/               # Utilities
│   │   ├── safeLog.ts       # Dev-only logging (no sensitive data in prod)
│   │   ├── pushNotifications.ts
│   │   ├── responsive.ts    # Responsive scaling helpers
│   │   └── hideApp.ts       # Quick exit / app hide
│   └── native/              # Native module specs
├── assets/                  # Images, icons, splash screen
├── android/                 # Android native project
└── scripts/                 # Build & utility scripts
```

## Key Features

- **Incident Logging** - Log domestic safety incidents with text, photos, location, and voice input
- **AI Analysis** - Automated incident analysis with confidence scoring, safety tips, and submission validation
- **Report Tracking** - View report status, details, and threaded communication with administrators
- **Push Notifications** - Real-time notifications for report updates
- **PIN & Biometric Security** - PIN code with brute-force protection + Face ID / fingerprint unlock
- **Quick Exit** - Instantly hide the app for user safety
- **Dark Mode** - Full dark mode support
- **Emergency Hotlines** - Quick access to emergency contact numbers
- **Blockchain Integrity** - Report hashing for tamper-proof verification

## Related Repositories

| Project | Description |
|---------|-------------|
| **TahananSafe_Backend** | Node.js/Express API server with MongoDB |
| **TahananSafe_Web** | React web dashboard for administrators |
| **TahananSafe_AI** | Python AI service for incident analysis |
