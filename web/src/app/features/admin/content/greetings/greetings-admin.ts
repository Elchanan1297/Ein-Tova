import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';
import { youTubeId } from '../../../../shared/util/youtube';
import { AdminGreeting, ContentApi } from '../../data/content-api';
import { GreetingEditor } from './greeting-editor';

/** ברכות: רשימה בסדר הפיד (גרירה), עריכה ומחיקה. */
@Component({
  selector: 'app-greetings-admin',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, Icon, GreetingEditor],
  templateUrl: './greetings-admin.html',
  styleUrl: './greetings-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class GreetingsAdmin {
  private readonly api = inject(ContentApi);

  protected readonly items = signal<AdminGreeting[] | null>(null);
  protected readonly editing = signal<AdminGreeting | 'new' | null>(null);
  protected readonly confirmDelete = signal<number | null>(null);
  protected readonly notice = signal<{ ok: boolean; text: string } | null>(null);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    try {
      this.items.set(await this.api.list<AdminGreeting>('greetings'));
    } catch {
      this.say(false, 'לא הצלחנו לטעון את הברכות.');
    }
  }

  protected thumb(g: AdminGreeting): string | null {
    if (g.kind === 'image') return g.mediaUrl?.replace(/-1280\.webp$/, '-640.webp') ?? null;
    const id = g.kind === 'video' ? youTubeId(g.mediaUrl) : null;
    return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null;
  }

  protected async drop(e: CdkDragDrop<AdminGreeting[]>): Promise<void> {
    const list = this.items();
    if (!list || e.previousIndex === e.currentIndex) return;
    const next = [...list];
    moveItemInArray(next, e.previousIndex, e.currentIndex);
    this.items.set(next);
    try {
      await this.api.reorderGreetings(next.map((g) => g.greetingId!));
    } catch {
      this.say(false, 'שמירת הסדר נכשלה.');
      await this.load();
    }
  }

  protected async remove(g: AdminGreeting): Promise<void> {
    if (this.confirmDelete() !== g.greetingId) {
      this.confirmDelete.set(g.greetingId);
      return;
    }
    this.confirmDelete.set(null);
    try {
      await this.api.remove('greetings', g.greetingId!);
      this.say(true, 'הברכה נמחקה.');
      await this.load();
    } catch {
      this.say(false, 'המחיקה נכשלה.');
    }
  }

  protected async onSaved(): Promise<void> {
    this.editing.set(null);
    this.say(true, 'הברכה נשמרה.');
    await this.load();
  }

  private say(ok: boolean, text: string): void {
    this.notice.set({ ok, text });
    setTimeout(() => this.notice.set(null), 3500);
  }
}
