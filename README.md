# ExamForgeAI

ExamForgeAI is a local-first study app for generating and taking personal exams from study material.
The current MVP app is called StudyForge inside the UI.

It supports two exam generation workflows:

- Manual AI Mode: copy a prompt, use any external AI tool with your study material, then paste the returned JSON into the app.
- Gemini API Mode: upload a study file in the app and generate the exam through Gemini with a temporary API key.

The app has no database, login, saved history, or cloud storage. Refreshing the browser resets the current exam.

## Features

- Angular frontend and NestJS backend in one npm workspace.
- Run frontend and backend together with one command or VS Code F5.
- Manual mode does not upload files to the app.
- Gemini mode supports `.txt`, `.md`, `.pdf`, and `.pptx` uploads.
- Configure language, number of questions, question type, difficulty, knowledge scope, and time limit.
- Knowledge scope can be strict or expanded:
  - Strict file: questions stay inside the attached or pasted study material.
  - Expanded theme: questions can include closely related general knowledge.
- Time limit can be active or inactive. Elapsed time is always measured.
- Multiple-choice grading runs locally.
- Open-ended answers can be graded through Manual AI Mode or Gemini API Mode.
- Final result includes score from `0` to `10`, time spent, counts, and full review.

## Tech Stack

- Angular frontend: `apps/web`
- NestJS backend: `apps/api`
- TypeScript
- npm workspaces

## Requirements

- Node.js 20 or newer
- npm
- VS Code, optional
- Gemini API key, optional and only needed for Gemini API Mode

## Quick Start

Install dependencies:

```bash
npm install
```

Run both apps:

```bash
npm run dev
```

When both servers are ready, the console prints:

```text
StudyForge is ready.

Frontend:      http://localhost:4200
Backend API:   http://localhost:3000
Backend health: http://localhost:3000/health
```

Open the frontend:

```text
http://localhost:4200
```

## Run With VS Code

Open this folder in VS Code and press `F5`.

The included `.vscode/launch.json` runs:

```bash
npm run dev
```

This starts the backend, frontend, and link printer in the same terminal.

## How To Use

1. Choose the exam settings on the setup screen.
2. Pick the knowledge scope:
   - Use `Strict file` for exams that must stay inside course notes, slides, or a study guide.
   - Use `Expanded theme` when you want the AI to include closely related general knowledge.
3. Choose one generation mode.
4. Generate or import the exam JSON.
5. Review the ready screen and click `Start Exam`.
6. Answer the questions and finish the exam.
7. Review the final score and explanations.

## Manual AI Mode

Use this mode when you do not want to upload files to this app.

1. Configure the exam.
2. Select `Manual AI Mode`.
3. Copy the generated prompt.
4. In your external AI tool, paste the prompt and attach or paste your study material.
5. Copy the AI response.
6. Paste the returned JSON into StudyForge and import it.

For open-ended questions, StudyForge generates a second grading prompt after you finish the exam.
Copy that prompt to the external AI, then paste the returned grading JSON back into the app.

## Gemini API Mode

Use this mode when you want StudyForge to extract a file and call Gemini directly.

1. Configure the exam.
2. Select `Gemini API Mode`.
3. Upload a supported study file.
4. Enter a Gemini API key.
5. Generate the exam.

The Gemini API key is sent to the backend for the current request only. It is not stored in a database or written to project files.

## Environment

The app works without a `.env` file.

Optional variables:

```bash
PORT=3000
GEMINI_MODEL=gemini-3.5-flash
```

You can copy `.env.example` if you want to override defaults.
Do not put API keys in `.env`; the UI asks for the Gemini key only when Gemini API Mode is used.

## Useful Commands

```bash
npm run dev
npm run build
npm test
npm run test:e2e --workspace studyforge-api -- --runInBand
npm audit --omit=dev
```

Run apps separately:

```bash
npm run dev:api
npm run dev:web
```

## Backend Endpoints

Health:

- `GET /health`

Files:

- `POST /files/extract`

Manual mode:

- `POST /manual/build-exam-prompt`
- `POST /manual/validate-exam-json`
- `POST /manual/build-grading-prompt`
- `POST /manual/validate-grading-json`

Gemini mode:

- `POST /gemini/generate-exam`
- `POST /gemini/grade-open-answers`

Grading:

- `POST /grade/multiple-choice`
- `POST /grade/final-score`

## Project Structure

```text
.
├── apps
│   ├── api      # NestJS backend
│   └── web      # Angular frontend
├── scripts      # local development helpers
├── .vscode      # F5 launch config
└── package.json # workspace scripts
```

## Troubleshooting

- If `npm run dev` does not print the ready links, check that ports `3000` and `4200` are free.
- If Gemini generation fails, confirm the API key is valid and the selected `GEMINI_MODEL` exists for that key.
- If a manual AI response fails to import, make sure it returned JSON only, without markdown fences or explanatory text.
- If the app cannot call the backend, confirm the backend health URL returns `200`: `http://localhost:3000/health`.
