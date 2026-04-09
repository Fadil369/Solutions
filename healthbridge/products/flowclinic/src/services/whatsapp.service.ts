import twilio from 'twilio';
import { config, LANGUAGE_NAMES } from '../config';
import { i18nService } from './i18n.service';
import { query } from '../database/connection';
import type { Patient, QueueEntry, SupportedLanguage } from '../types';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

export class WhatsAppService {
  private client: ReturnType<typeof twilio> | null;
  private fromNumber: string;

  constructor() {
    if (config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN) {
      this.client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
      this.fromNumber = config.TWILIO_WHATSAPP_FROM;
      logger.info('WhatsApp service initialized with Twilio');
    } else {
      this.client = null;
      this.fromNumber = '';
      logger.warn('WhatsApp service running in stub mode (no Twilio credentials)');
    }
  }

  /**
   * Send queue confirmation after registration.
   * "You are #12, estimated wait 25 min"
   */
  async sendQueueConfirmation(patient: Patient, queueEntry: QueueEntry): Promise<void> {
    const lang = (patient.preferred_language || 'ar') as SupportedLanguage;
    const message = i18nService.getMessage('queue_confirmation', lang, {
      queueNumber: queueEntry.queue_number,
      estimatedWait: queueEntry.estimated_wait_min,
      department: queueEntry.department,
    });

    await this.sendMessage(patient.phone, message, patient.id, 'queue_confirmation');
  }

  /**
   * Send queue position update.
   * "You're almost up! Position: #3, currently serving #1"
   */
  async sendQueueUpdate(patient: Patient, position: number, currentServing?: number): Promise<void> {
    const lang = (patient.preferred_language || 'ar') as SupportedLanguage;
    const message = i18nService.getMessage('queue_update', lang, {
      position,
      currentServing: currentServing || '—',
    });

    await this.sendMessage(patient.phone, message, patient.id, 'queue_update');
  }

  /**
   * Send "your turn" notification.
   * "Your turn! Please proceed to Room 3"
   */
  async sendReadyNotification(patient: Patient, department: string, room?: string): Promise<void> {
    const lang = (patient.preferred_language || 'ar') as SupportedLanguage;
    const message = i18nService.getMessage('ready_notification', lang, {
      department,
      room: room || '',
    });

    await this.sendMessage(patient.phone, message, patient.id, 'ready_notification');
  }

  /**
   * Send lab results notification.
   */
  async sendLabResults(patient: Patient, resultsLink: string): Promise<void> {
    const lang = (patient.preferred_language || 'ar') as SupportedLanguage;
    const message = i18nService.getMessage('lab_results', lang, {
      link: resultsLink,
    });

    await this.sendMessage(patient.phone, message, patient.id, 'lab_results');
  }

  /**
   * Core send method with WhatsApp → SMS fallback.
   */
  private async sendMessage(
    phone: string,
    message: string,
    patientId: string,
    type: string
  ): Promise<void> {
    // Log attempt
    const logEntry = async (status: string) => {
      await query(
        `INSERT INTO sms_logs (id, patient_id, phone, message, type, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [patientId, phone, message, type, status]
      );
    };

    if (!this.client) {
      logger.info('WhatsApp stub: would send message', { phone, type, message: message.substring(0, 80) });
      await logEntry('stub');
      return;
    }

    try {
      // Try WhatsApp first
      const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
      await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: `whatsapp:${formattedPhone}`,
      });
      await logEntry('sent_whatsapp');
      logger.info('WhatsApp message sent', { phone: formattedPhone, type });
    } catch (whatsappError) {
      logger.warn('WhatsApp send failed, falling back to SMS', {
        phone,
        error: (whatsappError as Error).message,
      });

      try {
        // Fallback to SMS (regular Twilio SMS)
        const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
        await this.client.messages.create({
          body: message,
          from: this.fromNumber.replace('whatsapp:', ''),
          to: formattedPhone,
        });
        await logEntry('sent_sms_fallback');
        logger.info('SMS fallback sent', { phone: formattedPhone, type });
      } catch (smsError) {
        await logEntry('failed');
        logger.error('Both WhatsApp and SMS failed', {
          phone,
          whatsappError: (whatsappError as Error).message,
          smsError: (smsError as Error).message,
        });
      }
    }
  }
}

export const whatsappService = new WhatsAppService();
