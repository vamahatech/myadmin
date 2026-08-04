import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';

/**
 * Standalone Toast UI Editor wrapper for authoring the article `bodyMd` (and the
 * optional Telugu body) in the admin CMS. Markdown in / markdown out — matches the
 * backend `bodyMd` column exactly.
 *
 * The Editor class is lazy-imported in ngAfterViewInit so its ~200KB bundle only
 * loads when an admin actually opens the editor.
 */
@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  template: `<div #host></div>`,
  styleUrl: './markdown-editor.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class MarkdownEditorComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;

  /** Two-way bound markdown value: use `[(value)]` from the parent. */
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();

  @Input() height = '520px';
  @Input() placeholder = 'Write in Markdown…';

  // `any` — the Toast UI Editor type only exists after the lazy import resolves.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private editor: any = null;
  private ready = false;
  /** Last value we emitted, so parent echo-backs don't reset the caret. */
  private lastEmitted = '';

  /** Inject the vendor CSS (copied to /vendor by angular.json) once, on demand.
      Absolute (root-relative) href so it resolves from any route depth. */
  private ensureStyles(): void {
    for (const href of ['/vendor/toastui-editor.css', '/vendor/toastui-editor-dark.css']) {
      if (document.querySelector(`link[href="${href}"]`)) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  }

  async ngAfterViewInit(): Promise<void> {
    if (typeof window === 'undefined') return; // guard: never init during SSG
    this.ensureStyles();
    const { default: Editor } = await import('@toast-ui/editor');
    const isDark = document.documentElement.classList.contains('dark');
    this.editor = new Editor({
      el: this.host.nativeElement,
      height: this.height,
      initialEditType: 'markdown',
      previewStyle: 'vertical',
      theme: isDark ? 'dark' : 'default',
      usageStatistics: false,
      placeholder: this.placeholder,
      initialValue: this.value ?? '',
      hideModeSwitch: false,
    });
    this.lastEmitted = this.value ?? '';
    this.editor.on('change', () => {
      const md: string = this.editor.getMarkdown();
      this.lastEmitted = md;
      this.valueChange.emit(md);
    });
    this.ready = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    const v = changes['value'];
    if (this.ready && v && v.currentValue !== this.lastEmitted) {
      this.lastEmitted = v.currentValue ?? '';
      this.editor.setMarkdown(this.lastEmitted, false);
    }
  }

  ngOnDestroy(): void {
    this.editor?.destroy?.();
  }
}
