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
import { AdminError, ImportRow, QuestionsApi } from '../../data/questions-api';
import { parseTable, readTextFile, toCsv } from '../../data/table-text';

/** עמודות: שאלה | תשובה נכונה | שגויה 1 | שגויה 2 | שגויה 3 | עובדה | שניות */
const HEADER = ['שאלה', 'תשובה נכונה', 'תשובה שגויה 1', 'תשובה שגויה 2', 'תשובה שגויה 3', 'עובדה', 'שניות'];

interface ParsedRow {
  line: number;
  row: ImportRow;
  problem: string | null;
}

/** ייבוא שאלות: הדבקה מאקסל או קובץ CSV, תצוגה מקדימה, ואז ייבוא הכול או כלום. */
@Component({
  selector: 'app-question-import',
  imports: [Icon],
  templateUrl: './question-import.html',
  styleUrl: './question-import.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionImport {
  private readonly api = inject(QuestionsApi);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly imported = output<number>();
  readonly closed = output<void>();

  protected readonly header = HEADER;
  protected readonly text = signal('');
  protected readonly busy = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly rows = computed<ParsedRow[]>(() => {
    const table = parseTable(this.text());
    // שורת כותרת (מהתבנית) לא נחשבת
    const start = table.length && /שאלה|question/i.test(table[0][0] ?? '') ? 1 : 0;
    return table.slice(start).map((cells, i) => toRow(cells, i + 1 + start));
  });
  protected readonly problems = computed(() => this.rows().filter((r) => r.problem).length);

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  protected async pickFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.text.set(await readTextFile(file));
  }

  protected downloadTemplate(): void {
    const example = ['איפה אבא נולד?', 'בירושלים', 'בתל אביב', 'בחיפה', 'בבאר שבע', 'אבא נולד בשכונת נחלאות', ''];
    const url = URL.createObjectURL(toCsv([HEADER, example]));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'שאלות-תבנית.csv' });
    a.click();
    URL.revokeObjectURL(url);
  }

  protected async import(): Promise<void> {
    const rows = this.rows();
    if (!rows.length || this.problems()) return;
    this.busy.set(true);
    this.serverError.set(null);
    try {
      const res = await this.api.import(rows.map((r) => r.row));
      this.imported.emit(res.imported);
      this.dialog().nativeElement.close();
    } catch (e) {
      const err = e instanceof HttpErrorResponse ? (e.error as AdminError) : null;
      this.serverError.set(err?.badRow ? `שורה ${rows[err.badRow - 1]?.line ?? err.badRow} לא תקינה.` : 'הייבוא נכשל. נסו שוב.');
    } finally {
      this.busy.set(false);
    }
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }
}

function toRow(cells: string[], line: number): ParsedRow {
  const [body = '', correct = '', w1 = '', w2 = '', w3 = '', fact = '', seconds = ''] = cells;
  const wrong = [w1, w2, w3].filter(Boolean);
  const secs = seconds ? Number(seconds) : null;
  const problem = !body
    ? 'חסרה שאלה'
    : !correct
      ? 'חסרה תשובה נכונה'
      : !wrong.length
        ? 'צריך לפחות תשובה שגויה אחת'
        : secs !== null && (!Number.isInteger(secs) || secs < 5 || secs > 300)
          ? 'שניות: 5 עד 300'
          : body.length > 500 || [correct, ...wrong].some((x) => x.length > 200) || fact.length > 600
            ? 'טקסט ארוך מדי'
            : null;
  return { line, problem, row: { body, correct, wrong, fact: fact || null, timeLimitSec: secs } };
}
