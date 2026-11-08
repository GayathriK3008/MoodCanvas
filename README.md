# MoodCanvas

MoodCanvas is a personal reflection journal built with Expo, React Native, Expo Router, and Supabase. It supports the web and mobile platforms, with a responsive desktop sidebar and mobile navigation.

## Features

- Email sign-up, verification, sign-in, and password updates
- Private journal reflections with mood selection and cloud synchronization
- Calendar, weekly and monthly insights, and reflection statistics
- Journal search, mood filtering, and date sorting
- Light, dark, and system appearance preferences
- Profile settings and JSON data export
- Optional daily local reminders on iOS and Android; reminders are unavailable on web

## Requirements

- Node.js and npm
- A Supabase project

## Configure Supabase

Create a local `.env` file in the project root with the Supabase project URL and **publishable/anon key**:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

These `EXPO_PUBLIC_` values are included in client builds. Never put a Supabase service-role key or other private credential in the app. Configure and verify Row Level Security policies in Supabase before using real user data.

## Run locally

```bash
npm install
npm run web
```

To run the Expo development server for other platforms:

```bash
npm start
```

## Build the website

Export the static web application:

```bash
npx expo export --platform web
```

The generated site is written to `dist/`. Deploy that directory to a static hosting provider. Configure the same public Supabase environment variables in the production build environment, and verify authentication redirect URLs in the Supabase project settings for the deployed domain.

For a local production-build preview, serve the `dist/` directory with a static HTTP server. Do not open the generated files directly from the filesystem.

## Quality checks

```bash
npx expo lint
npx tsc --noEmit
```

## Notes

- `app.json` keeps the existing Expo slug and URL scheme to avoid breaking app identity or existing deep links.
- Daily reminders request notification permission only when enabled and store their schedule locally on the device.
- Rebuild native development or production apps after changing the Expo notification plugin configuration.
- Journal records and account data are user-specific; test sign-in, synchronization, and Row Level Security with a non-production test account before launch.
- Deploying the static export does not configure a hosting provider, domain, Supabase production settings, or legal/privacy pages.
