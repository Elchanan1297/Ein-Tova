import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { StatusBanner } from './layout/status-banner/status-banner';
import { VoiceCaption } from './layout/voice-caption/voice-caption';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, VoiceCaption, StatusBanner],
  template: `
    <router-outlet />
    <app-voice-caption />
    <app-status-banner />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
