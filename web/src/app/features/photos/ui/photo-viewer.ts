import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Icon } from '../../../shared/ui/icon/icon';
import { Photo, photoYear } from '../data/photos-api';

const MAX_ZOOM = 4;
const SWIPE_PX = 60;

/**
 * צפייה במסך מלא: החלקה בין תמונות, זום בצביטה (או הקשה כפולה), ❤️.
 * מחוות דרך Pointer Events, כך שזה עובד גם במגע וגם בעכבר.
 */
@Component({
  selector: 'app-photo-viewer',
  imports: [Icon],
  templateUrl: './photo-viewer.html',
  styleUrl: './photo-viewer.scss',
  host: { '(document:keydown)': 'onKey($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoViewer {
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly photos = input.required<Photo[]>();
  readonly start = input.required<number>();
  readonly like = output<string>();
  readonly closed = output<void>();

  protected readonly index = linkedSignal(() => this.start());
  protected readonly photo = computed(() => this.photos()[this.index()]);
  protected readonly year = computed(() => photoYear(this.photo()));

  protected readonly scale = signal(1);
  protected readonly tx = signal(0);
  protected readonly ty = signal(0);
  /** בזמן החלקה: הזזה זמנית של התמונה עם האצבע */
  protected readonly drag = signal(0);

  private readonly pointers = new Map<number, { x: number; y: number }>();
  private gesture: { startDist: number; startScale: number; startX: number; startY: number; startTx: number; startTy: number } | null = null;
  private lastTap = 0;

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
    // תמונה חדשה: מאפסים זום, ומורידים מראש את השכנות (ההחלקה מרגישה מיידית)
    effect(() => {
      const i = this.index();
      this.resetZoom();
      for (const j of [i - 1, i + 1]) {
        const p = this.photos()[j];
        if (p) new Image().src = p.displayUrl;
      }
    });
  }

  protected go(delta: number): void {
    const next = this.index() + delta;
    if (next >= 0 && next < this.photos().length) this.index.set(next);
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected onKey(e: KeyboardEvent): void {
    // RTL: חץ שמאלה = הבאה
    if (e.key === 'ArrowLeft') this.go(1);
    if (e.key === 'ArrowRight') this.go(-1);
  }

  // ---------- מחוות ----------
  protected down(e: PointerEvent): void {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...this.pointers.values()];
    this.gesture = {
      startDist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
      startScale: this.scale(),
      startX: e.clientX,
      startY: e.clientY,
      startTx: this.tx(),
      startTy: this.ty(),
    };
  }

  protected move(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId) || !this.gesture) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...this.pointers.values()];
    const g = this.gesture;
    if (pts.length === 2 && g.startDist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.scale.set(Math.min(MAX_ZOOM, Math.max(1, (g.startScale * dist) / g.startDist)));
    } else if (pts.length === 1) {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (this.scale() > 1) {
        this.tx.set(g.startTx + dx);
        this.ty.set(g.startTy + dy);
      } else {
        this.drag.set(dx);
      }
    }
  }

  protected up(e: PointerEvent): void {
    const g = this.gesture;
    this.pointers.delete(e.pointerId);
    if (!g) return;
    if (this.pointers.size === 0) {
      const dx = e.clientX - g.startX;
      const moved = Math.hypot(dx, e.clientY - g.startY);
      if (this.scale() === 1 && Math.abs(dx) > SWIPE_PX) {
        // RTL: החלקה ימינה מביאה את הבאה
        this.go(dx > 0 ? 1 : -1);
      } else if (moved < 10) {
        this.tap();
      }
      this.drag.set(0);
      if (this.scale() <= 1.02) this.resetZoom();
      this.gesture = null;
    } else {
      // נשארה אצבע אחת אחרי צביטה: ממשיכים לגרור ממנה
      const [p] = [...this.pointers.values()];
      this.gesture = { ...g, startX: p.x, startY: p.y, startTx: this.tx(), startTy: this.ty(), startDist: 0, startScale: this.scale() };
    }
  }

  /** הקשה כפולה: זום פנימה/החוצה */
  private tap(): void {
    const now = Date.now();
    if (now - this.lastTap < 300) {
      if (this.scale() > 1) this.resetZoom();
      else this.scale.set(2.5);
      this.lastTap = 0;
    } else {
      this.lastTap = now;
    }
  }

  private resetZoom(): void {
    this.scale.set(1);
    this.tx.set(0);
    this.ty.set(0);
  }
}
