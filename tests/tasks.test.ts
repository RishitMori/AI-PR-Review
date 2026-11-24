import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.DATABASE_URL = 'postgresql://unused:unused@localhost/unused';
process.env.USE_REDIS = 'false';
process.env.COOKIE_SECURE = 'false';
process.env.CLOUD_TASKS_PROJECT = 'test-project';
process.env.CLOUD_TASKS_TARGET_URL = 'https://example.run.app/internal/process-reviews';
process.env.PROCESS_REVIEWS_SECRET = 'test-only';
const { config } = await import('../src/config.js');
const { dispatchReviewTask } = await import('../src/services/tasks.service.js');

test('false environment strings disable Redis and secure local cookies', () => {
  assert.equal(config.USE_REDIS, false);
  assert.equal(config.COOKIE_SECURE, false);
});

test('task dispatch encodes the job, authenticates, deduplicates and reports failures', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; options?: RequestInit }> = [];
  let status = 200;
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).includes('metadata.google.internal')) return Response.json({ access_token: 'fake' });
    return new Response('{}', { status });
  };
  try {
    await dispatchReviewTask('owner/repo#1#abc');
    const task = JSON.parse(String(requests[1].options?.body)).task;
    assert.equal(task.httpRequest.url, config.CLOUD_TASKS_TARGET_URL);
    assert.deepEqual(JSON.parse(Buffer.from(task.httpRequest.body, 'base64').toString()), { jobId: 'owner/repo#1#abc' });
    assert.equal(task.httpRequest.headers['x-internal-secret'], 'test-only');
    status = 409;
    await dispatchReviewTask('owner/repo#1#abc');
    assert.equal(JSON.parse(String(requests[3].options?.body)).task.name, task.name);
    status = 403;
    await assert.rejects(dispatchReviewTask('another'), /enqueue failed \(403\)/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
