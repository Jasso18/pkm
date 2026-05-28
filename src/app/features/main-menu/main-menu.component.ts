import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { PokeapiService } from '../../core/services/pokeapi.service';
import { MatchmakingService } from '../../core/services/matchmaking.service';
import { PokemonCard } from '../../core/models/card.model';

@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './main-menu.component.html',
  styleUrls: ['./main-menu.component.scss']
})
export class MainMenuComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private pokeapi = inject(PokeapiService);
  public matchmaking = inject(MatchmakingService);

  userEmail = this.supabase.currentUser()?.email;
  level = 1;
  xp = 0;
  xpRequired = 100;
  nextRewardCard: PokemonCard | null = null;
  showRules = false;

  async ngOnInit() {
    try {
      const { data, error } = await this.supabase.getPlayerStats();
      if (!error && data) {
        this.level = data.level || 1;
        this.xp = data.xp || 0;
      }
      this.xpRequired = this.level * 100;

      // Fetch next reward card (Gen 9 starts at 906, so reward is 906 + level)
      const nextCardId = 906 + this.level;
      if (nextCardId <= 1025) {
        this.nextRewardCard = await this.pokeapi.getPokemonCard(nextCardId);
      }

      // Check starter cards
      const { data: coll } = await this.supabase.getUserCollection();
      if (!coll || coll.length === 0) {
        // Grant 10 random cards from Gen 9 (906 - 1025)
        const starterIds = [];
        for (let i = 0; i < 10; i++) {
          starterIds.push(Math.floor(Math.random() * (1025 - 906 + 1)) + 906);
        }
        const promises = starterIds.map(id => this.pokeapi.getPokemonCard(id));
        const starterCards = await Promise.all(promises);
        await this.supabase.grantStarterCards(starterCards);
        alert('¡Has recibido 10 cartas iniciales gratis!');
      }

    } catch (e) {
      console.error('Error fetching stats', e);
    }
  }

  async logout() {
    await this.supabase.signOut();
    this.router.navigate(['/login']);
  }
}
