import crypto from 'node:crypto';

export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined, secret: string) {
  if (!signature) return false;

  const digest = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const signatureBuffer = Buffer.from(signature);
  const digestBuffer = Buffer.from(digest);

  if (signatureBuffer.length !== digestBuffer.length) return false;
  return crypto.timingSafeEqual(signatureBuffer, digestBuffer);
}
