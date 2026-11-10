import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { EyeLoader } from '../../shared/ui/eye-loader/eye-loader';
import { Photo, GuestPhotosApi, decadeLabel } from './data/photos-api';
import { PhotoViewer } from './ui/photo-viewer';

interface DecadeGroup {
  decade: number | null;
  label: string;
  /** מיקום הראשונה ברשימה המלאה (לצפייה ולהחלקה בין כל התמונות) */
  offset: number;
  photos: Photo[];
}

/** "מסע בזמן": תמונות של אבא לפי עשורים. צפייה בלבד, ❤️ */
@Component({
  selector: 'app-photos-page',
  imports: [EyeLoader, PhotoViewer],
  templateUrl: './photos-page.html',
  styleUrl: './photos-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PhotosPage {
  private readonly api = inject(GuestPhotosApi);

  protected readonly photos = signal<Photo[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly viewing = signal<number | null>(null);

  /** הרשימה כבר ממוינת בשרת לפי שנה, בלי שנה בסוף */
  protected readonly groups = computed<DecadeGroup[]>(() => {
    const groups: DecadeGroup[] = [];
    (this.photos() ?? []).forEach((p, i) => {
      const decade = p.yearTaken ? Math.floor(p.yearTaken / 10) * 10 : null;
      let g = groups.at(-1);
      if (!g || g.decade !== decade) groups.push((g = { decade, label: decadeLabel(decade), offset: i, photos: [] }));
      g.photos.push(p);
    });
    return groups;
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.failed.set(false);
    try {
      this.photos.set(await this.api.list());
    } catch {
      this.failed.set(true);
    }
  }

  protected jump(decade: number | null): void {
    document.getElementById(`decade-${decade ?? 'none'}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** ❤️ מהצופה: מעדכן מיד, ומתקן לפי השרת */
  protected async like(publicId: string): Promise<void> {
    const flip = (p: Photo) => (p.publicId === publicId ? { ...p, likedByMe: !p.likedByMe, likes: p.likes + (p.likedByMe ? -1 : 1) } : p);
    this.photos.update((list) => list?.map(flip) ?? null);
    try {
      const res = await this.api.toggleLike(publicId);
      this.photos.update((list) => list?.map((p) => (p.publicId === publicId ? { ...p, likedByMe: res.liked, likes: res.likes } : p)) ?? null);
    } catch {
      this.photos.update((list) => list?.map(flip) ?? null); // מחזירים
    }
  }
}
