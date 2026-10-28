import { Injectable } from '@angular/core';
import { z } from 'zod';
import { requestJson } from '../http/request';

export const transcriptSavedSchema = z.object({
  videoId: z.string(),
  path: z.string(),
  language: z.string(),
  status: z.literal('saved'),
});

@Injectable({ providedIn: 'root' })
export class CarTranscriptClient {
  submit(input: { url: string; language: string; title: string; text: string }, signal?: AbortSignal) {
    return requestJson('car', '/api/car-transcripts', transcriptSavedSchema, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
    });
  }
}
