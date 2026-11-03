import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { AdminSession } from '../../core/auth/admin-session';
import { AdminGreeting, AdminVoiceClip, ContentApi } from '../admin/data/content-api';
import { Leaderboard } from '../leaderboard/data/leaderboard-models';
import { ShowState } from './data/show-api';

/**
 * מצב המסך הגדול: חיבור SignalR שמקבל את הסצנה ואת לוח התוצאות.
 * מסופק ברמת הדף; החיבור נסגר כשיוצאים.
 */
@Injectable()
export class ShowStore {
  private readonly content = inject(ContentApi);

  readonly state = signal<ShowState | null>(null);
  readonly board = signal<Leaderboard | null>(null);
  readonly greetings = signal<AdminGreeting[]>([]);
  readonly connected = signal(false);
  readonly scene = computed(() => this.state()?.scene ?? 'welcome');

  private winnerClips: AdminVoiceClip[] = [];
  private destroyed = false;
  private readonly hub: HubConnection;

  constructor() {
    const session = inject(AdminSession);
    this.hub = new HubConnectionBuilder()
      .withUrl('/hubs/show', { accessTokenFactory: () => session.token() ?? '' })
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: () => 3000 }) // באולם: מנסים שוב לנצח
      .build();
    this.hub.on('state', (s: ShowState) => this.state.set(s));
    this.hub.on('leaderboard', (b: Leaderboard) => this.board.set(b));
    this.hub.onreconnecting(() => this.connected.set(false));
    this.hub.onreconnected(() => this.connected.set(true));
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      void this.hub.stop();
    });

    void this.connect();
    void this.loadContent();
  }

  /** קליפ אקראי לזוכה, אם יש */
  randomWinnerClip(): AdminVoiceClip | null {
    const clips = this.winnerClips;
    return clips.length ? clips[Math.floor(Math.random() * clips.length)] : null;
  }

  private async connect(): Promise<void> {
    while (!this.destroyed && this.hub.state === HubConnectionState.Disconnected) {
      try {
        await this.hub.start();
        this.connected.set(true);
      } catch {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  private async loadContent(): Promise<void> {
    try {
      const [greetings, voices] = await Promise.all([
        this.content.list<AdminGreeting>('greetings'),
        this.content.list<AdminVoiceClip>('voices'),
      ]);
      this.greetings.set(greetings.filter((g) => g.isActive));
      this.winnerClips = voices.filter((v) => v.eventType === 'Winner' && v.isActive);
    } catch {
      // בלי ברכות/קליפים המצגת עדיין עובדת
    }
  }
}
