// Vercel Serverless Function: Cloudflare R2 Secure Upload Endpoint
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const r2AccountId = process.env.R2_ACCOUNT_ID;
  const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
  const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const r2BucketName = process.env.R2_BUCKET_NAME || 'photobook-media';
  const r2PublicUrl = process.env.R2_PUBLIC_URL || '';

  if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
    return res.status(500).json({
      error: 'Cloudflare R2 environment variables are not configured in Vercel.',
      required: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'],
    });
  }

  try {
    const { base64, fileName, mimeType = 'image/jpeg', userId = 'anon', bookId = 'temp' } = req.body;

    if (!base64) {
      return res.status(400).json({ error: 'Missing base64 image data' });
    }

    let buffer;
    const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(base64, 'base64');
    }

    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const r2Key = `users/${userId}/books/${bookId}/media/${uniqueId}.${ext}`;

    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
      },
    });

    const command = new PutObjectCommand({
      Bucket: r2BucketName,
      Key: r2Key,
      Body: buffer,
      ContentType: mimeType,
    });

    await r2Client.send(command);

    const publicUrl = r2PublicUrl
      ? `${r2PublicUrl.replace(/\/$/, '')}/${r2Key}`
      : `https://${r2AccountId}.r2.cloudflarestorage.com/${r2BucketName}/${r2Key}`;

    return res.status(200).json({
      success: true,
      storage: 'cloudflare_r2',
      r2_key: r2Key,
      public_url: publicUrl,
      file_name: fileName || `image-${uniqueId}.${ext}`,
      file_size: buffer.length,
      mime_type: mimeType,
    });
  } catch (error) {
    console.error('Vercel R2 upload error:', error);
    return res.status(500).json({ error: error.message || 'R2 upload failed' });
  }
}
