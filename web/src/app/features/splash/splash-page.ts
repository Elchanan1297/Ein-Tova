import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { VoicePlayer } from '../../core/audio/voice-player';
import { AuthStore } from '../../core/auth/auth-store';
import { ConfigStore } from '../../core/config/config-store';
import { Icon } from '../../shared/ui/icon/icon';

/** מסך פתיחה: 70 זהב ענק מאחורי אבא, לוגו העין וכפתור "בואו נתחיל". */
@Component({
  selector: 'app-splash-page',
  imports: [NgOptimizedImage, Icon],
  templateUrl: './splash-page.html',
  styleUrl: './splash-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SplashPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly voice = inject(VoicePlayer);
  protected readonly factsCount = inject(ConfigStore).factsLabelCount;

  protected start(): void {
    if (this.auth.isLoggedIn()) {
      // הלחיצה משחררת את חסימת האודיו, ואבא מקבל את פנינו
      this.voice.unlock();
      void this.voice.play('Welcome');
      void this.router.navigateByUrl('/home');
    } else {
      void this.router.navigateByUrl('/login');
    }
  }
}
