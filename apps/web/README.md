# StudyForge Web

Angular frontend for ExamForgeAI / StudyForge.

This is the entire runtime app. It does not need a backend server.

## Run

From the repository root:

```bash
npm run dev
```

From this folder:

```bash
npm run start -- --host 0.0.0.0
```

Default URL:

```text
http://localhost:4200
```

## Build

Production build:

```bash
npm run build
```

GitHub Pages build from the repository root:

```bash
npm run build:gh-pages
```

The GitHub Pages output is:

```text
apps/web/dist/studyforge-web/browser
```

## Main Screens

- Setup: language, question count, question type, difficulty, knowledge scope, and time limit.
- Generation mode: Manual AI Mode or Gemini API Mode.
- Ready: exam summary before questions are visible.
- Exam: timer, answer progress, questions, and finish action.
- Manual grading: prompt import flow for open-ended answers when using Manual AI Mode.
- Result: score, time spent, counts, feedback, and explanations.

## Browser Runtime

The app runs these tasks in the browser:

- prompt creation
- JSON parsing and validation
- `.txt`, `.md`, `.pdf`, and `.pptx` text extraction
- direct Gemini API calls with the user's own API key
- multiple-choice grading
- final score calculation
