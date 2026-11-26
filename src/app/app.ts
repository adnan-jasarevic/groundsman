import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PlayerEditor } from './players/player-editor';
import { SaveSwitcher } from './saves/save-switcher';
import { lastBackupText } from './state/backup';
import { PlanStore } from './state/plan-store';
import { SaveLibrary } from './state/save-library';
import { Icon } from './ui/icon';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, SaveSwitcher, PlayerEditor],
  templateUrl: './app.html',
})
export class App {
  protected readonly store = inject(PlanStore);
  protected readonly library = inject(SaveLibrary);
  protected readonly upcoming = ['Season timeline', 'Shortlist'];

  protected backupText(): string {
    return lastBackupText(this.library.lastBackup());
  }

  protected importDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
