import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, booleanAttribute, inject, input, signal } from '@angular/core';

/**
 * ספינר "העין": העין של הלוגו מצמצת (CSS בלבד, `styles/eye-loader.css`).
 * להציג עם `@if` ולא להחליף את ה־DOM בזמן שהוא מוצג, כדי שהמצמוץ לא יקפוץ.
 */
@Component({
  selector: 'app-eye-loader',
  template: `
    @if (visible()) {
      @if (fullscreen()) {
        <div class="eye-loader-screen">
          <span class="eye-loader" [class.eye-loader--light]="variant() === 'light'" [style.--eye-size.px]="size()"
                role="status" [attr.aria-label]="label()"></span>
          <p>{{ label() }}</p>
        </div>
      } @else {
        <span class="eye-loader" [class.eye-loader--light]="variant() === 'light'" [style.--eye-size.px]="size()"
              role="status" [attr.aria-label]="label()"></span>
      }
    }
  `,
  styles: `:host { display: contents; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EyeLoader implements OnInit {
  readonly size = input(96);
  readonly variant = input<'dark' | 'light'>('dark');
  readonly label = input('טוען');
  readonly fullscreen = input(false, { transform: booleanAttribute });
  /** להציג רק אם הטעינה נמשכת יותר מזה (מ״ש), כדי שבקשות מהירות לא יהבהבו */
  readonly delay = input(0);

  protected readonly visible = signal(true);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    if (this.delay() <= 0) return;
    this.visible.set(false);
    const t = setTimeout(() => this.visible.set(true), this.delay());
    this.destroyRef.onDestroy(() => clearTimeout(t));
  }
}
