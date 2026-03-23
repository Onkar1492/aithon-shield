# Aithon Shield Mobile App

A React Native mobile app for the Aithon Shield security platform.

## Quick Start

### Option 1: Create New Replit Mobile Project (Recommended)
1. Go to Replit.com
2. Click "Create" and select "Mobile app"
3. Copy all files from this folder into your new project
4. Update `src/api/client.ts` with your backend URL
5. Run `npm install`
6. Start developing!

### Option 2: Use with Expo CLI
```bash
npm install
npx expo start
```

## Configuration

**IMPORTANT**: Update the API base URL in `src/api/client.ts`:

```typescript
const API_BASE_URL = 'https://YOUR-APP-NAME.replit.app/api';
```

Replace `YOUR-APP-NAME` with your actual Replit app URL.

## Project Structure

```
AithonShieldMobile/
├── App.tsx                 # App entry point
├── package.json            # Dependencies
├── app.json               # Expo configuration
├── src/
│   ├── api/               # API client & endpoints
│   │   ├── client.ts      # Axios configuration
│   │   ├── auth.ts        # Authentication API
│   │   └── scans.ts       # Scans & findings API
│   ├── components/        # Reusable UI components
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── ScanCard.tsx
│   │   └── SecurityScore.tsx
│   ├── contexts/          # React contexts
│   │   └── AuthContext.tsx
│   ├── navigation/        # Navigation setup
│   │   ├── AppNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── MainNavigator.tsx
│   ├── screens/           # Screen components
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── ScansScreen.tsx
│   │   ├── FindingsScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── theme/             # Colors & styling
│   │   └── colors.ts
│   └── types/             # TypeScript types
│       └── index.ts
└── assets/                # App icons & splash
```

## Features

- **Authentication**: Login/Register with secure token storage
- **Dashboard**: Security score, stats overview
- **Scans**: MVP, Web, and Mobile scan management
- **Findings**: View and filter security vulnerabilities
- **Settings**: User profile and app configuration

## Testing on Device

1. Install Expo Go on your phone
2. Scan the QR code from the Expo dev server
3. The app will load on your device

## Publishing to App Store

1. Build the app through Expo
2. Submit to TestFlight (iOS) or Play Console (Android)
3. Follow the store review process

## Color Scheme

- Primary: #3B82F6 (Blue)
- Accent: #06B6D4 (Cyan)
- Background: #0F172A (Dark)
- Surface: #1E293B

## Dependencies

- React Native with Expo
- React Navigation for navigation
- TanStack Query for data fetching
- Axios for API calls
- Expo Secure Store for token storage
