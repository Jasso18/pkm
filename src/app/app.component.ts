import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseService } from './core/services/supabase.service';
import { SqliteService } from './core/services/sqlite.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'tcg-web';
  private supabase = inject(SupabaseService);
  private sqlite = inject(SqliteService);

  ngOnInit() {
    this.supabase.initialized.then(() => {
      this.syncLocalHistory();
    });

    // Also sync if auth state changes (e.g., login)
    this.supabase.client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        this.syncLocalHistory();
      }
    });
  }

  async syncLocalHistory() {
    const user = this.supabase.currentUser();
    if (!user) return; // Cannot sync if not logged in

    // Wait for SQLite to be ready
    if (!this.sqlite.isReady()) {
       setTimeout(() => this.syncLocalHistory(), 1000);
       return;
    }

    const unsynced = this.sqlite.getUnsyncedLocalHistory();
    for (const record of unsynced) {
      let winnerId = null;
      let loserId = null;
      let resultType: 'win' | 'loss' | 'draw' = 'draw';

      if (record.matchData.winner === 'player') {
        winnerId = user.id;
        resultType = 'win';
      } else if (record.matchData.winner === 'opponent') {
        loserId = user.id;
        resultType = 'loss';
      }

      const success = await this.supabase.saveMatchResult(
        null, // matchId is null for local matches
        winnerId,
        loserId,
        true, // isLocal
        record.matchData.opponentName || 'IA Oponente',
        record.matchData.reason || 'unknown'
      );

      if (success) {
        await this.supabase.updatePlayerStatsResult(user.id, resultType);
        // Mark as synced
        this.sqlite.markHistoryAsSynced(record.id);
      }
    }
  }
}
