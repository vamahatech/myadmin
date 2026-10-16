import { Component, inject, OnInit } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { PushAdminService } from '../../../../core/services/push-admin.service';
import { PushConsoleComponent } from '../../../../shared/components/push-console/push-console.component';

/** Studio-wide push console: every app that ships push, with an app selector. */
@Component({
  selector: 'app-admin-push',
  standalone: true,
  imports: [PushConsoleComponent],
  template: `
    <app-push-console
      title="Push notifications"
      description="Registered devices, broadcasts and the dormancy cron."
      [apps]="apps" />
  `,
})
export class AdminPushComponent implements OnInit {
  private readonly meta = inject(Meta);
  readonly apps = inject(PushAdminService).listApps();

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }
}
