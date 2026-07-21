# Agent Instructions & Project Guidelines

- **IMPORTANT - PRESERVED FEATURES**: Do NOT remove the "Seed Data" (in `Dashboard.tsx`) and "Purge Data" (in `Auth.tsx`) features during any refactors. They are currently hidden/disabled (`className="hidden ..."` / `disabled={true}`) but the underlying logic and buttons must be retained in the codebase for future use.

## Project Architecture & Tech Stack
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS.
- **Backend/Database**: Firebase (Firestore & Authentication).
- **Icons**: `lucide-react`.
- **Charting**: `recharts` (Used in `ProgressChart.tsx` and `IntensityChart.tsx`).

## Data Model (Firestore)
- **`userPlans` Collection**: Stores custom workout plans. Document ID is the user's `uid`. Contains exercise definitions categorized by intensity (`Heavy`, `Light`, `Medium`), target sets/reps/rest, and exercise metadata (notes).
- **`workouts` Collection**: Stores individual workout logs. Contains `userId`, `exerciseName`, `weight`, `rpe` (Rate of Perceived Exertion), `intensity`, `date`, and completed sets/reps.

## Key Components & Navigation
- **`Dashboard.tsx`**: The main container and state manager. It uses a tab-based navigation system (`activeTab` state: 'data', 'progress', 'editor', 'logs'). It also includes a JSON Export feature for local backups.
- **`Auth.tsx`**: Handles Google Sign-In via Firebase Auth.
- **`PlanEditor.tsx` & `JsonEditorModal.tsx`**: Interfaces for users to edit their workout plans visually or via raw JSON.
- **`LogManager.tsx`**: A table-based view for viewing, filtering, and deleting past workout logs.
- **`ProgressChart.tsx`**: Visualizes progression (Weight/RPE) grouped by specific Exercise.
- **`IntensityChart.tsx`**: Visualizes progression (Weight/RPE) grouped by Intensity level (Heavy, Medium, Light) across all exercises.

## Styling & Layout Guidelines
- **Tailwind CSS**: Exclusively use Tailwind utility classes for styling. Maintain the existing dark mode aesthetic (`bg-zinc-900`, `text-zinc-400`, `orange-500` accents).
- **Recharts Tooltips**: When modifying charts, ensure tooltips have a high z-index (e.g., `wrapperStyle={{ zIndex: 1000 }}`) so they correctly overlay legends and other SVG elements.
- **Responsive Design**: Ensure all views remain usable on mobile devices, utilizing Tailwind's responsive prefixes (e.g., `sm:`, `md:`, `lg:`).

## Development Workflow
- When adding new features, follow the established pattern of component separation. Avoid bloating `Dashboard.tsx` further; instead, abstract new logic into separate components in `/src/components/`.
- Ensure real-time Firestore listeners (`onSnapshot`) are properly cleaned up in `useEffect` return functions to prevent memory leaks.
