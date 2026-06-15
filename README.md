# ExamForgeAI

ExamForgeAI is a static, frontend-only study app for generating and taking personal exams from study material.
The current MVP app is called StudyForge inside the UI.

The app can be published on GitHub Pages because it runs entirely in the browser:

- no backend server
- no database
- no login
- no stored API keys
- no saved exam history

Refreshing the browser intentionally resets the current exam.

## Features

- Angular single-page app.
- Deployable to GitHub Pages.
- Manual AI Mode: copy a prompt, use any external AI tool, then paste JSON back into the app.
- Gemini API Mode: each user enters their own Gemini API key and the browser calls Gemini directly.
- Browser file extraction for `.txt`, `.md`, `.pdf`, and `.pptx`.
- Configure language, number of questions, question type, difficulty, knowledge scope, and time limit.
- Knowledge scope options:
  - Strict file: questions stay inside the attached or pasted study material.
  - Expanded theme: questions can include closely related general knowledge.
- Time limit can be active or inactive. Elapsed time is always measured.
- Multiple-choice grading runs locally in the browser.
- Open-ended answers can be graded through Manual AI Mode or Gemini API Mode.
- Final result includes score from `0` to `10`, time spent, counts, feedback, and full review.

## Important API Key Note

Gemini API Mode uses the API key that the current user types into the browser.
The key is not committed to this repository and is not stored by the app.

Because this is a frontend-only app, the key is visible to that user's own browser/devtools while they use it.
That is acceptable for this MVP because each user supplies their own key.

For a production app where one shared API key must be protected, use a backend proxy instead of GitHub Pages only.

## Tech Stack

- Angular
- TypeScript
- `pdfjs-dist` for browser PDF text extraction
- `jszip` and `fast-xml-parser` for browser PowerPoint text extraction
- GitHub Pages for free static hosting

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

Run the app locally:

```bash
npm run dev
```

When the dev server is ready, the console prints:

```text
StudyForge is ready.

Frontend: http://localhost:4200
```

Open:

```text
http://localhost:4200
```

## Run With VS Code

Open this folder in VS Code and press `F5`.

The included `.vscode/launch.json` runs:

```bash
npm run dev
```

## How To Use

1. Choose the exam settings on the setup screen.
2. Pick the knowledge scope:
   - Use `Strict file` for exams that must stay inside course notes, slides, or a study guide.
   - Use `Expanded theme` when you want the AI to include closely related general knowledge.
3. Choose Manual AI Mode or Gemini API Mode.
4. Generate or import the exam JSON.
5. Review the ready screen and click `Start Exam`.
6. Answer the questions and finish the exam.
7. Review the final score and explanations.

## Manual AI Mode

Use this mode when you want to use an external AI tool manually.

1. Configure the exam.
2. Select `Manual AI Mode`.
3. Copy the generated prompt.
4. In your external AI tool, paste the prompt and attach or paste your study material.
5. Copy the AI response.
6. Paste the returned JSON into StudyForge and import it.

For open-ended questions, StudyForge generates a second grading prompt after you finish the exam.
Copy that prompt to the external AI, then paste the returned grading JSON back into the app.

## Gemini API Mode

Use this mode when you want the browser to extract the file and call Gemini directly.

1. Configure the exam.
2. Select `Gemini API Mode`.
3. Upload a supported study file: `.txt`, `.md`, `.pdf`, or `.pptx`.
4. Enter your Gemini API key.
5. Generate the exam.

## Useful Commands

```bash
npm run dev
npm run build
npm run build:gh-pages
npm test
npm run test:browser
npm audit --omit=dev
```

`npm test` runs a TypeScript/spec typecheck. `npm run test:browser` runs Karma and requires Chrome or `CHROME_BIN`.

## GitHub Pages Deployment

This repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`.

To publish:

1. Push to `main`.
2. In GitHub, open the repository settings.
3. Go to `Pages`.
4. Set the source to `GitHub Actions`.
5. Run the `Deploy GitHub Pages` workflow, or push another commit to `main`.

The deployed app URL will be:

```text
https://gabrielrdourado.github.io/ExamForgeAI/
```

The GitHub Pages build uses:

```bash
npm run build:gh-pages
```

That builds Angular with the correct base path for `/ExamForgeAI/`.

## Project Structure

```text
.
├── apps
│   └── web      # Angular frontend-only app
├── scripts      # local development helpers
├── .github      # GitHub Pages deployment workflow
├── .vscode      # F5 launch config
└── package.json # workspace scripts
```

## Troubleshooting

- If `npm run dev` does not print the ready link, check that port `4200` is free.
- If Gemini generation fails, confirm the user's API key is valid and has access to the Gemini API.
- If a manual AI response fails to import, make sure it returned JSON only, without markdown fences or explanatory text.
- If PDF extraction fails for a scanned document, the PDF may contain images instead of selectable text.
- If PPTX extraction misses content, that content may be embedded as images or unsupported objects.
