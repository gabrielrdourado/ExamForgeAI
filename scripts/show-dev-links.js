const frontendUrl = 'http://localhost:4200';
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
  await waitFor(frontendUrl);

  console.log(`
StudyForge is ready.

Frontend: ${frontendUrl}
`);
}

main().catch((error) => {
  console.log(`
StudyForge is still starting.

Frontend: ${frontendUrl}

${error.message}
`);
});
