import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon, IconName } from '../../shared/ui/icon/icon';

interface ProgramItem {
  itemId: number;
  timeText: string;
  title: string;
  icon: string | null;
}

// שם האייקון כפי שנשמר בניהול → אייקון באפליקציה
const ICONS: Record<string, IconName> = {
  door: 'door',
  mic: 'mic',
  spark: 'sparkles',
  sparkles: 'sparkles',
  film: 'film',
  gift: 'gift',
};

/** תוכנית הערב: רשימת שעה, אייקון ושם. */
@Component({
  selector: 'app-program-page',
  imports: [Icon],
  templateUrl: './program-page.html',
  styleUrl: './program-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ProgramPage {
  protected readonly items = httpResource<ProgramItem[]>(() => '/api/program', { defaultValue: [] });

  protected icon(name: string | null): IconName {
    return (name && ICONS[name]) || 'clock';
  }
}
