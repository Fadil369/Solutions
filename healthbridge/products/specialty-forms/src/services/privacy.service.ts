import sharp from 'sharp';
import crypto from 'crypto';
import { config } from '../config';
import { query } from '../database/connection';

export class PrivacyService {
  private readonly algorithm = config.encryption.algorithm;
  private readonly key = Buffer.from(config.encryption.key.padEnd(32, '0').slice(0, 32));

  /**
   * Blur specific regions of an image for privacy protection
   */
  async blurImage(
    imageBuffer: Buffer,
    regions: { x: number; y: number; width: number; height: number }[]
  ): Promise<Buffer> {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 600;

    if (regions.length === 0) {
      // Blur entire surrounding area (outer 20% border)
      const margin = 0.1;
      regions = [
        { x: 0, y: 0, width: width, height: Math.floor(height * margin) }, // top
        { x: 0, y: Math.floor(height * (1 - margin)), width: width, height: Math.floor(height * margin) }, // bottom
        { x: 0, y: 0, width: Math.floor(width * margin), height: height }, // left
        { x: Math.floor(width * (1 - margin)), y: 0, width: Math.floor(width * margin), height: height }, // right
      ];
    }

    // Create composite operations for blurring regions
    const composites: sharp.OverlayOptions[] = [];

    for (const region of regions) {
      const blurredRegion = await sharp(imageBuffer)
        .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
        .blur(20)
        .toBuffer();

      composites.push({
        input: blurredRegion,
        left: region.x,
        top: region.y,
      });
    }

    return sharp(imageBuffer).composite(composites).toBuffer();
  }

  /**
   * Encrypt image buffer using AES-256-GCM
   */
  encryptImage(imageBuffer: Buffer): Buffer {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    const encrypted = Buffer.concat([cipher.update(imageBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: iv(16) + authTag(16) + encrypted data
    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * Decrypt image buffer
   */
  decryptImage(encryptedBuffer: Buffer): Buffer {
    const iv = encryptedBuffer.subarray(0, 16);
    const authTag = encryptedBuffer.subarray(16, 32);
    const encrypted = encryptedBuffer.subarray(32);

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  /**
   * Check if patient has given consent for photo type
   */
  async checkConsent(patientId: string, photoType: string): Promise<boolean> {
    const result = await query(
      `SELECT consent_given FROM derma_photos 
       WHERE patient_id = $1 AND photo_type = $2 
       ORDER BY taken_at DESC LIMIT 1`,
      [patientId, photoType]
    );
    if (result.rows.length === 0) return false;
    return result.rows[0].consent_given;
  }
}

export const privacyService = new PrivacyService();
