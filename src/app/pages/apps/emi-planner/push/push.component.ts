import { Component, inject, OnInit } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { PushConsoleComponent } from '../../../../shared/components/push-console/push-console.component';

@Component({
  selector: 'app-emi-push',
  standalone: true,
  imports: [PushConsoleComponent],
  template: `
    <app-push-console
      title="Push &amp; retention"
      description="Broadcast to registered devices and watch the dormancy cron."
      [apps]="['emi-planner']" />
  `,
})
export class PushComponent implements OnInit {
  private readonly meta = inject(Meta);

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }
}
