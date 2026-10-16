import { Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';

let nextId = 0;

/**
 * Push notification composer: labelled title + message with character
 * counters, and a live lock-screen preview. The parent owns confirm + API:
 *
 *   <app-push-composer appName="EMI Planner" appIcon="emiplanner.png"
 *     audience="12 devices" [sending]="sending()" [error]="error()"
 *     [(title)]="title" [(body)]="body" (send)="send()" />
 *
 * Project extra controls above the fields with [composerTop] (e.g. a
 * recipient picker) and extra buttons beside Send with [composerActions].
 */
@Component({
  selector: 'app-push-composer',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-8 items-start">
      <form class="space-y-4" (ngSubmit)="trySend()" novalidate>
        <ng-content select="[composerTop]" />

        <div>
          <div class="flex items-baseline justify-between gap-3">
            <label class="field-label" [for]="id + '-title'">Title</label>
            <span class="text-xs tabular-nums" [class.text-text2]="title().length <= titleMax() - 10" [class.text-warning]="title().length > titleMax() - 10">
              {{ title().length }}/{{ titleMax() }}
            </span>
          </div>
          <input [id]="id + '-title'" name="title" class="input" [maxlength]="titleMax()"
            placeholder="e.g. Repo rate cut by 25 bps" [ngModel]="title()" (ngModelChange)="title.set($event)" />
        </div>

        <div>
          <div class="flex items-baseline justify-between gap-3">
            <label class="field-label" [for]="id + '-body'">Message</label>
            <span class="text-xs tabular-nums" [class.text-text2]="body().length <= bodyMax() - 20" [class.text-warning]="body().length > bodyMax() - 20">
              {{ body().length }}/{{ bodyMax() }}
            </span>
          </div>
          <textarea [id]="id + '-body'" name="body" class="input resize-none" rows="4" [maxlength]="bodyMax()"
            placeholder="What should people know? Keep it to one or two lines."
            [ngModel]="body()" (ngModelChange)="body.set($event)"></textarea>
          <p class="field-help">Lock screens usually show about 2 lines of the message.</p>
        </div>

        @if (disabledReason()) {
          <p class="text-sm text-warning flex items-start gap-1.5"><app-icon name="alert-triangle" [size]="14" class="mt-0.5" />{{ disabledReason() }}</p>
        }
        @if (error()) {
          <p class="field-error flex items-center gap-1.5 mt-0" role="alert"><app-icon name="alert-triangle" [size]="14" />{{ error() }}</p>
        }

        <div class="flex flex-wrap items-center gap-3 pt-1">
          <button type="submit" class="btn" [disabled]="sending() || !!disabledReason() || !canSend()">
            @if (sending()) {
              <app-icon name="loader" [size]="16" class="animate-spin motion-reduce:animate-none" /> Sending…
            } @else {
              <app-icon name="bell" [size]="16" /> {{ submitLabel() }}
            }
          </button>
          <ng-content select="[composerActions]" />
          @if (audience()) {
            <span class="text-xs text-text2">Goes to {{ audience() }}</span>
          }
        </div>
      </form>

      <!-- Live lock-screen preview -->
      <figure class="mx-auto lg:mx-0 w-[260px]" aria-label="Notification preview">
        <figcaption class="text-xs font-semibold text-text2 mb-3 text-center lg:text-left">Preview</figcaption>
        <div class="rounded-[2.25rem] border border-border bg-surface p-3">
          <div class="rounded-[1.75rem] bg-bg overflow-hidden">
            <div class="pt-5 pb-3 text-center">
              <p class="text-[28px] leading-8 font-semibold text-text tabular-nums">9:41</p>
              <p class="text-[11px] text-text2">Thursday</p>
            </div>
            <div class="px-3 pb-6">
              <div class="bg-card border border-border rounded-2xl p-3 shadow-sm">
                <div class="flex items-start gap-2.5">
                  @if (appIcon()) {
                    <img [src]="'/' + appIcon()" alt="" class="w-8 h-8 rounded-lg object-cover ring-1 ring-border shrink-0" />
                  } @else {
                    <span class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><app-icon name="bell" [size]="16" /></span>
                  }
                  <div class="min-w-0 flex-1">
                    <div class="flex items-baseline justify-between gap-2">
                      <span class="text-[10px] font-semibold uppercase tracking-wide text-text2 truncate">{{ appName() }}</span>
                      <span class="text-[10px] text-text2 shrink-0">now</span>
                    </div>
                    <p class="text-xs font-semibold text-text truncate mt-0.5" [class.text-text2]="!title().trim()">{{ title().trim() || 'Notification title' }}</p>
                    <p class="text-xs text-text2 mt-0.5 line-clamp-2">{{ body().trim() || 'Your message appears here as you type.' }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </figure>
    </div>
  `,
  host: { class: 'block' },
})
export class PushComposerComponent {
  readonly appName = input.required<string>();
  readonly appIcon = input<string | null>(null);
  /** e.g. "12 devices", "3 selected users". */
  readonly audience = input<string>('');
  readonly sending = input(false);
  readonly error = input('');
  /** When set, Send is disabled and this explains why. */
  readonly disabledReason = input<string | null>(null);
  readonly submitLabel = input('Send to all devices');
  readonly titleMax = input(65);
  readonly bodyMax = input(240);

  readonly title = model('');
  readonly body = model('');
  readonly send = output<void>();

  readonly id = `push-${nextId++}`;
  readonly canSend = computed(() => !!this.title().trim() && !!this.body().trim());

  trySend(): void {
    if (this.sending() || this.disabledReason() || !this.canSend()) return;
    this.send.emit();
  }
}
