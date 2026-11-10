import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';
import { AdminPhoto, DECADES, PhotoPatch, PhotoStatus, PhotosApi } from '../../data/photos-api';

/**
 * תיוג מהיר: תמונה גדולה, עשור ואז שנה, "בערך", כיתוב, מי עוד, מובחרת.
 * "הבאה" שומרת ועוברת, בלי לחזור לגריד. חיצי המקלדת עובדים גם.
 */
@Component({
  selector: 'app-photo-tagger',
  imports: [Icon],
  templateUrl: './photo-tagger.html',
  styleUrl: './photo-tagger.scss',
  host: { '(document:keydown)': 'onKey($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoTagger {
  private readonly api = inject(PhotosApi);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly photos = input.required<AdminPhoto[]>();
  readonly start = input.required<number>();
  readonly closed = output<void>();

  protected readonly decades = DECADES;
  protected readonly index = linkedSignal(() => this.start());
  /** עותק מקומי: מה שנשמר מתעדכן גם כאן, כדי שחזרה לתמונה תראה את הערכים החדשים */
  protected readonly items = linkedSignal(() => this.photos().map((p) => ({ ...p })));
  protected readonly photo = computed(() => this.items()[this.index()]);

  protected readonly year = linkedSignal<number | null>(() => this.photo().yearTaken);
  protected readonly approx = linkedSignal(() => this.photo().yearApprox);
  protected readonly caption = linkedSignal(() => this.photo().caption ?? '');
  protected readonly whoElse = linkedSignal(() => this.photo().whoElse ?? '');
  protected readonly featured = linkedSignal(() => this.photo().isFeatured);
  protected readonly decade = linkedSignal<number | null>(() => (this.photo().yearTaken ? Math.floor(this.photo().yearTaken! / 10) * 10 : null));

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly years = computed(() => {
    const d = this.decade();
    const now = new Date().getFullYear();
    return d === null ? [] : Array.from({ length: 10 }, (_, i) => d + i).filter((y) => y >= 1940 && y <= now);
  });

  private readonly changes = computed<PhotoPatch>(() => {
    const p = this.photo();
    const c: PhotoPatch = {};
    if (this.year() !== p.yearTaken) c.yearTaken = this.year();
    if (this.approx() !== p.yearApprox) c.yearApprox = this.approx();
    if ((this.caption().trim() || null) !== (p.caption ?? null)) c.caption = this.caption().trim() || null;
    if ((this.whoElse().trim() || null) !== (p.whoElse ?? null)) c.whoElse = this.whoElse().trim() || null;
    if (this.featured() !== p.isFeatured) c.isFeatured = this.featured();
    return c;
  });
  protected readonly dirty = computed(() => Object.keys(this.changes()).length > 0);

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  protected pickDecade(d: number): void {
    this.decade.set(d);
    // אם השנה לא בעשור הזה: מתחילים מתחילת העשור, "בערך"
    const y = this.year();
    if (!y || Math.floor(y / 10) * 10 !== d) {
      this.year.set(d);
      this.approx.set(true);
    }
  }

  protected pickYear(y: number): void {
    this.year.set(y);
    this.approx.set(false);
  }

  protected clearYear(): void {
    this.year.set(null);
    this.decade.set(null);
    this.approx.set(false);
  }

  /** שומר (אם צריך) ומשנה סטטוס אם ביקשו. מחזיר false אם נכשל */
  private async save(status?: PhotoStatus): Promise<boolean> {
    const patch: PhotoPatch = { ...this.changes(), ...(status !== undefined ? { status } : {}) };
    if (!Object.keys(patch).length) return true;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.api.update(this.photo().publicId, patch);
      const i = this.index();
      this.items.update((list) =>
        list.map((p, j) =>
          j === i
            ? { ...p, yearTaken: this.year(), yearApprox: this.approx(), yearSource: patch.yearTaken !== undefined ? 0 : p.yearSource,
                caption: this.caption().trim() || null, whoElse: this.whoElse().trim() || null, isFeatured: this.featured(),
                status: status ?? p.status }
            : p,
        ),
      );
      return true;
    } catch (e) {
      const field = e instanceof HttpErrorResponse ? e.error?.field : null;
      this.error.set(field === 'caption' ? 'כיתוב עד 140 תווים.' : field === 'whoElse' ? 'עד 200 תווים.' : 'השמירה נכשלה.');
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  protected async go(delta: number): Promise<void> {
    const next = this.index() + delta;
    if (next < 0 || next >= this.items().length) return;
    if (await this.save()) this.index.set(next);
  }

  protected async setStatus(status: PhotoStatus): Promise<void> {
    if (!(await this.save(status))) return;
    if (this.index() < this.items().length - 1) this.index.update((i) => i + 1);
  }

  protected async close(): Promise<void> {
    if (await this.save()) this.dialog().nativeElement.close();
  }

  protected onKey(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    // RTL: חץ שמאלה = הבאה
    if (e.key === 'ArrowLeft') void this.go(1);
    if (e.key === 'ArrowRight') void this.go(-1);
  }
}
