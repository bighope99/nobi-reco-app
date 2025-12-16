import assert from 'assert';
import { run as runAnalyzeTests } from './activities.analyze.test.ts';
import { run as runVoiceDraftTests } from './activities.voice-draft.test.ts';
import { run as runUploadTests } from './storage.upload.test.ts';

async function main() {
  await runAnalyzeTests();
  await runVoiceDraftTests();
  await runUploadTests();
  console.log('All tests passed');
}

main().catch(error => {
  console.error('Tests failed', error);
  process.exitCode = 1;
});
