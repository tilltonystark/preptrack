# PrepTrack — IIT Jodhpur Interview Prep Tracker

A full-stack web app to help you systematically prepare for IIT Jodhpur M.Des / M.Tech (M-test) entrance exams. Track questions, practice your answers, and generate targeted questions using AI.

## Features

- ✅ Google Sign-In (Firebase Auth)
- 📚 Categorised question bank with 6 default categories
- 🎯 Practice mode with reveal-and-mark workflow
- 🤖 AI question generation via Grok API (xAI)
- 📄 PDF / TXT document upload for AI context
- 🎙️ Voice note links (Google Drive)
- 📊 Progress tracking per category with visual rings
- 🏆 Mastery system (3 practices = mastered)

---

## Setup Guide

### Step 1: Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"** → Enter project name (e.g. `preptrack-app`) → Create
3. Once created, click **"Web"** icon (`</>`) to add a web app
4. Register the app (any nickname) — copy the **firebaseConfig** object shown

### Step 2: Enable Google Authentication

1. In Firebase Console → **Authentication** → **Sign-in method**
2. Enable **Google** provider → Save

### Step 3: Enable Firestore

1. In Firebase Console → **Firestore Database** → **Create database**
2. Choose **Start in production mode** (rules are provided in `firestore.rules`)
3. Select a region close to you (e.g. `asia-south1` for India)
4. Deploy the rules: paste the contents of `firestore.rules` in the **Rules** tab

### Step 4: Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in your Firebase config values from Step 1:
   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123
   ```
3. The Grok API key is already pre-filled in `.env.example`

### Step 5: Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deployment (Firebase Hosting)

```bash
npm run build
npx firebase login
npx firebase init hosting
# Set public directory to: dist
# Configure as SPA: Yes
npx firebase deploy --only hosting
```

---

## Project Structure

```
preptrack/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # Route-level page components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Firebase, Firestore, Grok API
│   ├── context/        # Auth context
│   ├── App.jsx         # Router + protected routes
│   └── main.jsx        # Entry point
├── firestore.rules     # Firestore security rules
├── .env.example        # Environment variable template
└── README.md
```

---

## Default Question Categories

1. Personal Questions
2. Case Study Questions
3. XR & Emerging Tech Questions
4. Branch / Discipline Questions
5. Research & Thesis Questions
6. Current Affairs & Design

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| Auth | Firebase Authentication (Google) |
| Database | Firestore |
| AI | Grok API (xAI) — `grok-3` model |
| Hosting | Firebase Hosting |
