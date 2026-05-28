import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class MatchmakingService {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  
  private channel: any;
  public isSearching = signal(false);

  async findMatch() {
    const user = this.supabase.currentUser();
    if (!user) return;

    this.isSearching.set(true);

    const statsData = await this.supabase.getPlayerStats();
    const level = statsData.data?.level || 1;
    const email = user.email || 'Entrenador';

    this.channel = this.supabase.client.channel('matchmaking', {
      config: {
        presence: { key: user.id },
      },
    });

    this.channel.on('presence', { event: 'sync' }, () => {
      const state = this.channel.presenceState();
      const users = Object.keys(state);
      const opponents = users.filter(id => id !== user.id);
      
      if (opponents.length > 0) {
        const opponentId = opponents[0];
        const opponentData = state[opponentId][0] as any;
        
        if (user.id > opponentId) {
           const matchId = crypto.randomUUID();
           this.channel.send({
             type: 'broadcast',
             event: 'match_found',
             payload: { matchId, player1: user.id, player2: opponentId, opponentName: opponentData.email, opponentLevel: opponentData.level }
           });
           this.joinMatch(matchId, opponentId, true, opponentData.email, opponentData.level);
        }
      }
    });

    this.channel.on('broadcast', { event: 'match_found' }, (payload: any) => {
      const { matchId, player1, player2 } = payload.payload;
      if (player1 === user.id || player2 === user.id) {
         const opponentId = player1 === user.id ? player2 : player1;
         const isHost = player1 === user.id;
         
         if (!isHost) {
           // If I am guest, the payload doesn't have my name, it has the host's target name.
           // Wait, I can just read the host's name from the presence state BEFORE I leave.
           const state = this.channel.presenceState();
           const hostData = state[player1] ? state[player1][0] as any : { email: 'Rival', level: 1 };
           this.joinMatch(matchId, opponentId, false, hostData.email, hostData.level);
         }
      }
    });

    this.channel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await this.channel.track({ email, level, online_at: new Date().toISOString() });
      }
    });
  }
  
  private joinMatch(matchId: string, opponentId: string, isHost: boolean, opponentName: string, opponentLevel: number) {
    this.cancelSearch();
    this.router.navigate(['/battle'], { queryParams: { matchId, opponentId, isHost, opponentName, opponentLevel } });
  }

  cancelSearch() {
    this.isSearching.set(false);
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
  }
}
