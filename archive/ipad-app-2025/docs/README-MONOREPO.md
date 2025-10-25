# Smart Reader Monorepo

This repository contains both the web application and the iPad mobile application for Smart Reader.

## Structure

```
smart-reader-serverless/
├── packages/
│   ├── web/                    # Web application (React + Vite)
│   │   ├── src/               # Web-specific code
│   │   ├── api/               # Vercel API routes
│   │   ├── public/            # Static assets
│   │   ├── themes/            # Theme components
│   │   └── package.json       # Web dependencies
│   ├── mobile/                 # iPad application (Capacitor)
│   │   ├── src/               # Mobile entry point
│   │   ├── ios/               # Native iOS project (generated)
│   │   ├── capacitor.config.ts
│   │   └── package.json       # Mobile dependencies
│   └── shared/                 # Shared code between web and mobile
│       ├── src/
│       │   ├── components/    # React components
│       │   ├── services/      # API services, storage, etc.
│       │   ├── store/         # Zustand store
│       │   ├── hooks/         # Custom hooks
│       │   └── utils/         # Utilities
│       └── package.json       # Shared dependencies
├── package.json               # Root workspace configuration
└── README.md
```

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- For mobile development: macOS + Xcode + Apple Developer Account

### Installation

```bash
# Install all dependencies
npm run install:all

# Or install individually
cd packages/web && npm install
cd packages/mobile && npm install
cd packages/shared && npm install
```

### Running Applications

```bash
# Web application (default)
npm run web:dev
# or
npm run dev

# Mobile application
npm run mobile:dev

# Both simultaneously
npm run web:dev & npm run mobile:dev
```

### Building

```bash
# Web build
npm run web:build

# Mobile build
npm run mobile:build

# All builds
npm run build
```

## Mobile Development

### First Time Setup

1. Install Capacitor CLI globally:
   ```bash
   npm install -g @capacitor/cli
   ```

2. Initialize iOS platform:
   ```bash
   cd packages/mobile
   npm run sync
   npm run open:ios
   ```

3. Open Xcode and run the project on iPad simulator or device

### Mobile Commands

```bash
# Sync web assets to native project
npm run mobile:sync

# Open iOS project in Xcode
npm run mobile:open

# Build for production
npm run mobile:build
```

## Guardrails

This monorepo includes several guardrails to prevent accidental merges:

1. **GitHub Actions**: Prevents mobile changes from being merged to main branch
2. **Pre-commit hooks**: Blocks mobile commits on main branch
3. **CODEOWNERS**: Separate approval required for mobile changes
4. **Git attributes**: Prevents merge conflicts on mobile-specific files

### Branch Strategy

- `main`: Web application only (deploys to Vercel)
- `mobile/main`: Mobile application (separate deployment pipeline)
- Never merge mobile changes back to main

## Deployment

### Web Application
- Automatically deploys to Vercel from `main` branch
- Uses `packages/web/` as root directory
- No changes needed to existing deployment

### Mobile Application
- Builds iOS app from `packages/mobile/`
- Requires Xcode for final build
- Deploys to App Store via Xcode

## Shared Code

The `packages/shared/` directory contains code used by both web and mobile:

- **Components**: React components (PDFViewer, ChatModal, etc.)
- **Services**: API calls, storage, authentication
- **Store**: Zustand state management
- **Hooks**: Custom React hooks
- **Utils**: Helper functions

Both web and mobile import from `@shared/*` to use this code.

## Troubleshooting

### Mobile Build Issues
1. Clean iOS build: `cd packages/mobile/ios && xcodebuild clean`
2. Reinstall pods: `cd packages/mobile/ios/App && pod install`
3. Reset Capacitor: `cd packages/mobile && npx cap sync ios`

### Shared Code Issues
1. Rebuild shared package: `npm run shared:build`
2. Clear node_modules: `rm -rf node_modules packages/*/node_modules`
3. Reinstall: `npm run install:all`

### Git Issues
1. If pre-commit hook fails: `git commit --no-verify` (not recommended)
2. Check branch: `git branch --show-current`
3. Switch to mobile branch: `git checkout mobile/main`
