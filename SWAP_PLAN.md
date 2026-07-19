# Implementation Plan: Smart Exercise Swaps

This document outlines the architectural and UI/UX plan for implementing "Smart Exercise Swaps" triggered by either training stagnation or equipment availability (Busy Gym).

## 1. Feature Overview
The "Smart Swap" system provides users with viable alternative exercises when they hit a plateau (stagnation) or when their intended equipment is occupied.

### Primary Triggers:
*   **Stagnation Trigger (Automatic):** When the "Stagnation Indicator" (currently implemented in the Training Archive) detects no progress over *X* sessions, a "Swap Suggestion" prompt appears during the next scheduled session for that exercise.
*   **Busy Gym Trigger (Manual):** A "Swap" button available on each exercise card in the active workout view for immediate alternatives.

---

## 2. Technical Mechanism

### A. Exercise Taxonomy & Mapping
To ensure "Smart" swaps, exercises must be mapped to **Movement Patterns** and **Equipment Categories**.

| Exercise | Movement Pattern | Primary Equipment |
| :--- | :--- | :--- |
| Low Bar Squat | Knee Dominant | Power Rack / Barbell |
| Hack Squat | Knee Dominant | Machine |
| Leg Press | Knee Dominant | Machine |
| Bench Press | Horizontal Push | Barbell / Rack |
| Dumbbell Bench | Horizontal Push | Dumbbells |
| Chest Press | Horizontal Push | Machine |

### B. Suggestion Logic (Hybrid Approach)
1.  **Stagnation Swap:** Prioritizes a change in *Equipment* or *Angle* within the same Movement Pattern to provide a new stimulus (e.g., Squat -> Hack Squat).
2.  **Busy Gym Swap:** Prioritizes a change in *Equipment Type* (e.g., Barbell -> Dumbbell or Machine) to bypass occupied gear.

### C. Gemini AI Integration (Interactions API)
We will use the Gemini Interactions API to generate context-aware rationale for swaps:
*   **Prompting:** "User is stagnant on {Exercise} at {Weight}. Suggest an alternative that targets the same muscles but provides a different stimulus. Explain why."
*   **Output:** Return the suggested exercise and a 1-sentence "Rationale" to show the user.

---

## 3. UI/UX Flow

### Active Workout View Updates
1.  **The "Swap" Action:** Add a small `RefreshCw` (Lucide) icon next to exercise titles in the workout logger.
2.  **Suggestion Modal:**
    *   **Header:** "Swap Suggestion"
    *   **Content:** "Instead of **{Original}**, try **{Alternative}**."
    *   **Rationale:** "Since you've hit a plateau, this machine variation provides consistent tension to break through." (Gemini generated).
    *   **Actions:** `[ Accept Swap ]` `[ Keep Original ]`

### Training Archive & History
*   **Indicator:** Swapped entries will show a small "S" icon or "Swap" badge in the history table.
*   **Audit Trail:** Hovering over the weight shows: *"Original: Low Bar Squat | Reason: Equipment Occupied"*

---

### 4. Data & Analytics Impact

#### Visual Continuity in Charts
Instead of aggregating different exercises together, the Progress Review charts will maintain exercise-specific integrity:
*   **Gap Handling**: If a user swaps "Low Bar Squat" for "Hack Squat" for 3 weeks, the "Low Bar Squat" chart will show a visual break (dotted line or gap) during those 3 weeks.
*   **Swap Annotation**: A small tooltip or icon will appear on the chart timeline indicating: *"Exercise swapped for Hack Squat (Stagnation)"*.
*   **Independent Tracking**: The "Hack Squat" data will be tracked as its own independent data set, preserving the "Data Purge" behavior if the swap exercise is eventually removed.

---

### 5. Implementation Roadmap

### Phase 1: Metadata & Mapping
*   Create a `src/lib/exerciseMetadata.ts` containing movement pattern mappings for all exercises.
*   Update `Workout` type definition.

### Phase 2: Manual "Busy Gym" Trigger
*   Add the Swap UI to the active workout logger.
*   Implement the basic mapping-based suggestion (Barbell -> Machine).

### Phase 3: AI Rationale (Gemini)
*   Integrate the `gemini-api` skill to generate the 1-sentence rationale for the swap to increase user confidence.

### Phase 4: Chart Annotations
*   Update the `recharts` logic in `ProgressReview.tsx` to handle gaps and show "Swap" markers on the X-axis.

---

## 6. Weight Recommendation Logic (Accuracy & Safety)

A critical challenge with "Smart Swaps" is that absolute weight does not translate 1:1 between different exercises (e.g., a 225lb Barbell Squat does not equal a 225lb Leg Press). To prevent injury and ensure the right training stimulus, we use a multi-layered approach:

### A. RPE-Based Calibration (Primary Driver)
Instead of forcing a specific weight, the swap suggestion prioritizes **Intensity Equivalence**:
*   The system calculates the target RPE of the original exercise.
*   The user is instructed to find a weight on the new exercise that hits that **Target RPE** within the specified rep range.

### B. Gemini-Generated "Safe Starting Range"
We utilize Gemini's broad knowledge of biomechanics to provide a realistic starting point:
*   **Prompting:** "User usually Benches 185lbs for 5 reps. They are swapping to Dumbbell Press. What is a safe starting weight range for the same intensity?"
*   **Output:** Gemini provides a percentage-based range (e.g., "60-70% of Barbell weight per pair, so 55-65lb Dumbbells").

### C. The "Feeler Set" Protocol
The UI will explicitly guide the user through a safety check:
1.  **Calculate Estimate:** Show the AI-estimated range.
2.  **Required Feeler Set:** A prompt appears: *"Perform 1 set of 5 reps at the low end of this range. If it feels like RPE < 5, increase by 10% for your first work set."*
3.  **Real-time Adjustment:** The user logs the first set, and the system adjusts the recommendation for sets 2 and 3 based on the logged RPE.

### D. Historical Ratio Matching (Advanced)
If the user has performance history for both exercises (e.g., they have done both Squats and Leg Press in the past 6 months), the system calculates their **Personal Strength Ratio**:
*   *Ratio = (Last Leg Press Weight) / (Last Squat Weight)*
*   *New Weight = (Current Squat Weight) * Ratio*
*   This provides the most accurate, personalized starting point.

---

## 7. Handling Plan Changes (Add/Remove Exercises)

To maintain a robust system, the swap logic must adapt when the user modifies their underlying training plan.

### A. Adding New Exercises
When a user adds a custom exercise not in our core library:
1.  **AI Categorization (Gemini):** Upon save, the system sends the exercise name to Gemini: *"Categorize 'Seal Row' into one of: Knee Dominant, Hip Dominant, Horizontal Push, Vertical Push, Horizontal Pull, Vertical Pull, or Accessories."*
2.  **Metadata Injection:** The exercise is saved to the user's profile with its assigned `movementPattern`.
3.  **Immediate Eligibility:** Once categorized, the "Busy Gym" swap button becomes active, using the new mapping to find alternatives.

### B. Removing Exercises
If an exercise is removed from the active rotation:
1.  **Data Purge:** In line with the current application logic, removing an exercise from the plan results in the removal of all historical logs for that specific exercise. 
2.  **Implicit Stagnation Reset:** Because the history is purged, the stagnation status is automatically reset if the exercise is ever re-added to the plan.
