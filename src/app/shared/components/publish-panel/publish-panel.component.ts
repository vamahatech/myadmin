import { Component, input, model, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-publish-panel',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './publish-panel.component.html',
})
export class PublishPanelComponent {
  readonly excerpt = model('');
  readonly excerptTe = model('');
  readonly seoTitle = model('');
  readonly seoDescription = model('');
  readonly category = model('update');

  readonly sources = input<string[]>([]);
  readonly faq = input<{ question: string; answer: string }[] | null>(null);
  readonly author = input('');
  readonly updatedAt = input('');
  readonly status = input<'DRAFT' | 'IN_REVIEW' | 'PUBLISHED'>('DRAFT');
  readonly saving = input(false);

  readonly closed = output<void>();
  readonly saveDraft = output<void>();
  readonly publish = output<void>();
}
