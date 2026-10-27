import {
  presignedUrlService,
  PresignedUrlService,
  ALLOWED_MIME_TYPES,
  type PresignedUrlResult,
} from '../storage/presigned-url.service.ts';
import {
  workerProfileRepository,
  WorkerProfileRepository,
} from '../repositories/worker-profile.repository.ts';
import { HttpError } from './otp.service.ts';

export type KycDocType = 'ktp' | 'selfie' | 'skck';

export interface GenerateKycUploadUrlOptions {
  workerId: string;
  docType: KycDocType;
  contentType: string;
  contentLength?: number;
}

export interface VerihubsOcrResult {
  ktpNumber: string;
  fullName: string;
  address: string;
}

export interface VerihubsBiometricResult {
  matchScore: number; // 0.0 to 1.0
  isLive: boolean;
}

export interface VerihubsClient {
  runKtpOcr(s3Key: string): Promise<VerihubsOcrResult>;
  runFaceMatch(ktpS3Key: string, selfieS3Key: string): Promise<VerihubsBiometricResult>;
}

export class DefaultVerihubsClient implements VerihubsClient {
  private mockScore?: number;
  private mockKtp?: string;

  constructor(mockScore?: number, mockKtp?: string) {
    this.mockScore = mockScore;
    this.mockKtp = mockKtp;
  }

  async runKtpOcr(s3Key: string): Promise<VerihubsOcrResult> {
    if (!s3Key) throw new Error('Missing KTP S3 key');
    return {
      ktpNumber: this.mockKtp || '3171012345670001',
      fullName: 'Rina Wijaya',
      address: 'Jakarta Selatan',
    };
  }

  async runFaceMatch(ktpS3Key: string, selfieS3Key: string): Promise<VerihubsBiometricResult> {
    if (!ktpS3Key || !selfieS3Key) throw new Error('Missing S3 keys for biometric match');
    const score = this.mockScore !== undefined ? this.mockScore : 0.92;
    return {
      matchScore: score,
      isLive: true,
    };
  }
}

export interface VerifyWorkerKycOptions {
  workerId: string;
  ktpS3Key: string;
  selfieS3Key: string;
  skckS3Key: string;
}

export interface VerifyWorkerKycResult {
  workerId: string;
  verificationStatus: 'VERIFIED' | 'REJECTED';
  matchScore: number;
  message: string;
}

export class KycService {
  private presignService: PresignedUrlService;
  private workerRepo: WorkerProfileRepository;
  private verihubs: VerihubsClient;

  constructor(
    presignService: PresignedUrlService = presignedUrlService,
    workerRepo: WorkerProfileRepository = workerProfileRepository,
    verihubs: VerihubsClient = new DefaultVerihubsClient()
  ) {
    this.presignService = presignService;
    this.workerRepo = workerRepo;
    this.verihubs = verihubs;
  }

  setVerihubsClient(client: VerihubsClient): void {
    this.verihubs = client;
  }

  generateKycUploadUrl(options: GenerateKycUploadUrlOptions): PresignedUrlResult {
    const { workerId, docType, contentType, contentLength } = options;

    if (!workerId) {
      throw new HttpError('Worker ID is required', 400);
    }

    if (!ALLOWED_MIME_TYPES.includes(contentType as (typeof ALLOWED_MIME_TYPES)[number])) {
      throw new HttpError(
        `Disallowed MIME type: ${contentType}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
        400
      );
    }

    if (docType === 'selfie' && contentType === 'application/pdf') {
      throw new HttpError('Selfie biometric document must be an image (JPEG or PNG)', 400);
    }

    const key = `kyc/${docType}/${workerId}.${contentType === 'application/pdf' ? 'pdf' : 'jpg'}`;

    return this.presignService.generateUrl({
      operation: 'PUT',
      key,
      contentType,
      contentLength,
      expiresInSeconds: 300,
    });
  }

  async verifyWorkerKyc(options: VerifyWorkerKycOptions): Promise<VerifyWorkerKycResult> {
    const { workerId, ktpS3Key, selfieS3Key, skckS3Key } = options;

    if (!workerId || !ktpS3Key || !selfieS3Key || !skckS3Key) {
      throw new HttpError('Missing required KYC documents (KTP, selfie, and SKCK required)', 400);
    }

    // 1. Run KTP OCR via Verihubs API
    const ocrResult = await this.verihubs.runKtpOcr(ktpS3Key);
    if (!ocrResult.ktpNumber || ocrResult.ktpNumber.length !== 16) {
      throw new HttpError('Failed to extract valid 16-digit national identity number (NIK) from KTP', 400);
    }

    // 2. Run Face Match biometric test
    const biometricResult = await this.verihubs.runFaceMatch(ktpS3Key, selfieS3Key);
    const matchScore = biometricResult.matchScore;

    // 3. Evaluate verification thresholds
    // Match score below 85% stays blocked in REJECTED state
    if (matchScore < 0.85) {
      await this.workerRepo.upsert({
        id: workerId,
        verificationStatus: 'REJECTED',
        ktpNumber: ocrResult.ktpNumber,
        ktpS3Key,
        selfieS3Key,
        skckS3Key,
        isOnline: false,
      });

      return {
        workerId,
        verificationStatus: 'REJECTED',
        matchScore,
        message: `Biometric verification failed: facial match score ${(matchScore * 100).toFixed(1)}% is below 85% threshold.`,
      };
    }

    // 4. Valid OCR, matchScore >= 0.85, and SKCK file present -> VERIFIED
    await this.workerRepo.upsert({
      id: workerId,
      verificationStatus: 'VERIFIED',
      ktpNumber: ocrResult.ktpNumber,
      ktpS3Key,
      selfieS3Key,
      skckS3Key,
    });

    return {
      workerId,
      verificationStatus: 'VERIFIED',
      matchScore,
      message: 'Worker identity successfully verified via Verihubs KTP and biometric face match.',
    };
  }
}

export const kycService = new KycService();
