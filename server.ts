import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import multer from 'multer';
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

dotenv.config({ override: true });

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Support JSON & URL-encoded bodies up to 25MB for image payloads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ==========================================
// Cloudflare R2 Client & State Management
// ==========================================
let r2AccountId = process.env.R2_ACCOUNT_ID || '251b869aa5ae699a09785b1fd23ef8cf';
let r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '797cbfdfc4f89dbfb45ce38d5f2a07ae';
let r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || 'e3e07e920d060f48441ccca5994166aad653c9f24a25225d22a2fbeb71d369de';
let r2BucketName = process.env.R2_BUCKET_NAME || 'photobook';
let r2PublicUrl = process.env.R2_PUBLIC_URL || 'https://pub-3bbf01a29ae04c31a6383280a3e37de0.r2.dev';

let r2Client: S3Client | null = null;
let isR2Configured = false;
let isR2WriteReady = false;
let r2StatusMessage = 'Initializing Cloudflare R2 client...';

async function setupR2(options?: {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  publicUrl?: string;
}) {
  if (options) {
    if (options.accountId) r2AccountId = options.accountId;
    if (options.accessKeyId) r2AccessKeyId = options.accessKeyId;
    if (options.secretAccessKey) r2SecretAccessKey = options.secretAccessKey;
    if (options.bucketName) r2BucketName = options.bucketName;
    if (options.publicUrl) r2PublicUrl = options.publicUrl;
  }

  isR2Configured = Boolean(
    r2AccountId &&
    r2AccessKeyId &&
    r2SecretAccessKey &&
    !r2AccountId.includes('your-cloudflare')
  );

  if (!isR2Configured) {
    r2Client = null;
    isR2WriteReady = false;
    r2StatusMessage = 'Cloudflare R2 credentials not configured.';
    return;
  }

  try {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
      },
    });

    // Test write permission without breaking execution
    const testKey = `.r2-probe-${Date.now()}.tmp`;
    try {
      await r2Client.send(
        new PutObjectCommand({
          Bucket: r2BucketName,
          Key: testKey,
          Body: 'r2-active',
          ContentType: 'text/plain',
        })
      );
      isR2WriteReady = true;
      r2StatusMessage = `Cloudflare R2 is fully active with Read & Write access on bucket "${r2BucketName}".`;
      // Clean probe
      await r2Client.send(new DeleteObjectCommand({ Bucket: r2BucketName, Key: testKey })).catch(() => {});
    } catch (writeErr: any) {
      isR2WriteReady = false;
      r2StatusMessage = `R2 connected to bucket "${r2BucketName}". Write permission notice: ${writeErr.name || writeErr.message}. Local storage will safely store uploaded media until write permission is active.`;
    }
  } catch (initErr: any) {
    r2Client = null;
    isR2WriteReady = false;
    r2StatusMessage = `R2 Initialization note: ${initErr.message}`;
  }
}

// Initial setup
setupR2();

// Multer memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
});

// Local uploads directory fallback (ensures user photos always display reliably)
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// ==========================================
// API ROUTES
// ==========================================

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    database: 'firebase_firestore',
    firebase_project: 'edurunner-saas',
    r2_configured: isR2Configured,
    r2_write_ready: isR2WriteReady,
    bucket: r2BucketName,
    timestamp: new Date().toISOString(),
  });
});

// Detailed R2 Status Endpoint
app.get('/api/r2/status', async (_req: Request, res: Response) => {
  res.json({
    configured: isR2Configured,
    bucket: r2BucketName,
    account_id: r2AccountId,
    public_url: r2PublicUrl,
    write_access: isR2WriteReady,
    message: r2StatusMessage,
  });
});

// Update / Save R2 Credentials dynamically
app.post('/api/r2/config', async (req: Request, res: Response) => {
  try {
    const { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl } = req.body;

    await setupR2({
      accountId: accountId?.trim(),
      accessKeyId: accessKeyId?.trim(),
      secretAccessKey: secretAccessKey?.trim(),
      bucketName: bucketName?.trim(),
      publicUrl: publicUrl?.trim(),
    });

    // Persist to .env
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

    const replaceOrAppend = (key: string, val: string) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${val}`);
      } else {
        envContent += `\n${key}=${val}`;
      }
    };

    if (r2AccountId) replaceOrAppend('R2_ACCOUNT_ID', r2AccountId);
    if (r2AccessKeyId) replaceOrAppend('R2_ACCESS_KEY_ID', r2AccessKeyId);
    if (r2SecretAccessKey) replaceOrAppend('R2_SECRET_ACCESS_KEY', r2SecretAccessKey);
    if (r2BucketName) replaceOrAppend('R2_BUCKET_NAME', r2BucketName);
    if (r2PublicUrl) replaceOrAppend('R2_PUBLIC_URL', r2PublicUrl);

    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');

    res.json({
      success: true,
      write_ready: isR2WriteReady,
      message: r2StatusMessage,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload endpoint (Cloudflare R2 with resilient local storage)
app.post('/api/r2/upload', upload.single('image'), async (req: Request, res: Response): Promise<void> => {
  try {
    let buffer: Buffer;
    let mimeType = 'image/jpeg';
    let fileName = `photo-${Date.now()}`;
    const userId = (req.body.userId as string) || 'guest';
    const bookId = (req.body.bookId as string) || 'temp';

    if (req.file) {
      buffer = req.file.buffer;
      mimeType = req.file.mimetype || 'image/jpeg';
      fileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    } else if (req.body.base64) {
      const base64Str = req.body.base64 as string;
      const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(base64Str, 'base64');
      }
      if (req.body.fileName) {
        fileName = (req.body.fileName as string).replace(/[^a-zA-Z0-9.-]/g, '_');
      }
    } else {
      res.status(400).json({ error: 'No image file or base64 data provided' });
      return;
    }

    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const r2Key = `users/${userId}/books/${bookId}/media/${uniqueId}.${ext}`;

    // If R2 write is active and verified, upload to Cloudflare R2
    if (isR2WriteReady && r2Client) {
      try {
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

        res.json({
          success: true,
          storage: 'cloudflare_r2',
          r2_key: r2Key,
          public_url: publicUrl,
          file_name: fileName,
          file_size: buffer.length,
          mime_type: mimeType,
        });
        return;
      } catch {
        // Fallback to local storage if temporary upload error occurs
      }
    }

    // Reliable Local Storage (Guarantees books & photos always render instantly)
    const localFilePath = path.join(uploadsDir, `${uniqueId}.${ext}`);
    fs.writeFileSync(localFilePath, buffer);
    const localUrl = `/uploads/${uniqueId}.${ext}`;

    res.json({
      success: true,
      storage: 'local_storage',
      r2_key: r2Key,
      public_url: localUrl,
      file_name: fileName,
      file_size: buffer.length,
      mime_type: mimeType,
      notice: !isR2WriteReady
        ? 'Stored safely in local app storage. To upload directly to Cloudflare R2, grant "Object Read & Write" permission to your R2 API Token.'
        : undefined,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Image upload failed' });
  }
});

// Delete endpoint
app.post('/api/r2/delete', async (req: Request, res: Response): Promise<void> => {
  try {
    const { r2Key } = req.body;
    if (!r2Key) {
      res.status(400).json({ error: 'Missing r2Key parameter' });
      return;
    }

    if (isR2WriteReady && r2Client) {
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: r2BucketName,
          Key: r2Key,
        })
      ).catch(() => {});
    }

    // Clean up local if exists
    const localFilename = path.basename(r2Key);
    const localFilePath = path.join(uploadsDir, localFilename);
    if (fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
      } catch {}
    }

    res.json({ success: true, deleted: r2Key });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Delete operation failed' });
  }
});

// Analytics receiver endpoint
app.post('/api/analytics', (_req: Request, res: Response) => {
  res.json({ success: true });
});

// ==========================================
// VITE MIDDLEWARE (DEV) & STATIC SERVING (PROD)
// ==========================================
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Digital Memory Book SaaS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
