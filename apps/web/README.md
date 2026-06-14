# StudyForge Web

Angular frontend for ExamForgeAI / StudyForge.

The web app lets a user configure an exam, choose Manual AI Mode or Gemini API Mode, take the generated exam, and review the final score.

## Run

From the repository root:

```bash
npm run dev:web
```

From this folder:

```bash
npm run start -- --host 0.0.0.0
```

Default URL:

```text
http://localhost:4200
```

## Development Flow

Most development should run the whole project from the repository root:

```bash
npm run dev
```

That starts:

- NestJS API on `http://localhost:3000`
- Angular app on `http://localhost:4200`
- A link printer that shows both URLs when ready

## Main Screens

- Setup: language, question count, question type, difficulty, knowledge scope, and time limit.
- Generation mode: Manual AI Mode or Gemini API Mode.
- Ready: exam summary before questions are visible.
- Exam: timer, answer progress, questions, and finish action.
- Manual grading: prompt import flow for open-ended answers when using Manual AI Mode.
- Result: score, time spent, counts, feedback, and explanations.

## API URL

The frontend currently calls the local API at:

```text
http://localhost:3000
```

This is configured in `src/app/api.service.ts`.
