import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationCancel, NavigationCancellationCode, NavigationEnd, NavigationError, NavigationSkipped, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminSession } from '../../../core/auth/admin-session';
import { Icon, IconName } from '../../../shared/ui/icon/icon';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

const NAV: NavItem[] = [
  { path: 'settings', label: 'הגדרות ומשחק', icon: 'sliders' },
  { path: 'dashboard', label: 'דשבורד', icon: 'chart' },
  { path: 'questions', label: 'שאלות', icon: 'question' },
  { path: 'guests', label: 'מוזמנים', icon: 'users' },
  { path: 'content', label: 'תוכן', icon: 'sparkles' },
  { path: 'photos', label: 'מסע בזמן', icon: 'image' },
  { path: 'show', label: 'מצגת', icon: 'monitor' },
  { path: 'save-the-date', label: 'Save the date', icon: 'calendar' },
];

const COLLAPSED_KEY = 'eintova.adminNavCollapsed';
/** מתחת לרוחב הזה התפריט נפתח כשכבה מעל הדף (טלפון, iPad mini לאורך) */
const DESKTOP = '(min-width: 1024px)';

/**
 * מעטפת הניהול: תפריט צד ימני (מחשב, אפשר לכווץ לאייקונים), ובמסך צר כפתור תפריט שפותח שכבה.
 * כל הדפים באותו רוחב: כל השטח שליד התפריט (עד 1720px במסכים ענקיים).
 * המשתנה --admin-nav-w זמין לדפים, כדי שפסים צפים יתמרכזו על אזור התוכן ולא על כל המסך.
 */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, NgTemplateOutlet],
  host: { '[class.collapsed]': 'collapsed()' },
  template: `
    <ng-template #navTpl let-drawer="drawer">
      <nav class="nav" aria-label="ניהול">
        <ul>
          @for (item of nav; track item.path) {
            <li>
              <a
                [routerLink]="item.path"
                routerLinkActive="active"
                ariaCurrentWhenActive="page"
                [attr.data-tip]="item.label"
                (click)="navigated(item.path)"
              >
                <app-icon [name]="item.icon" />
                <span class="lbl">{{ item.label }}</span>
              </a>
            </li>
          }
        </ul>
        <button type="button" class="out" [attr.data-tip]="'יציאה'" (click)="logout()">
          <app-icon name="logout" />
          <span class="lbl">יציאה</span>
        </button>
      </nav>
    </ng-template>

    <!-- מחשב: תפריט צד -->
    <aside class="side lg" id="admin-side" (pointerover)="showTip($event)" (focusin)="showTip($event)" (pointerleave)="tip.set(null)" (focusout)="tip.set(null)">
      <div class="side-head">
        <a class="brand" routerLink="/admin" aria-label="ניהול, דף ראשי">
          <img src="assets/logo/ein-tova-eye-symbol-dark.svg" alt="" width="34" height="31" />
          <span class="lbl">ניהול</span>
        </a>
        <button
          type="button"
          class="icon-btn"
          aria-controls="admin-side"
          [attr.aria-expanded]="!collapsed()"
          [attr.aria-label]="collapsed() ? 'הרחבת התפריט' : 'כיווץ התפריט'"
          [attr.data-tip]="collapsed() ? 'הרחבת התפריט' : 'כיווץ התפריט'"
          (click)="toggleCollapsed()"
        >
          <app-icon name="panel" />
        </button>
      </div>
      <ng-container *ngTemplateOutlet="navTpl" />
    </aside>

    <!-- טיפ לתפריט המכווץ: מחוץ לתפריט, כי הזכוכית (backdrop-filter) חותכת אלמנטים צפים בתוכה -->
    @if (collapsed() && tip(); as t) {
      <div class="tip" aria-hidden="true" [style.top.px]="t.top">{{ t.text }}</div>
    }

    <!-- טלפון וטאבלט: פס עליון עם כפתור תפריט -->
    <header class="top lg">
      <button
        #menuBtn
        type="button"
        class="icon-btn"
        aria-controls="admin-drawer"
        aria-haspopup="dialog"
        [attr.aria-expanded]="drawerOpen()"
        aria-label="תפריט ניהול"
        (click)="openDrawer()"
      >
        <app-icon name="menu" />
      </button>
      <a class="brand" routerLink="/admin">
        <img src="assets/logo/ein-tova-eye-symbol-dark.svg" alt="" width="30" height="27" />
        <span>ניהול</span>
      </a>
      @if (current(); as c) {
        <span class="here">{{ c }}</span>
      }
    </header>

    <dialog #drawer id="admin-drawer" class="drawer" aria-label="תפריט ניהול" (click)="onDrawerClick($event)" (close)="onDrawerClose()">
      <div class="drawer-in">
        <div class="side-head">
          <a class="brand" routerLink="/admin" (click)="navigated('')">
            <img src="assets/logo/ein-tova-eye-symbol-dark.svg" alt="" width="34" height="31" />
            <span class="lbl">ניהול</span>
          </a>
          <button type="button" class="icon-btn" aria-label="סגירת התפריט" (click)="closeDrawer()">
            <app-icon name="x" />
          </button>
        </div>
        <ng-container *ngTemplateOutlet="navTpl" />
      </div>
    </dialog>

    <main #main id="admin-main" tabindex="-1">
      <div class="page">
        <router-outlet />
      </div>
    </main>
  `,
  styles: `
    :host {
      --admin-nav-w: 0px;
      /* גובה הפס העליון הדביק (רק במסך צר): דברים דביקים בדפים נעצרים מתחתיו */
      --admin-top-h: calc(57px + env(safe-area-inset-top));
      /* צבעי מצב לניהול (תמיד יחד עם טקסט או אייקון). קריאים על רקע חצות וזכוכית */
      --status-ok: #7fd1b0;
      --status-warn: #f0b26b;
      --status-error: #f4a493;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      /* פס עליון בגובה התוכן שלו, והדף ממלא את השאר (גם כשהדף קצר) */
      grid-template-rows: auto 1fr;
      min-height: 100dvh;
      background: var(--bg-app);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      color: var(--color-gold);
      font: 700 20px var(--font-display);
      text-decoration: none;
      img { flex: none; }
    }

    .icon-btn {
      display: grid;
      place-items: center;
      flex: none;
      width: 40px;
      height: 40px;
      border: 1px solid transparent;
      border-radius: 12px;
      background: none;
      color: rgba(248, 243, 234, 0.8);
      cursor: pointer;
      app-icon { width: 20px; height: 20px; }
      &:hover { background: rgba(255, 255, 255, 0.07); color: var(--color-cream); }
    }

    :is(a, button):focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; }

    /* ===== הניווט (משותף לצד ולשכבה) ===== */
    .nav { display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0; }
    .nav ul { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; overflow-y: auto; }
    .nav a, .out {
      position: relative;
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 44px;
      padding: 10px 12px;
      border: 0;
      border-radius: 12px;
      background: none;
      color: rgba(248, 243, 234, 0.82);
      font: 600 15.5px var(--font-body);
      text-decoration: none;
      text-align: start;
      cursor: pointer;
      app-icon { width: 20px; height: 20px; flex: none; }
      .lbl { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      &:hover { background: rgba(255, 255, 255, 0.06); color: var(--color-cream); }
    }
    .nav a.active {
      background: rgba(217, 182, 111, 0.18);
      color: var(--color-gold);
      &::before { content: ''; position: absolute; inset-block: 9px; inset-inline-start: 0; width: 3px; border-radius: 3px; background: var(--color-gold); }
    }
    .out { margin-top: auto; color: rgba(248, 243, 234, 0.65); }

    /* ===== מחשב: תפריט צד ===== */
    .side {
      display: none;
      position: sticky;
      top: 0;
      height: 100dvh;
      flex-direction: column;
      gap: 14px;
      padding: 14px 12px;
      border-radius: 0;
      border-block: 0;
      border-inline-start: 0;
      overflow: hidden;
      &::after { content: none; }
    }
    .side-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-inline: 4px; }

    /* ===== טלפון וטאבלט: פס עליון ===== */
    .top {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      padding-top: calc(8px + env(safe-area-inset-top));
      border-radius: 0;
      border-inline: 0;
      border-top: 0;
      &::after { content: none; }
      .here { margin-inline-start: auto; color: rgba(248, 243, 234, 0.7); font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    }

    .drawer {
      position: fixed;
      inset-block: 0;
      inset-inline-start: 0;
      inset-inline-end: auto;
      width: min(300px, 86vw);
      height: 100dvh;
      max-width: none;
      max-height: none;
      margin: 0;
      padding: 0;
      border: 0;
      background: none;
      color: var(--color-cream);
      &::backdrop { background: rgba(10, 12, 24, 0.6); }
      &[open] { animation: slide-in 0.25s var(--motion-ease-out, ease) both; }
    }
    .drawer-in {
      display: flex;
      flex-direction: column;
      gap: 14px;
      height: 100%;
      padding: 14px 12px calc(14px + env(safe-area-inset-bottom));
      padding-top: calc(14px + env(safe-area-inset-top));
      border-inline-end: 1px solid var(--glass-border);
      background: linear-gradient(180deg, rgba(36, 41, 66, 0.98), rgba(27, 31, 51, 0.98));
      box-shadow: -18px 0 48px rgba(0, 0, 0, 0.45);
    }
    @keyframes slide-in { from { translate: 100% 0; } }

    /* ===== אזור התוכן ===== */
    main { min-width: 0; padding: 24px clamp(16px, 3vw, 40px) 64px; outline: none; }
    .page { max-inline-size: 1720px; margin-inline: auto; }

    @media (min-width: 1024px) {
      :host { --admin-nav-w: 236px; --admin-top-h: 0px; grid-template-columns: var(--admin-nav-w) minmax(0, 1fr); grid-template-rows: 1fr; }
      :host(.collapsed) { --admin-nav-w: 76px; }
      .side { display: flex; }
      .top, .drawer { display: none; }
      main { padding-top: 32px; }

      /* מכווץ: רק אייקונים, השם נשאר לקוראי מסך ומופיע כטיפ בריחוף ובמיקוד */
      :host(.collapsed) {
        .side-head { flex-direction: column; padding: 0; }
        .side .lbl {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip-path: inset(50%);
          white-space: nowrap;
        }
        .side :is(.nav a, .out) { justify-content: center; padding-inline: 0; }
      }
    }

    .tip {
      position: fixed;
      inset-inline-start: calc(var(--admin-nav-w) + 6px);
      z-index: 50;
      translate: 0 -50%;
      padding: 6px 10px;
      border-radius: 8px;
      background: rgba(20, 23, 42, 0.97);
      border: 1px solid rgba(217, 182, 111, 0.35);
      color: var(--color-cream);
      font: 600 13.5px var(--font-body);
      white-space: nowrap;
      pointer-events: none;
    }
    @media (max-width: 1023.98px) { .tip { display: none; } }

    @media (prefers-reduced-motion: reduce) {
      .drawer[open] { animation: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminShell {
  private readonly session = inject(AdminSession);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  protected readonly nav = NAV;
  protected readonly collapsed = signal(readCollapsed());
  protected readonly drawerOpen = signal(false);
  /** שם הדף הנוכחי לפס העליון במסך צר */
  protected readonly current = signal<string | null>(null);

  private readonly drawer = viewChild.required<ElementRef<HTMLDialogElement>>('drawer');
  private readonly menuBtn = viewChild.required<ElementRef<HTMLButtonElement>>('menuBtn');
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  /** נבחר יעד בתפריט: אחרי המעבר המיקוד עובר לכותרת הדף */
  private focusAfterNav = false;
  private closingForNav = false;

  constructor() {
    this.syncRoute();
    const sub = this.router.events.subscribe((e) => {
      // המיקוד עובר רק כשהמעבר באמת הסתיים (גם אם הטעינה איטית), לא לפי טיימר
      if (e instanceof NavigationEnd) {
        this.syncRoute();
        if (this.focusAfterNav) setTimeout(() => this.focusPage());
      } else if (e instanceof NavigationSkipped) {
        if (this.focusAfterNav) setTimeout(() => this.focusPage());
      } else if (e instanceof NavigationError || (e instanceof NavigationCancel && e.code !== NavigationCancellationCode.Redirect)) {
        // מעבר שנכשל או בוטל (לא הפניה): לא ממקדים מאוחר יותר בהפתעה
        this.focusAfterNav = false;
      }
    });

    // מעבר לרוחב מחשב כשהשכבה פתוחה: סוגרים אותה
    const mq = window.matchMedia(DESKTOP);
    const onMq = () => {
      if (mq.matches && this.drawerOpen()) this.closeDrawer();
    };
    mq.addEventListener('change', onMq);

    inject(DestroyRef).onDestroy(() => {
      sub.unsubscribe();
      mq.removeEventListener('change', onMq);
      this.document.documentElement.style.overflow = '';
    });
  }

  /** טיפ בתפריט המכווץ: שם היעד ליד האייקון, בריחוף ובמיקוד מקלדת */
  protected readonly tip = signal<{ text: string; top: number } | null>(null);

  protected showTip(e: Event): void {
    if (!this.collapsed()) return;
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tip]');
    if (!el) {
      this.tip.set(null);
      return;
    }
    const r = el.getBoundingClientRect();
    this.tip.set({ text: el.dataset['tip'] ?? '', top: r.top + r.height / 2 });
  }

  protected toggleCollapsed(): void {
    this.tip.set(null);
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      // בלי אחסון: רק לביקור הנוכחי
    }
  }

  protected openDrawer(): void {
    const d = this.drawer().nativeElement;
    if (d.open) return;
    d.showModal();
    this.drawerOpen.set(true);
    this.document.documentElement.style.overflow = 'hidden';
    // מיקוד על היעד הנוכחי (או הראשון), לא על כפתור הסגירה
    (d.querySelector<HTMLElement>('a.active') ?? d.querySelector<HTMLElement>('.nav a'))?.focus();
  }

  protected closeDrawer(): void {
    const d = this.drawer().nativeElement;
    if (d.open) d.close();
  }

  /** לחיצה על הרקע (מחוץ לחלונית) */
  protected onDrawerClick(e: MouseEvent): void {
    if (e.target === this.drawer().nativeElement) this.closeDrawer();
  }

  protected onDrawerClose(): void {
    this.drawerOpen.set(false);
    this.document.documentElement.style.overflow = '';
    if (this.closingForNav) this.closingForNav = false;
    else this.menuBtn().nativeElement.focus(); // נסגר בלי מעבר: חוזרים לכפתור התפריט
  }

  protected navigated(path: string): void {
    this.focusAfterNav = true;
    if (this.drawer().nativeElement.open) {
      this.closingForNav = true;
      this.closeDrawer();
    }
    // לחיצה על הדף הנוכחי: אין מעבר לחכות לו, ממקדים מיד (אחרי סגירת השכבה)
    const target = this.router.serializeUrl(this.router.createUrlTree(['/admin', ...(path ? [path] : [])]));
    if (target === this.router.url.split(/[?#]/)[0]) setTimeout(() => this.focusPage());
  }

  protected logout(): void {
    this.closeDrawer();
    this.session.logout();
    void this.router.navigateByUrl('/admin/login');
  }

  private focusPage(): void {
    this.focusAfterNav = false;
    const main = this.main().nativeElement;
    const h1 = main.querySelector<HTMLElement>('h1');
    if (h1) {
      h1.tabIndex = -1;
      h1.focus({ preventScroll: true });
    } else {
      main.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0 });
  }

  private syncRoute(): void {
    const url = this.router.url.split(/[?#]/)[0];
    this.current.set(NAV.find((n) => url.startsWith(`/admin/${n.path}`))?.label ?? null);
  }
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}
