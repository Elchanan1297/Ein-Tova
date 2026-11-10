import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';
import { AdminVoiceClip, ContentApi, VoiceEventType, uploadError } from '../../data/content-api';
import { EyeLoader } from '../../../../shared/ui/eye-loader/eye-loader';

const EVENTS: { type: VoiceEventType; title: string; when: string }[] = [
  { type: 'Welcome', title: 'ברוכים הבאים', when: 'בלחיצה על "בואו נתחיל"' },
  { type: 'GameStart', title: 'תחילת משחק', when: 'כשמתחילים לשחק' },
  { type: 'Correct', title: 'תשובה נכונה', when: 'אחרי תשובה נכונה, לפי הסיכוי בהגדרות' },
  { type: 'Incorrect', title: 'תשובה לא נכונה', when: 'אחרי טעות או כשנגמר הזמן, לפי הסיכוי בהגדרות' },
  { type: 'GameEnd', title: 'סוף המשחק', when: 'במסך הסיכום' },
  { type: 'Winner', title: 'הכרזת זוכה', when: 'במצגת, בהכרזה על המשפחה הזוכה' },
];

/** קולות של אבא: כמה וריאציות לכל אירוע (אחת נבחרת באקראי). תמלול חובה. */
@Component({
  selector: 'app-voices-admin',
  imports: [EyeLoader, Icon],
  templateUrl: './voices-admin.html',
  styleUrl: './voices-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class VoicesAdmin {
  private readonly api = inject(ContentApi);

  protected readonly clips = signal<AdminVoiceClip[] | null>(null);
  protected readonly dirty = signal<Set<AdminVoiceClip>>(new Set());
  protected readonly uploading = signal<VoiceEventType | null>(null);
  protected readonly message = signal<{ ok: boolean; text: string } | null>(null);
  protected readonly confirmDelete = signal<number | null>(null);

  protected readonly groups = computed(() =>
    EVENTS.map((e) => ({ ...e, clips: (this.clips() ?? []).filter((c) => c.eventType === e.type) })),
  );

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.clips.set(await this.api.list<AdminVoiceClip>('voices'));
    this.dirty.set(new Set());
  }

  protected edit(clip: AdminVoiceClip, patch: Partial<AdminVoiceClip>): void {
    const next = { ...clip, ...patch };
    this.clips.update((list) => list?.map((c) => (c === clip ? next : c)) ?? null);
    this.dirty.update((s) => {
      const copy = new Set(s);
      copy.delete(clip);
      return copy.add(next);
    });
  }

  protected async upload(event: Event, type: VoiceEventType): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploading.set(type);
    try {
      const fileUrl = await this.api.uploadAudio(file);
      const clip: AdminVoiceClip = { clipId: null, eventType: type, fileUrl, transcript: '', isActive: true };
      this.clips.update((list) => [...(list ?? []), clip]);
      this.dirty.update((s) => new Set(s).add(clip));
      this.say(true, 'הקובץ עלה. עכשיו כותבים תמלול ושומרים.');
    } catch (e) {
      this.say(false, uploadError(e instanceof HttpErrorResponse ? e.error?.status : undefined));
    } finally {
      this.uploading.set(null);
    }
  }

  protected async save(clip: AdminVoiceClip): Promise<void> {
    if (!clip.transcript.trim()) {
      this.say(false, 'צריך תמלול: הוא מוצג על המסך בזמן הניגון.');
      return;
    }
    try {
      await this.api.save('voices', clip);
      this.say(true, 'הקליפ נשמר.');
      await this.load();
    } catch {
      this.say(false, 'השמירה נכשלה.');
    }
  }

  protected async remove(clip: AdminVoiceClip): Promise<void> {
    if (clip.clipId === null) {
      this.clips.update((list) => list?.filter((c) => c !== clip) ?? null);
      return;
    }
    if (this.confirmDelete() !== clip.clipId) {
      this.confirmDelete.set(clip.clipId);
      return;
    }
    this.confirmDelete.set(null);
    await this.api.remove('voices', clip.clipId);
    await this.load();
  }

  private say(ok: boolean, text: string): void {
    this.message.set({ ok, text });
    setTimeout(() => this.message.set(null), 4000);
  }
}
