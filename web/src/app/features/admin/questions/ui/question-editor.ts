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
import { ConfigStore } from '../../../../core/config/config-store';
import { Icon } from '../../../../shared/ui/icon/icon';
import { AdminError, AdminQuestion, QuestionsApi } from '../../data/questions-api';
import { EyeLoader } from '../../../../shared/ui/eye-loader/eye-loader';

interface OptionDraft {
  optionId: number | null;
  body: string;
}

const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
const MAX_OPTIONS = 6;

const ERRORS: Record<string, string> = {
  body: 'צריך לכתוב את השאלה (עד 500 תווים).',
  options: 'צריך 2 עד 6 תשובות, וכולן מלאות.',
  correct: 'צריך לסמן תשובה נכונה אחת.',
  timeLimitSec: 'זמן לשאלה: 5 עד 300 שניות, או ריק.',
  fact: 'העובדה ארוכה מדי (עד 600 תווים).',
};

/** עריכת שאלה בחלון, עם תצוגה מקדימה כמו בטלפון. */
@Component({
  selector: 'app-question-editor',
  imports: [EyeLoader, Icon],
  templateUrl: './question-editor.html',
  styleUrl: './question-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionEditor {
  private readonly api = inject(QuestionsApi);
  private readonly config = inject(ConfigStore).config;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** null = שאלה חדשה */
  readonly question = input.required<AdminQuestion | null>();
  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly letters = LETTERS;
  protected readonly maxOptions = MAX_OPTIONS;

  protected readonly body = linkedSignal(() => this.question()?.body ?? '');
  protected readonly fact = linkedSignal(() => this.question()?.fact ?? '');
  protected readonly imageUrl = linkedSignal(() => this.question()?.imageUrl ?? '');
  protected readonly timeLimit = linkedSignal(() => this.question()?.timeLimitSec?.toString() ?? '');
  protected readonly isActive = linkedSignal(() => this.question()?.isActive ?? true);
  protected readonly options = linkedSignal<OptionDraft[]>(() =>
    this.question()?.options.map((o) => ({ optionId: o.optionId, body: o.body })) ??
    [0, 1, 2, 3].map(() => ({ optionId: null, body: '' })),
  );
  protected readonly correct = linkedSignal(() => Math.max(0, this.question()?.options.findIndex((o) => o.isCorrect) ?? 0));

  protected readonly busy = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly showAnswer = signal(false);

  /** בדיקה מקומית לפני שליחה (אותם כללים כמו בשרת) */
  protected readonly error = computed<string | null>(() => {
    const limit = this.timeLimit().trim();
    if (!this.body().trim() || this.body().length > 500) return ERRORS['body'];
    const opts = this.options();
    if (opts.length < 2 || opts.some((o) => !o.body.trim() || o.body.length > 200)) return ERRORS['options'];
    if (limit && (!/^\d+$/.test(limit) || +limit < 5 || +limit > 300)) return ERRORS['timeLimitSec'];
    if (this.fact().length > 600) return ERRORS['fact'];
    return null;
  });

  protected readonly previewSeconds = computed(() => +this.timeLimit() || this.config()?.secondsPerQuestion || 20);

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  protected setOption(i: number, body: string): void {
    this.options.update((list) => list.map((o, j) => (j === i ? { ...o, body } : o)));
  }

  protected addOption(): void {
    this.options.update((list) => (list.length < MAX_OPTIONS ? [...list, { optionId: null, body: '' }] : list));
  }

  protected removeOption(i: number): void {
    if (this.options().length <= 2) return;
    this.options.update((list) => list.filter((_, j) => j !== i));
    // התשובה הנכונה זזה עם המחיקה
    this.correct.update((c) => (c === i ? 0 : c > i ? c - 1 : c));
  }

  protected async save(): Promise<void> {
    if (this.error()) return;
    this.busy.set(true);
    this.serverError.set(null);
    try {
      await this.api.save({
        questionId: this.question()?.questionId ?? null,
        body: this.body().trim(),
        imageUrl: this.imageUrl().trim() || null,
        fact: this.fact().trim() || null,
        timeLimitSec: this.timeLimit().trim() ? +this.timeLimit() : null,
        isActive: this.isActive(),
        options: this.options().map((o, i) => ({ optionId: o.optionId, body: o.body.trim(), isCorrect: i === this.correct() })),
      });
      this.saved.emit();
    } catch (e) {
      const err = e instanceof HttpErrorResponse ? (e.error as AdminError) : null;
      this.serverError.set((err?.field && ERRORS[err.field]) || 'השמירה נכשלה. נסו שוב.');
    } finally {
      this.busy.set(false);
    }
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }
}
