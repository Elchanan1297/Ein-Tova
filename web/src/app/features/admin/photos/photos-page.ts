import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { EyeLoader } from '../../../shared/ui/eye-loader/eye-loader';
import { Icon } from '../../../shared/ui/icon/icon';
import { AdminPhoto, PhotoCounts, PhotoPatch, PhotoStatus, PhotosApi, yearLabel } from '../data/photos-api';
import { PhotoTagger } from './ui/photo-tagger';

interface UploadItem {
  name: string;
  state: 'waiting' | 'uploading' | 'done' | 'duplicate' | 'error';
  message?: string;
}

const TABS: { status: PhotoStatus; label: string }[] = [
  { status: 0, label: 'טיוטות לתיוג' },
  { status: 1, label: 'פורסמו' },
  { status: 2, label: 'מוסתרות' },
];
const PARALLEL_UPLOADS = 3;

/** "מסע בזמן" בניהול: העלאה, טאבים לפי סטטוס, בחירה מרובה ופעולות בכמות, תיוג אחת־אחת. */
@Component({
  selector: 'app-photos-page',
  imports: [Icon, EyeLoader, PhotoTagger],
  templateUrl: './photos-page.html',
  styleUrl: './photos-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PhotosPage {
  private readonly api = inject(PhotosApi);

  protected readonly tabs = TABS;
  protected readonly yearLabel = yearLabel;
  protected readonly tab = signal<PhotoStatus>(0);
  protected readonly photos = signal<AdminPhoto[] | null>(null);
  protected readonly counts = signal<PhotoCounts | null>(null);
  protected readonly selected = signal<Set<string>>(new Set());
  private lastClicked: number | null = null;

  protected readonly uploads = signal<UploadItem[]>([]);
  protected readonly uploading = computed(() => this.uploads().some((u) => u.state === 'waiting' || u.state === 'uploading'));
  protected readonly dragOver = signal(false);

  protected readonly tagging = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly confirmDelete = signal(false);
  protected readonly bulkYear = signal('');
  protected readonly bulkApprox = signal(false);
  protected readonly bulkCaption = signal('');
  protected readonly notice = signal<{ ok: boolean; text: string } | null>(null);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    try {
      const res = await this.api.list(this.tab());
      this.photos.set(res.photos);
      this.counts.set(res.counts);
      // בחירה שכבר לא ברשימה (למשל אחרי פרסום) נמחקת
      const ids = new Set(res.photos.map((p) => p.publicId));
      this.selected.update((s) => new Set([...s].filter((id) => ids.has(id))));
    } catch {
      this.say(false, 'לא הצלחנו לטעון את התמונות.');
    }
  }

  protected switchTab(status: PhotoStatus): void {
    this.tab.set(status);
    this.selected.set(new Set());
    this.confirmDelete.set(false);
    this.photos.set(null);
    void this.load();
  }

  protected countOf(status: PhotoStatus): number {
    const c = this.counts();
    return c ? [c.drafts, c.published, c.hidden][status] : 0;
  }

  // ---------- בחירה ----------
  protected toggle(index: number, event: MouseEvent): void {
    const list = this.photos() ?? [];
    const next = new Set(this.selected());
    if (event.shiftKey && this.lastClicked !== null) {
      // Shift: טווח מהלחיצה הקודמת
      const [a, b] = [Math.min(this.lastClicked, index), Math.max(this.lastClicked, index)];
      for (let i = a; i <= b; i++) next.add(list[i].publicId);
    } else {
      const id = list[index].publicId;
      if (next.has(id)) next.delete(id);
      else next.add(id);
    }
    this.lastClicked = index;
    this.selected.set(next);
    this.confirmDelete.set(false);
  }

  protected selectAll(): void {
    const list = this.photos() ?? [];
    this.selected.set(this.selected().size === list.length ? new Set() : new Set(list.map((p) => p.publicId)));
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
    this.confirmDelete.set(false);
  }

  // ---------- העלאה ----------
  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    void this.uploadFiles([...(input.files ?? [])]);
    input.value = '';
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    void this.uploadFiles([...(event.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)));
  }

  private async uploadFiles(files: File[]): Promise<void> {
    if (!files.length) return;
    const start = this.uploads().length;
    this.uploads.update((u) => [...u, ...files.map((f) => ({ name: f.name, state: 'waiting' as const }))]);
    const set = (i: number, patch: Partial<UploadItem>) =>
      this.uploads.update((u) => u.map((x, j) => (j === start + i ? { ...x, ...patch } : x)));

    // עד 3 במקביל
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const i = next++;
        set(i, { state: 'uploading' });
        try {
          const res = await this.api.upload(files[i]);
          set(i, { state: res.status === 'Duplicate' ? 'duplicate' : 'done' });
        } catch (e) {
          set(i, { state: 'error', message: e instanceof HttpErrorResponse ? (e.error?.message ?? 'ההעלאה נכשלה') : 'ההעלאה נכשלה' });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL_UPLOADS, files.length) }, worker));

    const all = this.uploads().slice(start);
    const done = all.filter((u) => u.state === 'done').length;
    const dup = all.filter((u) => u.state === 'duplicate').length;
    const failed = all.filter((u) => u.state === 'error').length;
    this.say(failed === 0, `הועלו ${done}${dup ? `, ${dup} כבר היו` : ''}${failed ? `, ${failed} נכשלו` : ''}.`);
    this.switchTab(0);
  }

  protected clearUploads(): void {
    this.uploads.update((u) => u.filter((x) => x.state === 'waiting' || x.state === 'uploading'));
  }

  // ---------- פעולות בכמות ----------
  protected async applyBulk(patch: PhotoPatch, text: string): Promise<void> {
    const ids = [...this.selected()];
    if (!ids.length) return;
    this.busy.set(true);
    try {
      const res = await this.api.bulk(ids, patch);
      this.say(true, `${text} (${res.updated})`);
      await this.load();
    } catch (e) {
      const field = e instanceof HttpErrorResponse ? e.error?.field : null;
      this.say(false, field === 'yearTaken' ? 'שנה בין 1940 לשנה הנוכחית.' : field === 'caption' ? 'כיתוב עד 140 תווים.' : 'הפעולה נכשלה.');
    } finally {
      this.busy.set(false);
    }
  }

  protected setYear(): Promise<void> {
    const year = this.bulkYear().trim() ? +this.bulkYear() : null;
    return this.applyBulk({ yearTaken: year, yearApprox: this.bulkApprox() }, year ? `השנה עודכנה ל־${year}` : 'השנה נמחקה');
  }

  protected setCaption(): Promise<void> {
    return this.applyBulk({ caption: this.bulkCaption().trim() || null }, 'הכיתוב עודכן');
  }

  protected async deleteSelected(): Promise<void> {
    if (!this.confirmDelete()) {
      this.confirmDelete.set(true);
      return;
    }
    this.confirmDelete.set(false);
    this.busy.set(true);
    const ids = [...this.selected()];
    let ok = 0;
    for (const id of ids) {
      try {
        await this.api.remove(id);
        ok++;
      } catch {
        // ממשיכים עם השאר
      }
    }
    this.busy.set(false);
    this.say(ok === ids.length, `נמחקו ${ok} תמונות${ok < ids.length ? `, ${ids.length - ok} נכשלו` : ''}.`);
    await this.load();
  }

  protected async onTaggerClosed(): Promise<void> {
    this.tagging.set(null);
    await this.load();
  }

  private say(ok: boolean, text: string): void {
    this.notice.set({ ok, text });
    setTimeout(() => this.notice.set(null), 4000);
  }
}
