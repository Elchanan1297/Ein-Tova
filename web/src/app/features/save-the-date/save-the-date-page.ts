import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LockStore } from '../../core/save-the-date/lock-store';
import { SaveTheDateScreen } from './ui/save-the-date-screen';

/** /save-the-date: מה שמוזמנים רואים בזמן נעילה. אין כאן ניווט ואין כניסה. */
@Component({
  selector: 'app-save-the-date-page',
  imports: [SaveTheDateScreen],
  template: `
    @if (lock.info(); as info) {
      <app-save-the-date-screen [info]="info" [clockOffset]="lock.clockOffset()" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SaveTheDatePage {
  protected readonly lock = inject(LockStore);
}
