// Vercel Serverless Function: Cloudflare R2 Secure Delete Endpoint
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const r2AccountId = process.env.R2_ACCOUNT_ID;
  const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
  const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const r2BucketName = process.env.R2_BUCKET_NAME || 'photobook-media';

  if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
    return res.status(500).json({ error: 'Cloudflare R2 environment variables missing' });
  }

  try {
    const { r2Key } = req.body;
    if (!r2Key) {
      return res.status(400).json({ error: 'Missing r2Key parameter' });
    }

    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
      },
    });

    const command = new DeleteObjectCommand({
      Bucket: r2BucketName,
      Key: r2Key,
    });

    await r2Client.send(command);
    return res.status(200).json({ success: true, deleted: r2Key });
  } catch (error) {
    console.error('Vercel R2 delete error:', error);
    return res.status(500).json({ error: error.message || 'R2 delete failed' });
  }
}
