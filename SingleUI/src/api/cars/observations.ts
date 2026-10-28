import { Injectable, signal } from '@angular/core';
import { z } from 'zod';
export interface Observation {
  id: string;
  car: string;
  text: string;
  at: string;
}

@Injectable({ providedIn: 'root' })
export class Observations {
  readonly records = signal<Observation[]>([]);
  readonly error = signal('');
  constructor() {
    try {
      const data = z
        .array(
          z.object({
            id: z.string(),
            car: z.string(),
            text: z.string(),
            at: z.string().datetime(),
          }),
        )
        .parse(JSON.parse(localStorage.getItem('emfc.30s.observations') ?? '[]'));
      this.records.set(data);
    } catch (error) {
      this.error.set(`Could not load observations: ${String(error)}`);
    }
  }
  add(car: string, text: string) {
    if (!text.trim()) {
      this.error.set('Enter an observation before saving.');
      return;
    }
    const next = [
      ...this.records(),
      { id: crypto.randomUUID(), car, text: text.trim(), at: new Date().toISOString() },
    ];
    this.persist(next);
  }
  remove(id: string) {
    this.persist(this.records().filter((item) => item.id !== id));
  }
  private persist(records: Observation[]) {
    try {
      localStorage.setItem('emfc.30s.observations', JSON.stringify(records));
      this.records.set(records);
      this.error.set('');
    } catch (error) {
      this.error.set(`Could not save observations: ${String(error)}`);
    }
  }
  export() {
    const link = document.createElement('a');
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(this.records(), null, 2)], { type: 'application/json' }),
    );
    link.href = url;
    link.download = '30s-observations.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
