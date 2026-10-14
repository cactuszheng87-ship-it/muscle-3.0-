# 薄肌3.0 MVP

A responsive, sea-blue fitness dashboard prototype. Personal starter plans, meal estimates, activity scores, and progress share cards run in the browser. Food-photo recognition is clearly marked as a demo placeholder: no vision model, AI API, account, or cloud backend is connected. Plans, meals, and activity logs stay in the current browser's local storage.

## Run locally on a Mac

1. Install the current LTS version of [Node.js](https://nodejs.org/) if you do not already have it.
2. Open this folder in VS Code.
3. Open its terminal and run:

   ```bash
   npm install
   npm run dev
   ```

4. Visit `http://localhost:3000`.

## What works in this MVP

- Responsive navigation between the overview, plan, nutrition, and progress views.
- Blue login landing page with local demo registration or guest entry, plus a logout control.
- Personal plan: age, height, weight, goal, activity level, experience, days, and equipment inform a rule-based weekly schedule and broad maintenance-energy range.
- Nutrition: photo preview, explicitly simulated suggestions, editable foods and portions, calculated calories/macros, a meal-balance score, and local saving.
- Progress: log activity type and duration; the weekly score uses aerobic minutes and strength days. Create an image-plus-text card for sharing.
- Local persistence across reloads in the same browser. Data does not sync between devices.
- The Progress page includes a confirmation-protected control to clear locally saved app data.

## Next implementation steps

To turn this prototype into a production service, add authentication and a database, then connect a nutrition data provider and a secure server-side AI vision endpoint. Keep user review and confirmation for every estimated portion.
