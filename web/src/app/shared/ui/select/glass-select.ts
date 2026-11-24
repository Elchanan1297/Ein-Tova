import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { Icon, IconName } from '../icon/icon';

export interface SelectOption<T> {
  value: T;
  label: string;
  icon?: IconName;
  /** פעולה מיוחדת (למשל "+ משפחה חדשה"): בזהב, עם קו מפריד מעליה */
  action?: boolean;
}

let nextId = 0;

/**
 * רשימה נפתחת בעיצוב האפליקציה, במקום ה־select של הדפדפן (שבחלונות נפתח לבן עם אותיות שמנת).
 * הרשימה נפתחת בשכבה העליונה (Popover API), כך שהיא לא נחתכת בתוך חלונית או כרטיס עם גלילה.
 * מקלדת כמו select: חיצים, Home/End, Enter/רווח, Escape, והקלדת אות קופצת לפריט.
 * עיצוב מבחוץ: --sel-bg, --sel-border, --sel-radius, --sel-pad.
 */
@Component({
  selector: 'app-select',
  imports: [Icon],
  template: `
    <button
      #trigger
      type="button"
      class="trigger"
      role="combobox"
      aria-haspopup="listbox"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="id + '-list'"
      [attr.aria-label]="label() || null"
      [attr.aria-activedescendant]="open() && active() >= 0 ? id + '-o' + active() : null"
      [disabled]="disabled()"
      (click)="toggle()"
      (keydown)="key($event)"
      (blur)="close()"
    >
      @if (current()?.icon; as ic) {
        <app-icon class="lead" [name]="ic" />
      }
      <span class="txt">{{ current()?.label ?? placeholder() }}</span>
      <app-icon class="chev" name="chevron-down" />
    </button>

    <ul
      #list
      popover="manual"
      role="listbox"
      class="list"
      [id]="id + '-list'"
      [class.up]="up()"
      [class.shown]="open()"
      [attr.aria-label]="label() || null"
      (pointerdown)="$event.preventDefault()"
    >
      @for (o of options(); track o.value; let i = $index) {
        <li
          role="option"
          [id]="id + '-o' + i"
          [attr.aria-selected]="o.value === value()"
          [class.active]="i === active()"
          [class.action]="o.action"
          (pointermove)="active.set(i)"
          (click)="pick(o)"
        >
          @if (o.icon) {
            <app-icon class="lead" [name]="o.icon" />
          }
          <span class="txt">{{ o.label }}</span>
          @if (o.value === value()) {
            <app-icon class="tick" name="check" />
          }
        </li>
      }
    </ul>
  `,
  styleUrl: './glass-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlassSelect<T> {
  readonly options = input.required<readonly SelectOption<T>[]>();
  readonly value = model.required<T>();
  /** aria-label כשאין label עוטף */
  readonly label = input('');
  readonly placeholder = input('בחירה');
  readonly disabled = input(false);

  protected readonly id = `sel${++nextId}`;
  protected readonly open = signal(false);
  protected readonly active = signal(-1);
  protected readonly up = signal(false);
  protected readonly current = computed(() => this.options().find((o) => o.value === this.value()));

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly list = viewChild.required<ElementRef<HTMLUListElement>>('list');
  private readonly popover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

  constructor() {
    // גלילה או שינוי גודל: הרשימה צפה במקום קבוע, אז סוגרים (כמו select רגיל)
    const onMove = (e: Event) => {
      if (this.open() && e.target !== this.list().nativeElement) this.close();
    };
    // Escape בתוך חלונית (dialog): סוגרים רק את הרשימה, לא את החלונית
    const onCancel = (e: Event) => {
      if (this.open()) {
        e.preventDefault();
        this.close();
      }
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    document.addEventListener('cancel', onCancel, true);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      document.removeEventListener('cancel', onCancel, true);
    });

    // הפריט הפעיל תמיד גלוי בתוך הרשימה
    effect(() => {
      const i = this.active();
      if (this.open() && i >= 0) this.list().nativeElement.children[i]?.scrollIntoView({ block: 'nearest' });
    });
  }

  protected toggle(): void {
    if (this.open()) this.close();
    else this.show();
  }

  protected show(): void {
    if (this.disabled() || this.open()) return;
    const list = this.list().nativeElement;
    const r = this.trigger().nativeElement.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const wanted = Math.min(300, this.options().length * 46 + 12);
    const up = below < wanted && above > below;
    this.up.set(up);
    const width = Math.max(r.width, 180);
    const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8); // RTL: מיושר לימין השדה
    Object.assign(list.style, {
      left: `${left}px`,
      width: `${width}px`,
      maxHeight: `${Math.max(140, Math.min(300, up ? above : below))}px`,
      top: up ? 'auto' : `${r.bottom + 6}px`,
      bottom: up ? `${window.innerHeight - r.top + 6}px` : 'auto',
    });
    if (this.popover) list.showPopover();
    this.active.set(Math.max(0, this.options().findIndex((o) => o.value === this.value())));
    this.open.set(true);
  }

  protected close(): void {
    if (!this.open()) return;
    this.open.set(false);
    const list = this.list().nativeElement;
    if (this.popover && list.matches(':popover-open')) list.hidePopover();
  }

  protected pick(o: SelectOption<T>): void {
    this.value.set(o.value);
    this.close();
    this.trigger().nativeElement.focus();
  }

  protected key(e: KeyboardEvent): void {
    const n = this.options().length;
    if (!n) return;
    const move = (i: number) => {
      e.preventDefault();
      if (!this.open()) this.show();
      this.active.set(Math.min(n - 1, Math.max(0, i)));
    };
    switch (e.key) {
      case 'ArrowDown':
        return move(this.open() ? this.active() + 1 : this.active());
      case 'ArrowUp':
        return move(this.open() ? this.active() - 1 : this.active());
      case 'Home':
        return move(0);
      case 'End':
        return move(n - 1);
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (this.open() && this.active() >= 0) this.pick(this.options()[this.active()]);
        else this.show();
        return;
      case 'Escape':
        if (this.open()) {
          e.preventDefault();
          e.stopPropagation(); // לא לסגור את החלונית שמסביב
          this.close();
        }
        return;
      case 'Tab':
        this.close();
        return;
    }
    // הקלדת אות: קפיצה לפריט הבא שמתחיל בה
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const k = e.key.toLowerCase();
      const opts = this.options();
      for (let step = 1; step <= n; step++) {
        const i = (Math.max(0, this.active()) + step) % n;
        if (opts[i].label.trim().toLowerCase().startsWith(k)) return move(i);
      }
    }
  }
}
