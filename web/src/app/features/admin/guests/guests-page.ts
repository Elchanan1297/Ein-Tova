import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Icon } from '../../../shared/ui/icon/icon';
import { AdminFamily, AdminGuest, GuestsApi } from '../data/guests-api';
import { DEFAULT_TEMPLATE, inviteText, personalLink, readTemplate, saveTemplate, whatsAppUrl } from '../data/invite';
import { toCsv } from '../data/table-text';
import { GuestEditor } from './ui/guest-editor';
import { GuestImport } from './ui/guest-import';
import { EyeLoader } from '../../../shared/ui/eye-loader/eye-loader';

interface FamilyGroup {
  family: AdminFamily;
  guests: AdminGuest[];
}

/** מוזמנים לפי משפחות: קישור אישי, וואטסאפ, איפוס משחק, קוד חדש, ייבוא. */
@Component({
  selector: 'app-guests-page',
  imports: [EyeLoader, Icon, GuestEditor, GuestImport],
  templateUrl: './guests-page.html',
  styleUrl: './guests-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class GuestsPage {
  private readonly api = inject(GuestsApi);

  protected readonly data = signal<{ families: AdminFamily[]; guests: AdminGuest[] } | null>(null);
  protected readonly loadFailed = signal(false);
  protected readonly search = signal('');
  protected readonly editing = signal<AdminGuest | 'new' | null>(null);
  protected readonly importing = signal(false);
  /** אישור לפעולה מסוכנת: "reset-12", "delete-12", "family-3" */
  protected readonly confirming = signal<string | null>(null);
  protected readonly renaming = signal<number | null>(null);
  protected readonly notice = signal<{ ok: boolean; text: string } | null>(null);
  protected readonly template = signal(readTemplate());

  protected readonly groups = computed<FamilyGroup[]>(() => {
    const d = this.data();
    if (!d) return [];
    const q = this.search().trim();
    const match = (g: AdminGuest) => !q || g.fullName.includes(q) || (g.phone ?? '').includes(q.replace(/\D/g, '') || q);
    return d.families
      .map((family) => ({ family, guests: d.guests.filter((g) => g.familyId === family.familyId && match(g)) }))
      .filter((grp) => !q || grp.guests.length);
  });

  protected readonly counts = computed(() => {
    const guests = this.data()?.guests ?? [];
    return {
      total: guests.length,
      seen: guests.filter((g) => g.lastSeenAt).length,
      finished: guests.filter((g) => g.gameState === 'Finished').length,
    };
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    try {
      this.data.set(await this.api.list());
      this.loadFailed.set(false);
    } catch {
      this.loadFailed.set(true);
    }
  }

  protected whatsApp(g: AdminGuest): string {
    return whatsAppUrl(g.phone!, inviteText(this.template(), g.fullName, g.code));
  }

  protected async copyLink(g: AdminGuest): Promise<void> {
    try {
      await navigator.clipboard.writeText(personalLink(g.code));
      this.say(true, `הקישור של ${g.fullName} הועתק.`);
    } catch {
      this.say(false, 'ההעתקה נכשלה.');
    }
  }

  protected setTemplate(text: string): void {
    this.template.set(text);
    saveTemplate(text);
  }

  protected resetTemplate(): void {
    this.setTemplate(DEFAULT_TEMPLATE);
  }

  /** לחיצה ראשונה מבקשת אישור, שנייה מבצעת */
  private confirmed(key: string): boolean {
    if (this.confirming() === key) {
      this.confirming.set(null);
      return true;
    }
    this.confirming.set(key);
    return false;
  }

  protected async reset(g: AdminGuest): Promise<void> {
    if (!this.confirmed(`reset-${g.guestId}`)) return;
    await this.act(() => this.api.resetAttempt(g.guestId), `המשחק של ${g.fullName} אופס. אפשר לשחק מחדש.`);
  }

  protected async remove(g: AdminGuest): Promise<void> {
    if (!this.confirmed(`delete-${g.guestId}`)) return;
    await this.act(() => this.api.deleteGuest(g.guestId), `${g.fullName} נמחק/ה.`, {
      InUse: 'אי אפשר למחוק מי שכבר שיחק. אפשר לאפס קודם, או להשבית בעריכה.',
    });
  }

  protected async renameFamily(f: AdminFamily, name: string): Promise<void> {
    if (this.renaming() !== f.familyId) return; // Enter ואז blur: רק פעם אחת
    this.renaming.set(null);
    if (!name.trim() || name.trim() === f.name) return;
    await this.act(() => this.api.saveFamily(f.familyId, name), 'שם המשפחה עודכן.', { Duplicate: 'כבר יש משפחה בשם הזה.' });
  }

  protected async removeFamily(f: AdminFamily): Promise<void> {
    if (!this.confirmed(`family-${f.familyId}`)) return;
    await this.act(() => this.api.deleteFamily(f.familyId), 'המשפחה נמחקה.', { HasGuests: 'יש במשפחה מוזמנים.' });
  }

  protected exportLinks(): void {
    const d = this.data();
    if (!d) return;
    const family = new Map(d.families.map((f) => [f.familyId, f.name]));
    const rows = [['שם', 'משפחה', 'טלפון', 'קישור אישי'], ...d.guests.map((g) => [g.fullName, family.get(g.familyId) ?? '', g.phone ?? '', personalLink(g.code)])];
    const url = URL.createObjectURL(toCsv(rows));
    Object.assign(document.createElement('a'), { href: url, download: 'קישורים-אישיים.csv' }).click();
    URL.revokeObjectURL(url);
  }

  protected async onSaved(text: string): Promise<void> {
    this.editing.set(null);
    this.say(true, text);
    await this.load();
  }

  protected lastSeen(g: AdminGuest): string {
    if (!g.lastSeenAt) return 'עוד לא נכנס/ה';
    const d = new Date(g.lastSeenAt.endsWith('Z') ? g.lastSeenAt : g.lastSeenAt + 'Z');
    return 'נכנס/ה ' + d.toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  private async act(run: () => Promise<unknown>, okText: string, errors: Record<string, string> = {}): Promise<void> {
    try {
      await run();
      this.say(true, okText);
      await this.load();
    } catch (e) {
      const status = e instanceof HttpErrorResponse ? (e.error?.status as string) : '';
      this.say(false, errors[status] ?? 'הפעולה נכשלה.');
    }
  }

  protected say(ok: boolean, text: string): void {
    this.notice.set({ ok, text });
    setTimeout(() => this.notice.set(null), 3500);
  }
}
