/** saveTheDate מתוך /api/config כשהאפליקציה נעולה */
export interface SaveTheDateInfo {
  locked: true;
  eventAt: string | null;
  display: SaveTheDateDisplay;
  hebrewText: string;
  afterNightfall: boolean;
  headline: string;
  subline: string;
  location: string;
  showCountdown: boolean;
  serverNow: string;
}

export type SaveTheDateDisplay = 'gregorian' | 'hebrew' | 'both';

/** מה שהשרת מחזיר: כשפתוח רק { locked: false } */
export type SaveTheDateState = SaveTheDateInfo | { locked: false };
