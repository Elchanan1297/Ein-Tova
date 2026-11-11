import { DOCUMENT, DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

/** מצב האפליקציה המותקנת: האם יש רשת, והאם ירדה גרסה חדשה שמחכה לרענון. */
@Injectable({ providedIn: 'root' })
export class AppStatus {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView!;

  readonly online = signal(this.window.navigator.onLine);
  readonly updateReady = signal(false);

  constructor() {
    const setOnline = () => this.online.set(this.window.navigator.onLine);
    this.window.addEventListener('online', setOnline);
    this.window.addEventListener('offline', setOnline);
    inject(DestroyRef).onDestroy(() => {
      this.window.removeEventListener('online', setOnline);
      this.window.removeEventListener('offline', setOnline);
    });

    const sw = inject(SwUpdate);
    if (sw.isEnabled) {
      // בעלייה: לבדוק מיד אם יש גרסה חדשה (משתמשים עם האפליקציה המותקנת)
      sw.checkForUpdate().catch(() => undefined);
      sw.versionUpdates
        .pipe(
          filter((e) => e.type === 'VERSION_READY'),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.updateReady.set(true));
    }
  }

  /** רענון ידני בלבד, כדי לא לקטוע מישהו באמצע שאלה */
  applyUpdate(): void {
    this.document.location.reload();
  }
}
