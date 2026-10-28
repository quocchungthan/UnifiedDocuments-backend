import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FieldBook {
  async read(path: string, signal: AbortSignal): Promise<string> {
    if (!/^\/books\/[a-z0-9-]+\.md$/.test(path)) throw new Error('Invalid field book path.');
    const response = await fetch(path, { signal });
    if (!response.ok) throw new Error(`Field book request failed (HTTP ${response.status}).`);
    return response.text();
  }
}
