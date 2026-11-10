import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Icon } from '../../../shared/ui/icon/icon';
import { AdminQuestion, QuestionsApi } from '../data/questions-api';
import { QuestionEditor } from './ui/question-editor';
import { QuestionImport } from './ui/question-import';
import { EyeLoader } from '../../../shared/ui/eye-loader/eye-loader';

/** רשימת השאלות: גרירה לשינוי סדר, עריכה, השבתה/מחיקה, ייבוא. */
@Component({
  selector: 'app-questions-page',
  imports: [EyeLoader, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder, Icon, QuestionEditor, QuestionImport],
  templateUrl: './questions-page.html',
  styleUrl: './questions-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class QuestionsPage {
  private readonly api = inject(QuestionsApi);

  protected readonly questions = signal<AdminQuestion[] | null>(null);
  protected readonly loadFailed = signal(false);
  /** null = סגור, 'new' = שאלה חדשה, אחרת השאלה בעריכה */
  protected readonly editing = signal<AdminQuestion | 'new' | null>(null);
  protected readonly importing = signal(false);
  protected readonly confirmDelete = signal<number | null>(null);
  protected readonly notice = signal<{ ok: boolean; text: string } | null>(null);

  protected readonly activeCount = computed(() => this.questions()?.filter((q) => q.isActive).length ?? 0);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    try {
      this.questions.set(await this.api.list());
      this.loadFailed.set(false);
    } catch {
      this.loadFailed.set(true);
    }
  }

  protected correctOf(q: AdminQuestion): string {
    return q.options.find((o) => o.isCorrect)?.body ?? '';
  }

  protected async drop(event: CdkDragDrop<AdminQuestion[]>): Promise<void> {
    const list = this.questions();
    if (!list || event.previousIndex === event.currentIndex) return;
    const next = [...list];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.questions.set(next); // מיד על המסך, ושמירה ברקע
    try {
      await this.api.reorder(next.map((q) => q.questionId));
    } catch {
      this.say(false, 'שמירת הסדר נכשלה.');
      await this.load();
    }
  }

  protected async remove(q: AdminQuestion): Promise<void> {
    if (this.confirmDelete() !== q.questionId) {
      this.confirmDelete.set(q.questionId);
      return;
    }
    this.confirmDelete.set(null);
    try {
      await this.api.remove(q.questionId);
      this.questions.update((list) => list?.filter((x) => x.questionId !== q.questionId) ?? null);
      this.say(true, 'השאלה נמחקה.');
    } catch (e) {
      const inUse = e instanceof HttpErrorResponse && e.error?.status === 'InUse';
      this.say(false, inUse ? 'אי אפשר למחוק שאלה שכבר נענתה. אפשר להשבית אותה.' : 'המחיקה נכשלה.');
    }
  }

  /** השבתה/הפעלה מהירה מהרשימה */
  protected async toggleActive(q: AdminQuestion): Promise<void> {
    try {
      await this.api.save({ ...q, isActive: !q.isActive });
      this.questions.update((list) => list?.map((x) => (x.questionId === q.questionId ? { ...x, isActive: !x.isActive } : x)) ?? null);
    } catch {
      this.say(false, 'השמירה נכשלה.');
    }
  }

  protected async onSaved(): Promise<void> {
    this.editing.set(null);
    this.say(true, 'השאלה נשמרה.');
    await this.load();
  }

  protected async onImported(count: number): Promise<void> {
    this.importing.set(false);
    this.say(true, `יובאו ${count} שאלות.`);
    await this.load();
  }

  private say(ok: boolean, text: string): void {
    this.notice.set({ ok, text });
    setTimeout(() => this.notice.set(null), 3500);
  }
}
