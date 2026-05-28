import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../core/services/supabase.service';
import { SqliteService } from '../../core/services/sqlite.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-match-history',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './match-history.component.html',
  styleUrls: ['./match-history.component.scss']
})
export class MatchHistoryComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private sqlite = inject(SqliteService);

  loading = true;
  matches: any[] = [];

  async ngOnInit() {
    this.loading = true;
    try {
      const user = this.supabase.currentUser();
      if (user) {
        let defaultUsername = user.email ? user.email.split('@')[0] : 'Mi Cuenta';
        const remoteMatches = await this.supabase.getMatchHistory();
        this.matches = remoteMatches.map(m => {
          const isWinner = m.winner_id === user.id;
          const isLoser = m.loser_id === user.id;
          let result = 'draw';
          if (isWinner) result = 'win';
          if (isLoser) result = 'loss';
          
          let isLocal = false;
          let opponentName = isWinner ? m.loser?.username : m.winner?.username;
          let myUsername = isWinner ? m.winner?.username : (isLoser ? m.loser?.username : null);
          if (!myUsername) myUsername = defaultUsername;
          let reason = m.reason;

          if (reason && reason.startsWith('[')) {
            const closingBracket = reason.indexOf(']');
            if (closingBracket > -1) {
              const bracketContent = reason.substring(1, closingBracket);
              if (bracketContent.startsWith('Local vs ')) {
                isLocal = true;
                if (result === 'win') {
                  opponentName = myUsername || 'Mi Cuenta';
                } else {
                  opponentName = 'IA';
                }
              } else if (bracketContent.startsWith('Online vs ')) {
                isLocal = false;
                opponentName = opponentName || bracketContent.substring(10);
              }
              reason = reason.substring(closingBracket + 1).trim();
            }
          }
          
          return {
            id: m.id,
            opponentName: opponentName || 'Rival Desconocido',
            result: result,
            reason: reason,
            isLocal: isLocal,
            date: m.completed_at
          };
        });

        // Combine with any local matches that haven't been synced yet
        const unsyncedLocal = this.sqlite.getUnsyncedLocalHistory();
        const localToAppend = unsyncedLocal.map((m: any) => {
          const res = m.matchData.winner === 'player' ? 'win' : (m.matchData.winner === 'opponent' ? 'loss' : 'draw');
          return {
            id: m.id,
            opponentName: res === 'win' ? defaultUsername : 'IA',
            result: res,
            reason: m.matchData.reason,
            isLocal: m.matchData.isLocal,
            date: m.date
          };
        });

        this.matches = [...localToAppend, ...this.matches];
        
        // Sort by date descending
        this.matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      } else {
        const localMatches = this.sqlite.getLocalHistory();
        this.matches = localMatches.map((m: any) => {
          const res = m.matchData.winner === 'player' ? 'win' : (m.matchData.winner === 'opponent' ? 'loss' : 'draw');
          return {
            id: m.id,
            opponentName: res === 'win' ? 'Jugador Local' : 'IA',
            result: res,
            reason: m.matchData.reason,
            isLocal: m.matchData.isLocal,
            date: m.date
          };
        });
      }
    } catch(e) {
      console.error(e);
    } finally {
      this.loading = false;
    }
  }
}
