# GYM_SUBSCRIPTION

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

```bash
   npm install
```

2. Start the app

```bash
   npx expo start
```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
## GymFit Admin Console update

The Admin Console uses a solid near-black background (`ADMIN.bg`) with dark panels and crimson accents; it does not use a gym photograph as its background. The optional Home banner is managed separately in Admin > Gym and is displayed on the member Home screen only when an Admin uploads one. The member home screen also reads saved gym information from Supabase and displays available contact, hours, capacity, and announcement details. Membership plan and gym information updates listen for Supabase Realtime changes when those tables are enabled for Realtime.

### Local setup

1. Install Node.js (use a version supported by the Expo SDK in `package.json`).
2. Run `npm install` in this folder.
3. Copy `.env.example` to `.env` and enter your own Supabase project URL and anon/publishable key. Do not commit or share `.env`.
4. In the Supabase SQL Editor, apply the project's schema and migration scripts in their documented order. In particular, `supabase/phase3.sql` must run after `phase2.sql`, and `supabase/phase4.sql` must run after `phase3.sql`.
5. Run `npx expo start` (or `npm run web` for the web version).

### Supabase notes

- The revised `admin_dashboard_stats()` in `supabase/phase4.sql` calculates members without a membership from each member's latest subscription record, and the expiring preview also uses only the latest record.
- `gym_info` already has an authenticated SELECT policy in Phase 4. Enable Supabase Realtime for `plans` and `gym_info` if live updates are desired while the member app remains open. A fresh app launch also performs the initial data fetch.
- The SQL changes are source updates only until `supabase/phase4.sql` is run in the connected Supabase project. No live database was changed by this project edit.
