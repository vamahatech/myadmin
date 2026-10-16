import { Component, inject } from '@angular/core';
import { ThemeService } from './core/services/theme.service';
import { RouterOutlet } from '@angular/router';
import { LoadingOverlayComponent } from './shared/components/loading-overlay/loading-overlay.component';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';
import { ToasterComponent } from './shared/components/toaster/toaster.component';
import { CommandPaletteComponent } from './shared/components/command-palette/command-palette.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LoadingOverlayComponent, ConfirmDialogComponent, CommandPaletteComponent, ToasterComponent],
  templateUrl: './app.html',
})
export class App {
  // Instantiated at boot so the theme (incl. live OS changes) is applied app-wide.
  private readonly theme = inject(ThemeService);
}
