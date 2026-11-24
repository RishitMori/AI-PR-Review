import { createHash } from 'node:crypto';
import { config } from '../config.js';

// The Cloud Run service identity supplies credentials; no service-account key is stored.
export async function dispatchReviewTask(jobId: string) {
  if (!config.CLOUD_TASKS_PROJECT) {
    if (config.NODE_ENV === 'production') throw new Error('CLOUD_TASKS_PROJECT is required in production.');
    return;
  }
  if (!config.CLOUD_TASKS_TARGET_URL || !config.PROCESS_REVIEWS_SECRET) {
    throw new Error('Cloud Tasks target URL and processor secret are required.');
  }
  const tokenResponse = await fetch(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(5000) }
  );
  if (!tokenResponse.ok) throw new Error(`Task credentials failed (${tokenResponse.status}).`);
  const { access_token } = await tokenResponse.json() as { access_token: string };
  const parent = `projects/${config.CLOUD_TASKS_PROJECT}/locations/${config.CLOUD_TASKS_LOCATION}/queues/${config.CLOUD_TASKS_QUEUE}`;
  const name = createHash('sha256').update(jobId).digest('hex');
  const response = await fetch(`https://cloudtasks.googleapis.com/v2/${parent}/tasks`, {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: {
      name: `${parent}/tasks/${name}`,
      dispatchDeadline: '600s',
      httpRequest: {
        url: config.CLOUD_TASKS_TARGET_URL,
        httpMethod: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': config.PROCESS_REVIEWS_SECRET },
        body: Buffer.from(JSON.stringify({ jobId })).toString('base64')
      }
    } })
  });
  // A webhook redelivery must not enqueue a second task for the same commit.
  if (!response.ok && response.status !== 409) throw new Error(`Cloud Tasks enqueue failed (${response.status}).`);
}
