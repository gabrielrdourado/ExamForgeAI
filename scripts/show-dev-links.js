const frontendUrl = 'http://localhost:4200';
const backendUrl = 'http://localhost:3000';
const healthUrl = `${backendUrl}/health`;
const timeoutMs = 90000;
const intervalMs = 1000;

async function waitFor(url) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {
      // Keep waiting while the dev servers compile.
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`${url} did not respond before the timeout.`);
}

async function main() {
  await Promise.all([waitFor(frontendUrl), waitFor(healthUrl)]);

  console.log(`
StudyForge is ready.

Frontend:      ${frontendUrl}
Backend API:   ${backendUrl}
Backend health: ${healthUrl}
`);
}

main().catch((error) => {
  console.log(`
StudyForge is still starting.

Frontend:      ${frontendUrl}
Backend API:   ${backendUrl}
Backend health: ${healthUrl}

${error.message}
`);
});
