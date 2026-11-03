import { httpResource } from '@angular/common/http';
import { Injectable, computed } from '@angular/core';

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

/** הגדרות ציבוריות של האירוע (`/api/config`), נטען פעם אחת לכל האפליקציה. */
@Injectable({ providedIn: 'root' })
export class ConfigStore {
  private readonly resource = httpResource<PublicConfig>(() => '/api/config');

  readonly config = computed(() => this.resource.value() ?? null);
  readonly factsLabelCount = computed(() => this.config()?.factsLabelCount ?? null);

  reload(): void {
    this.resource.reload();
  }
}
