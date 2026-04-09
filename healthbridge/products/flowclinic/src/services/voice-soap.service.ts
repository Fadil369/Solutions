import type { SoapNote } from '../types';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

export class VoiceSoapService {
  private sttEnabled: boolean;

  constructor() {
    this.sttEnabled = !!(process.env.GOOGLE_CLOUD_PROJECT_ID);
    if (this.sttEnabled) {
      logger.info('Voice SOAP service initialized with Google Cloud STT');
    } else {
      logger.info('Voice SOAP service running in stub mode (no Google Cloud credentials)');
    }
  }

  /**
   * Transcribe audio and format as SOAP note.
   * In production, this uses Google Cloud Speech-to-Text.
   * Currently returns a structured SOAP template.
   */
  async transcribeAndFormat(
    audioBuffer: Buffer,
    language: 'ar' | 'en' = 'en'
  ): Promise<SoapNote> {
    if (this.sttEnabled) {
      return this.transcribeWithGoogleSTT(audioBuffer, language);
    }

    // Stub implementation
    logger.info('Voice SOAP stub: returning template', {
      audioSize: audioBuffer.length,
      language,
    });

    return this.getStubSoapNote(language);
  }

  /**
   * Google Cloud STT integration (production path).
   */
  private async transcribeWithGoogleSTT(
    audioBuffer: Buffer,
    language: 'ar' | 'en'
  ): Promise<SoapNote> {
    try {
      // Dynamic import to avoid crashing when @google-cloud/speech isn't configured
      const speech = await import('@google-cloud/speech');
      const client = new speech.SpeechClient();

      const audioBytes = audioBuffer.toString('base64');
      const languageCode = language === 'ar' ? 'ar-SA' : 'en-US';

      const [response] = await client.recognize({
        audio: { content: audioBytes },
        config: {
          encoding: 'WEBM_OPUS' as any,
          sampleRateHertz: 48000,
          languageCode,
          enableAutomaticPunctuation: true,
          model: 'medical_dictation',
          useEnhanced: true,
        },
      });

      const transcript = response.results
        ?.map((r) => r.alternatives?.[0]?.transcript || '')
        .join('\n') || '';

      return this.parseTranscriptToSoap(transcript);
    } catch (error) {
      logger.error('Google STT transcription failed', { error: (error as Error).message });
      return this.getStubSoapNote(language);
    }
  }

  /**
   * Parse raw transcript into SOAP structure.
   * Looks for keywords like "subjective", "objective", etc.
   */
  private parseTranscriptToSoap(transcript: string): SoapNote {
    const lower = transcript.toLowerCase();

    const sections: SoapNote = {
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
    };

    // Try to find SOAP section markers
    const patterns = {
      subjective: /(?:subjective|complaint|history|patient reports?)[:\s]*(.*?)(?=objective|assessment|plan|$)/is,
      objective: /objective[:\s]*(.*?)(?=assessment|plan|$)/is,
      assessment: /assessment[:\s]*(.*?)(?=plan|$)/is,
      plan: /plan[:\s]*(.*?)$/is,
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = transcript.match(pattern);
      if (match && match[1]) {
        sections[key as keyof SoapNote] = match[1].trim();
      }
    }

    // If no structure detected, put everything in subjective
    if (!sections.subjective && !sections.objective && !sections.assessment && !sections.plan) {
      sections.subjective = transcript;
    }

    return sections;
  }

  /**
   * Return a stub SOAP template for demo/testing.
   */
  private getStubSoapNote(language: 'ar' | 'en'): SoapNote {
    if (language === 'ar') {
      return {
        subjective: '[نص من المحادثة الصوتية — يرجى التحقق والتعديل]',
        objective: '[نتائج الفحص السريري]',
        assessment: '[التشخيص]',
        plan: '[خطة العلاج]',
      };
    }

    return {
      subjective: '[Transcribed from voice dictation — please verify and edit]',
      objective: '[Clinical examination findings]',
      assessment: '[Diagnosis]',
      plan: '[Treatment plan]',
    };
  }
}

export const voiceSoapService = new VoiceSoapService();
