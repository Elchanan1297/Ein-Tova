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
import { AdminFamily, AdminGuest, GuestsApi } from '../../data/guests-api';
import { inviteText, personalLink, whatsAppUrl } from '../../data/invite';
import { EyeLoader } from '../../../../shared/ui/eye-loader/eye-loader';

const ERRORS: Record<string, string> = {
  fullName: 'צריך שם (עד 100 תווים).',
  familyId: 'צריך לבחור משפחה.',
  phone: 'מספר הטלפון לא תקין.',
  phoneTaken: 'המספר הזה כבר שייך למוזמן אחר.',
  Duplicate: 'כבר יש משפחה בשם הזה.',
};

/** הוספה/עריכה של מוזמן, כולל משפחה חדשה, קישור אישי וקוד חדש. */
@Component({
  selector: 'app-guest-editor',
  imports: [EyeLoader, Icon],
  templateUrl: './guest-editor.html',
  styleUrl: './guest-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestEditor {
  private readonly api = inject(GuestsApi);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** null = מוזמן חדש */
  readonly guest = input.required<AdminGuest | null>();
  readonly families = input.required<AdminFamily[]>();
  readonly template = input.required<string>();
  readonly saved = output<string>();
  readonly closed = output<void>();
  readonly notice = output<string>();

  protected readonly fullName = linkedSignal(() => this.guest()?.fullName ?? '');
  protected readonly phone = linkedSignal(() => this.guest()?.phone ?? '');
  protected readonly isActive = linkedSignal(() => this.guest()?.isActive ?? true);
  /** מזהה משפחה, או 'new' למשפחה חדשה */
  protected readonly familyId = linkedSignal<number | 'new' | ''>(() => this.guest()?.familyId ?? this.families()[0]?.familyId ?? 'new');
  protected readonly newFamily = signal('');
  protected readonly code = linkedSignal(() => this.guest()?.code ?? null);
  protected readonly confirmNewCode = signal(false);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly link = computed(() => (this.code() ? personalLink(this.code()!) : null));
  protected readonly waUrl = computed(() => {
    const phone = this.guest()?.phone;
    const code = this.code();
    return phone && code ? whatsAppUrl(phone, inviteText(this.template(), this.fullName(), code)) : null;
  });
  protected readonly canSave = computed(
    () => !!this.fullName().trim() && (this.familyId() !== 'new' || !!this.newFamily().trim()) && this.familyId() !== '',
  );

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      let familyId = this.familyId();
      if (familyId === 'new') {
        familyId = (await this.api.saveFamily(null, this.newFamily().trim())).familyId;
        this.familyId.set(familyId); // אם שמירת המוזמן תיכשל, לא ניצור את המשפחה פעמיים
      }
      await this.api.saveGuest({
        guestId: this.guest()?.guestId ?? null,
        familyId: familyId as number,
        fullName: this.fullName().trim(),
        phone: this.phone().trim() || null,
        isActive: this.isActive(),
      });
      this.saved.emit(this.guest() ? 'הפרטים נשמרו.' : `${this.fullName().trim()} נוסף/ה.`);
      this.dialog().nativeElement.close();
    } catch (e) {
      const err = e instanceof HttpErrorResponse ? e.error : null;
      this.error.set(ERRORS[err?.field ?? err?.status] ?? 'השמירה נכשלה. נסו שוב.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async newCode(): Promise<void> {
    const g = this.guest();
    if (!g) return;
    if (!this.confirmNewCode()) {
      this.confirmNewCode.set(true);
      return;
    }
    this.confirmNewCode.set(false);
    try {
      this.code.set((await this.api.newCode(g.guestId)).code);
      this.notice.emit('נוצר קוד חדש. הקישור הקודם כבר לא עובד.');
    } catch {
      this.error.set('יצירת קוד חדש נכשלה.');
    }
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.link()!);
      this.notice.emit('הקישור הועתק.');
    } catch {
      this.error.set('ההעתקה נכשלה.');
    }
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }
}
