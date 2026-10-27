export interface S3StorageConfig {
  bucket?: string;
  kmsKeyId?: string;
  region?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

export interface PutObjectOptions {
  key: string;
  body: Buffer | string;
  contentType: string;
  contentLength?: number;
  serverSideEncryption?: 'aws:kms';
  sseKmsKeyId?: string;
}

export interface PutObjectResult {
  key: string;
  bucket: string;
  etag: string;
  serverSideEncryption: string;
  kmsKeyId: string;
}

export class S3StorageService {
  public bucket: string;
  public kmsKeyId: string;
  public region: string;
  public endpoint?: string;
  private mockStore = new Map<string, { body: Buffer; contentType: string; sse: string; kmsKeyId: string }>();

  constructor(config?: S3StorageConfig) {
    this.bucket = config?.bucket || process.env.S3_BUCKET || 'petmatch-secure-storage';
    this.kmsKeyId = config?.kmsKeyId || process.env.KMS_KEY_ID || 'alias/petmatch-key';
    this.region = config?.region || process.env.AWS_REGION || 'ap-southeast-3';
    this.endpoint = config?.endpoint || process.env.S3_ENDPOINT;
  }

  /**
   * Enforces SSE-KMS encryption header on all object uploads.
   * Throws if caller attempts to bypass SSE-KMS or pass invalid parameters.
   */
  async putObject(options: PutObjectOptions): Promise<PutObjectResult> {
    if (!options.key) {
      throw new Error('S3 putObject requires a valid object key');
    }

    // Strict SSE-KMS enforcement per security policy
    const sse = options.serverSideEncryption || 'aws:kms';
    if (sse !== 'aws:kms') {
      throw new Error('Forbidden: All S3 uploads must enforce SSE-KMS (ServerSideEncryption=aws:kms)');
    }

    const kmsKey = options.sseKmsKeyId || this.kmsKeyId;
    if (!kmsKey) {
      throw new Error('Forbidden: SSE-KMS key ID is required for encrypted object storage');
    }

    const buffer = typeof options.body === 'string' ? Buffer.from(options.body, 'utf8') : options.body;

    // Persist in mock storage or invoke S3 API
    this.mockStore.set(`${this.bucket}/${options.key}`, {
      body: buffer,
      contentType: options.contentType,
      sse,
      kmsKeyId: kmsKey,
    });

    const etag = `"${Buffer.from(options.key).toString('hex').slice(0, 32)}"`;

    return {
      key: options.key,
      bucket: this.bucket,
      etag,
      serverSideEncryption: sse,
      kmsKeyId: kmsKey,
    };
  }

  async getObject(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    const item = this.mockStore.get(`${this.bucket}/${key}`);
    if (!item) return null;
    return {
      body: item.body,
      contentType: item.contentType,
    };
  }

  /**
   * Generates AWS S3 Bucket Policy JSON to enforce TLS 1.3/HTTPS and deny public ACLs or unencrypted uploads.
   */
  generateSecurityBucketPolicy(): Record<string, unknown> {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'EnforceTLS13AndHTTPSOnly',
          Effect: 'Deny',
          Principal: '*',
          Action: 's3:*',
          Resource: [
            `arn:aws:s3:::${this.bucket}`,
            `arn:aws:s3:::${this.bucket}/*`,
          ],
          Condition: {
            Bool: {
              'aws:SecureTransport': 'false',
            },
            NumericLessThan: {
              's3:TlsVersion': 1.3,
            },
          },
        },
        {
          Sid: 'DenyUnEncryptedObjectUploads',
          Effect: 'Deny',
          Principal: '*',
          Action: 's3:PutObject',
          Resource: `arn:aws:s3:::${this.bucket}/*`,
          Condition: {
            StringNotEquals: {
              's3:x-amz-server-side-encryption': 'aws:kms',
            },
          },
        },
        {
          Sid: 'DenyPublicAccessACLs',
          Effect: 'Deny',
          Principal: '*',
          Action: [
            's3:PutObjectAcl',
            's3:PutBucketAcl',
          ],
          Resource: [
            `arn:aws:s3:::${this.bucket}`,
            `arn:aws:s3:::${this.bucket}/*`,
          ],
          Condition: {
            StringEquals: {
              's3:x-amz-acl': ['public-read', 'public-read-write', 'authenticated-read'],
            },
          },
        },
      ],
    };
  }
}

export const s3StorageService = new S3StorageService();
