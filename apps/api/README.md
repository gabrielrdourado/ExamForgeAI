# StudyForge API

NestJS backend for ExamForgeAI / StudyForge.

The API extracts study file text, builds Manual AI prompts, calls Gemini when requested, validates AI JSON, and calculates exam scores.

## Run

From the repository root:

```bash
npm run dev:api
```

From this folder:

```bash
npm run start:dev
```

Default URL:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/health
```

## Environment

The API works without a `.env` file.

Optional variables:

```bash
PORT=3000
GEMINI_MODEL=gemini-3.5-flash
```

Gemini API keys are not configured as environment variables. The frontend sends the key per request when the user chooses Gemini API Mode.

## Endpoints

- `GET /health`
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

- File extraction supports `.txt`, `.md`, `.pdf`, and `.pptx`.
- Manual AI Mode never receives a study file through the app; it only builds prompts and validates returned JSON.
- Gemini API Mode requires extracted text and a Gemini API key.
- Exam config validation defaults `knowledgeScope` to `strict` for compatibility with older requests.

## Tests

From the repository root:

```bash
npm test
npm run test:e2e --workspace studyforge-api -- --runInBand
```
