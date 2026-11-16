import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { THEME } from './chart-theme';

/** ECharts נטען רק כשיש גרף על המסך, ורק עם הסוגים שצריך (לא מנפח את האפליקציה) */
let loader: Promise<typeof import('echarts/core')> | null = null;
function loadECharts() {
  loader ??= (async () => {
    const [core, charts, components, renderers] = await Promise.all([
      import('echarts/core'),
      import('echarts/charts'),
      import('echarts/components'),
      import('echarts/renderers'),
    ]);
    core.use([
      charts.LineChart,
      charts.BarChart,
      charts.ScatterChart,
      charts.HeatmapChart,
      components.GridComponent,
      components.TooltipComponent,
      components.LegendComponent,
      components.VisualMapComponent,
      components.MarkLineComponent,
      components.MarkAreaComponent,
      // canvas: ב־SVG הטקסט בעברית נשבר
      renderers.CanvasRenderer,
    ]);
    core.registerTheme('ein-tova-theme', THEME);
    return core;
  })();
  return loader;
}

/**
 * עטיפה דקה ל־ECharts: אתחול עצל, עדכון כשה־option משתנה (עם אנימציה), שינוי גודל לפי הקופסה
 * (ResizeObserver: גם בהחלפת טאב), ותקציר טקסטואלי לקוראי מסך.
 */
@Component({
  selector: 'app-echart',
  template: `<div class="canvas" role="img" [attr.aria-label]="label()"></div>`,
  styles: `
    :host { display: block; position: relative; width: 100%; height: var(--chart-h, 260px); }
    .canvas { position: absolute; inset: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EChart {
  readonly option = input.required<EChartsCoreOption>();
  /** תקציר הגרף במילים (נגישות) */
  readonly label = input.required<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly chart = signal<ECharts | null>(null);

  constructor() {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let observer: ResizeObserver | undefined;

    afterNextRender(async () => {
      const echarts = await loadECharts();
      const el = this.host.nativeElement.querySelector('.canvas') as HTMLElement;
      const chart = echarts.init(el, 'ein-tova-theme', { renderer: 'canvas' });
      if (reduced) chart.setOption({ animation: false });
      observer = new ResizeObserver(() => chart.resize());
      observer.observe(this.host.nativeElement);
      this.chart.set(chart);
    });

    effect(() => {
      const chart = this.chart();
      const option = this.option();
      // עדכון חי: מיזוג עם הקיים כדי שהגרף יזוז ולא יצויר מחדש; הסדרות מוחלפות
      chart?.setOption(reduced ? { ...option, animation: false } : option, { replaceMerge: ['series'] });
    });

    inject(DestroyRef).onDestroy(() => {
      observer?.disconnect();
      this.chart()?.dispose();
    });
  }
}
