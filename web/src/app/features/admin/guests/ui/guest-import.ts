import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';
import { GuestImportRow, GuestsApi } from '../../data/guests-api';
import { parseTable, readTextFile, toCsv } from '../../data/table-text';

const HEADER = ['שם', 'משפחה', 'טלפון'];

const FIELD_ERRORS: Record<string, string> = {
  fullName: 'חסר שם',
  family: 'חסרה משפחה',
  phone: 'טלפון לא תקין',
  phoneTaken: 'הטלפון כבר קיים',
};

interface ParsedRow {
  line: number;
  row: GuestImportRow;
  problem: string | null;
}

/** ייבוא מוזמנים מאקסל: שם | משפחה | טלפון. משפחות חדשות נוצרות לבד. */
@Component({
  selector: 'app-guest-import',
  imports: [Icon],
  templateUrl: './guest-import.html',
  styleUrl: '../../questions/ui/question-import.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestImport {
  private readonly api = inject(GuestsApi);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly imported = output<string>();
  readonly closed = output<void>();

  protected readonly header = HEADER;
  protected readonly text = signal('');
  protected readonly busy = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly rows = computed<ParsedRow[]>(() => {
    const table = parseTable(this.text());
    const start = table.length && /^שם|name/i.test(table[0][0] ?? '') ? 1 : 0;
    const seen = new Set<string>();
    return table.slice(start).map((cells, i) => {
      const [fullName = '', family = '', phone = ''] = cells;
      const digits = phone.replace(/\D/g, '').replace(/^972/, '0');
      const problem = !fullName
        ? FIELD_ERRORS['fullName']
        : !family
          ? FIELD_ERRORS['family']
          : phone && !/^0\d{8,9}$/.test(digits)
            ? FIELD_ERRORS['phone']
            : phone && seen.has(digits)
              ? 'הטלפון מופיע פעמיים'
              : null;
      if (digits) seen.add(digits);
      return { line: i + 1 + start, problem, row: { fullName, family, phone: phone || null } };
    });
  });
  protected readonly problems = computed(() => this.rows().filter((r) => r.problem).length);
  protected readonly familyCount = computed(() => new Set(this.rows().map((r) => r.row.family)).size);

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  protected async pickFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.text.set(await readTextFile(file));
  }

  protected downloadTemplate(): void {
    const url = URL.createObjectURL(toCsv([HEADER, ['דנה כהן', 'משפחת כהן', '050-1234567']]));
    Object.assign(document.createElement('a'), { href: url, download: 'מוזמנים-תבנית.csv' }).click();
    URL.revokeObjectURL(url);
  }

  protected async import(): Promise<void> {
    const rows = this.rows();
    if (!rows.length || this.problems()) return;
    this.busy.set(true);
    this.serverError.set(null);
    try {
      const res = await this.api.import(rows.map((r) => r.row));
      this.dialog().nativeElement.close();
      const families = res.newFamilies === 1 ? ' ומשפחה חדשה אחת' : res.newFamilies ? ` ו־${res.newFamilies} משפחות חדשות` : '';
      this.imported.emit(`יובאו ${res.imported} מוזמנים${families}.`);
    } catch (e) {
      const err = e instanceof HttpErrorResponse ? e.error : null;
      this.serverError.set(
        err?.badRow ? `שורה ${rows[err.badRow - 1]?.line ?? err.badRow}: ${FIELD_ERRORS[err.field] ?? 'לא תקינה'}.` : 'הייבוא נכשל. נסו שוב.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }
}
