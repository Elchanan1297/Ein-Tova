import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Icon, IconName } from '../../../../shared/ui/icon/icon';
import { AdminProgramItem, ContentApi } from '../../data/content-api';

/** אייקונים לתוכנית: הערך נשמר ב־DB, והאפליקציה ממפה אותו לאייקון */
const ICONS: { value: string; icon: IconName; label: string }[] = [
  { value: 'door', icon: 'door', label: 'כניסה' },
  { value: 'mic', icon: 'mic', label: 'מיקרופון' },
  { value: 'spark', icon: 'sparkles', label: 'משחק' },
  { value: 'film', icon: 'film', label: 'סרט' },
  { value: 'gift', icon: 'gift', label: 'מתנה' },
  { value: 'clock', icon: 'clock', label: 'שעון' },
];

const ERRORS: Record<string, string> = {
  timeText: 'שעה בפורמט 19:30.',
  title: 'צריך שם לפריט.',
};

/** תוכנית הערב: עריכה בשורה. הסדר נקבע לפי השעה. */
@Component({
  selector: 'app-program-admin',
  imports: [Icon],
  templateUrl: './program-admin.html',
  styleUrl: './program-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ProgramAdmin {
  private readonly api = inject(ContentApi);

  protected readonly icons = ICONS;
  protected readonly items = signal<AdminProgramItem[] | null>(null);
  /** שורות שהשתנו ועוד לא נשמרו (לפי אינדקס) */
  protected readonly dirty = signal<Set<number>>(new Set());
  protected readonly errors = signal<Record<number, string>>({});
  protected readonly confirmDelete = signal<number | null>(null);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.items.set(await this.api.list<AdminProgramItem>('program'));
    this.dirty.set(new Set());
    this.errors.set({});
  }

  protected iconOf(value: string | null): IconName {
    return ICONS.find((i) => i.value === value)?.icon ?? 'clock';
  }

  protected edit<K extends keyof AdminProgramItem>(index: number, key: K, value: AdminProgramItem[K]): void {
    this.items.update((list) => list?.map((it, i) => (i === index ? { ...it, [key]: value } : it)) ?? null);
    this.dirty.update((s) => new Set(s).add(index));
  }

  protected add(): void {
    this.items.update((list) => [...(list ?? []), { itemId: null, timeText: '', title: '', icon: 'clock', isActive: true }]);
    this.dirty.update((s) => new Set(s).add((this.items()?.length ?? 1) - 1));
  }

  protected async save(index: number): Promise<void> {
    const item = this.items()?.[index];
    if (!item) return;
    try {
      await this.api.save('program', item);
      await this.load(); // השרת מסדר לפי שעה
    } catch (e) {
      const field = e instanceof HttpErrorResponse ? e.error?.field : null;
      this.errors.update((m) => ({ ...m, [index]: ERRORS[field] ?? 'השמירה נכשלה.' }));
    }
  }

  protected async remove(index: number): Promise<void> {
    const item = this.items()?.[index];
    if (!item) return;
    if (item.itemId === null) {
      this.items.update((list) => list?.filter((_, i) => i !== index) ?? null);
      return;
    }
    if (this.confirmDelete() !== item.itemId) {
      this.confirmDelete.set(item.itemId);
      return;
    }
    this.confirmDelete.set(null);
    await this.api.remove('program', item.itemId);
    await this.load();
  }
}
