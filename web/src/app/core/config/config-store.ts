import { httpResource } from '@angular/common/http';
import { DOCUMENT, Injectable, computed, inject } from '@angular/core';

export interface PublicConfig {
  isOpen: boolean;
  gameMode: 'Always' | 'Window' | 'Closed';
  opensAt: string | null;
  closesAt: string | null;
  questionCount: number;
  factsLabelCount: number;
  secondsPerQuestion: number;
  voiceChance: number;
}

/**
 * הגדרות ציבוריות של האירוע (`/api/config`). נטען בפתיחה, ושוב בכל חזרה לאפליקציה,
 * כדי ששינוי מהניהול (מספר בכותרת, פתיחת המשחק) יופיע בלי רענון ידני.
 */
@Injectable({ providedIn: 'root' })
export class ConfigStore {
  private readonly resource = httpResource<PublicConfig>(() => '/api/config');

  readonly config = computed(() => this.resource.value() ?? null);
  readonly factsLabelCount = computed(() => this.config()?.factsLabelCount ?? null);

  constructor() {
    const document = inject(DOCUMENT);
    // שירות שחי לאורך כל האפליקציה: אין צורך להסיר את המאזין
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.reload();
    });
  }

  reload(): void {
    this.resource.reload();
  }
}
