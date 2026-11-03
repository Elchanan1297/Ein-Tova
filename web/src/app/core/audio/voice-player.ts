import { HttpClient } from '@angular/common/http';
import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../auth/auth-store';
import { ConfigStore } from '../config/config-store';

export type VoiceEvent = 'Welcome' | 'GameStart' | 'Correct' | 'Incorrect' | 'GameEnd' | 'Winner';

interface VoiceClip {
  clipId: number;
  fileUrl: string;
  transcript: string | null;
}

const MUTE_KEY = 'eintova.muted';
// WAV ריק: מנגנים אותו בלחיצה הראשונה כדי "לשחרר" את האודיו בדפדפן (בעיקר iOS)
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const CAPTION_LINGER_MS = 1800;

/**
 * הקולות של אבא: אלמנט אודיו אחד לכל האפליקציה, שמשתחרר בלחיצה הראשונה.
 * הקליפ נבחר אקראית בשרת; התמלול מוצג על המסך בזמן הניגון.
 */
@Injectable({ providedIn: 'root' })
export class VoicePlayer {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthStore);
  private readonly config = inject(ConfigStore);
  private readonly document = inject(DOCUMENT);

  private audio: HTMLAudioElement | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly sources = new Map<string, Promise<string>>();

  readonly muted = signal(readMuted());
  /** התמלול של הקליפ שמתנגן עכשיו (null = אין קליפ) */
  readonly caption = signal<string | null>(null);

  constructor() {
    // מי שנכנס ישר לבית (כבר מחובר) לא עובר במסך הפתיחה: משחררים בלחיצה הראשונה בכל מקום
    this.document.addEventListener('pointerdown', () => this.unlock(), { once: true, capture: true });
  }

  /** חייב לקרות בתוך לחיצה של המשתמש */
  unlock(): void {
    if (this.audio) return;
    const audio = new Audio();
    audio.preload = 'auto';
    audio.addEventListener('ended', () => this.finish());
    audio.src = SILENT;
    audio.play().catch(() => undefined);
    this.audio = audio;
  }

  /** @param byChance לפי VoiceChance מההגדרות (לתשובה נכונה/לא נכונה) */
  async play(event: VoiceEvent, byChance = false): Promise<void> {
    const audio = this.audio;
    if (!audio || this.muted() || !this.auth.isLoggedIn()) return;
    if (byChance && Math.random() >= (this.config.config()?.voiceChance ?? 0)) return;

    let clip: VoiceClip | null;
    try {
      clip = await firstValueFrom(this.http.get<VoiceClip | null>(`/api/game/voice/${event}`));
    } catch {
      return; // קול הוא תוספת: תקלה לא עוצרת כלום
    }
    if (clip) await this.playClip(clip.fileUrl, clip.transcript);
  }

  /** ניגון קליפ ידוע (למשל במצגת), עם תמלול על המסך */
  async playClip(fileUrl: string, transcript: string | null): Promise<void> {
    const audio = this.audio;
    if (!audio || this.muted()) return;
    const src = await this.source(fileUrl);
    if (this.muted()) return;

    clearTimeout(this.hideTimer);
    audio.src = src;
    this.caption.set(transcript ?? '');
    try {
      await audio.play();
    } catch {
      this.stop();
    }
  }

  stop(): void {
    clearTimeout(this.hideTimer);
    this.audio?.pause();
    this.caption.set(null);
  }

  toggleMute(): void {
    const muted = !this.muted();
    this.muted.set(muted);
    if (muted) this.stop();
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // בלי אחסון ההשתקה נשמרת רק עד רענון
    }
  }

  /**
   * הקליפ נטען ב־fetch רגיל ומנוגן מ־Blob: כך הוא נשמר במטמון של ה־Service Worker
   * ועובד גם בספארי (שמבקש אודיו בבקשות Range, שה־SW לא תומך בהן).
   */
  private source(url: string): Promise<string> {
    let src = this.sources.get(url);
    if (!src) {
      src = fetch(url)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then((blob) => URL.createObjectURL(blob))
        .catch(() => {
          this.sources.delete(url);
          return url; // נסיון ישיר בפעם הזו, ובפעם הבאה שוב דרך fetch
        });
      this.sources.set(url, src);
    }
    return src;
  }

  private finish(): void {
    if (this.caption() === null) return;
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.caption.set(null), CAPTION_LINGER_MS);
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
