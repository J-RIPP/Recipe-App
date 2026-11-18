# Our Recipes

Shared vegetarian recipe app for two phones. An Android APK, plus the same app on the web.

- **Add recipes without JSON**: paste a recipe link (reads the recipe data on the page), paste an Instagram/TikTok caption, snap a photo of a recipe card, or type it in.
- **Recipes**: search (also by ingredient), categories, favourites, ratings, notes, servings scaler.
- **Planner**: 14 days ahead (past week on request). **Plan my week** fills 3, 5 or 7 days automatically: never the same recipe within the chosen gap (default: not two days in a row), prefers variety, ratings and dinners that fit your macro targets. Swap any day or shuffle the lot.
- **Macros**: per serving, from the recipe website when available, otherwise estimated from the ingredient amounts (built-in table of ~150 common ingredients), or entered by hand. Daily targets per person in Settings; dinner = a share of the day (default 35%).
- **Shopping list**: built from the planner, grouped by aisle, plus your own items. Ticks sync live.
- **Cook mode**: one step at a time, screen stays on.
- **Offline**: everything works without signal and syncs when you're back online.

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | React + Vite | One codebase for web and Android |
| Android | Capacitor 7 | Wraps the web app as a real APK; native HTTP makes link import work |
| Database | Firebase Firestore (free Spark plan) | Never pauses (Supabase free pauses after 7 days idle), live sync, offline cache |
| Auth | Firebase email/password | Accounts created in the console; access limited by `firestore.rules` |
| Photos | Compressed in-app (~100 KB) and stored in Firestore | No separate storage service or API key |
| Build | GitHub Actions → Releases | Every push builds a signed APK |

## Firebase setup (once)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (Analytics can be off).
2. **Build › Firestore Database › Create database** → location `europe-west4` (or `eur3`) → production mode.
3. **Build › Authentication › Get started › Email/Password** → enable. Then **Users › Add user** for each of you.
4. **Firestore › Rules** → paste `firestore.rules`, put your two emails in, **Publish**.
5. **Project settings › Your apps › Web (`</>`)** → register → copy the `firebaseConfig` block.
6. Open the app → paste the config → sign in. Or paste it into `src/firebase-config.js` and push, so the APK has it built in.

## Install on Android

Open on the phone: **https://github.com/J-RIPP/Recipe-App/releases/latest/download/OurRecipes.apk**
→ open the download → allow "install unknown apps" for your browser the first time. New versions install over the old one; your data stays.

## Moving data from the old app

Settings → **Import from the old app** copies all recipes from the old Supabase database (restore the project at supabase.com first if it's paused). **Import JSON files** still accepts the old `.json` files.

## Develop

```bash
npm install
npm run dev      # web version at localhost:5173
npm test         # parser / grouping tests
npm run build && npx cap sync android   # then open android/ in Android Studio, or let CI build
```

The release keystore (`android/app/release.jks`) is committed so CI can sign updates with the same key without repository secrets. To harden: move it to Actions secrets (`KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` are read from the environment).
