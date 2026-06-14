# StudyForge

StudyForge is a stateless MVP web app for turning uploaded study files into a timed personal exam.

## Stack

- Angular frontend in `apps/web`
- NestJS backend in `apps/api`
- TypeScript
- No database, authentication, history, or saved exams

## Features

- Upload `.txt`, `.md`, `.pdf`, or `.pptx` study files
- Extract readable text on the backend
- Configure language, question count, question type, difficulty, and time limit
- Manual AI mode for copying prompts and importing JSON
- Gemini API mode using an API key kept only in memory
- Ready screen before questions are visible
- Timer starts only after `Start Exam`
- Local multiple-choice grading
- Manual or Gemini batch grading for open-ended answers
- Final score from `0` to `10`, elapsed time, counts, and full review

## Run Locally

Install dependencies:

```bash
npm install
```

Start both apps:

```bash
npm run dev
```

Open:

- Frontend: `http://localhost:4200`
- Backend: `http://localhost:3000/health`

## Useful Commands

```bash
npm run build
npm test
npm audit --omit=dev
```

## Backend Endpoints

- `POST /files/extract`
- `POST /manual/build-exam-prompt`
- `POST /manual/validate-exam-json`
- `POST /manual/build-grading-prompt`
- `POST /manual/validate-grading-json`
- `POST /gemini/generate-exam`
- `POST /gemini/grade-open-answers`
- `POST /grade/multiple-choice`
- `POST /grade/final-score`

## Notes

- Gemini API keys are sent per request and are not stored or logged.
- The default Gemini model is set in `apps/api/src/gemini.service.ts` and can be overridden with `GEMINI_MODEL`.
- Refreshing the page intentionally resets the current exam state.
