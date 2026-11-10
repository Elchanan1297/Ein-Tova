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
import { youTubeId } from '../../../../shared/util/youtube';
import { AdminGreeting, ContentApi, uploadError } from '../../data/content-api';
import { EyeLoader } from '../../../../shared/ui/eye-loader/eye-loader';

const ERRORS: Record<string, string> = {
  senderName: 'צריך שם של מי ששולח.',
  body: 'צריך טקסט לברכה (עד 2000 תווים).',
  mediaUrl: 'חסרה תמונה או קישור לסרטון.',
};

/** עריכת ברכה: טקסט, תמונה (מועלית ומוקטנת ל־WebP בשרת) או סרטון YouTube. */
@Component({
  selector: 'app-greeting-editor',
  imports: [EyeLoader, Icon],
  templateUrl: './greeting-editor.html',
  styleUrl: './greeting-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GreetingEditor {
  private readonly api = inject(ContentApi);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly greeting = input.required<AdminGreeting | null>();
  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly senderName = linkedSignal(() => this.greeting()?.senderName ?? '');
  protected readonly relation = linkedSignal(() => this.greeting()?.relation ?? '');
  protected readonly kind = linkedSignal<AdminGreeting['kind']>(() => this.greeting()?.kind ?? 'image');
  protected readonly body = linkedSignal(() => this.greeting()?.body ?? '');
  protected readonly imageUrl = linkedSignal(() => (this.greeting()?.kind === 'image' ? this.greeting()!.mediaUrl ?? '' : ''));
  protected readonly videoUrl = linkedSignal(() => (this.greeting()?.kind === 'video' ? this.greeting()!.mediaUrl ?? '' : ''));
  protected readonly isActive = linkedSignal(() => this.greeting()?.isActive ?? true);

  protected readonly uploading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly videoId = computed(() => youTubeId(this.videoUrl()));
  protected readonly canSave = computed(() => {
    if (!this.senderName().trim() || this.uploading()) return false;
    switch (this.kind()) {
      case 'text': return !!this.body().trim();
      case 'image': return !!this.imageUrl();
      case 'video': return !!this.videoId();
    }
  });

  protected readonly kinds = [
    ['image', 'תמונה'],
    ['video', 'סרטון'],
    ['text', 'טקסט'],
  ] as const;

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  protected async pickImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploading.set(true);
    this.error.set(null);
    try {
      this.imageUrl.set(await this.api.uploadImage(file));
    } catch (e) {
      this.error.set(uploadError(e instanceof HttpErrorResponse ? e.error?.status : undefined));
    } finally {
      this.uploading.set(false);
    }
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) return;
    this.busy.set(true);
    this.error.set(null);
    const kind = this.kind();
    try {
      await this.api.save('greetings', {
        greetingId: this.greeting()?.greetingId ?? null,
        senderName: this.senderName().trim(),
        relation: this.relation().trim() || null,
        kind,
        body: this.body().trim() || null,
        mediaUrl: kind === 'image' ? this.imageUrl() : kind === 'video' ? this.videoUrl().trim() : null,
        isActive: this.isActive(),
      });
      this.saved.emit();
      this.dialog().nativeElement.close();
    } catch (e) {
      const field = e instanceof HttpErrorResponse ? e.error?.field : null;
      this.error.set(ERRORS[field] ?? 'השמירה נכשלה. נסו שוב.');
    } finally {
      this.busy.set(false);
    }
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }
}
