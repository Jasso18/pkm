import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { GameEngineService } from '../../game/engine/game-engine.service';
import { AiService } from '../../game/engine/ai.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { PokeapiService } from '../../core/services/pokeapi.service';
import { PokemonCard } from '../../core/models/card.model';

@Component({
  selector: 'app-battlefield',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './battlefield.component.html',
  styleUrls: ['./battlefield.component.scss', '../collection/collection.component.scss']
})
export class BattlefieldComponent implements OnInit, OnDestroy {
  public engine = inject(GameEngineService);
  private ai = inject(AiService); // Instantiates AI (disabled if online)
  private pokeapi = inject(PokeapiService);
  private supabase = inject(SupabaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  
  loading = true;
  selectedCardId: string | null = null;
  targetSelectionMode = false;
  opponentName = 'IA Oponente';
  opponentLevel = 1;

  async ngOnInit() {
    try {
      // Load real deck
      const activeDeck = await this.supabase.loadActiveDeck();
      
      // If no deck, just load mock for now or throw error
      if (!activeDeck || activeDeck.startingHand.length !== 6) {
        alert('No tienes un mazo de 6 cartas guardado. Ve al Constructor de Mazos.');
        return;
      }

      const matchId = this.route.snapshot.queryParamMap.get('matchId');
      const isHost = this.route.snapshot.queryParamMap.get('isHost') === 'true';
      const oppName = this.route.snapshot.queryParamMap.get('opponentName');
      const oppLevel = this.route.snapshot.queryParamMap.get('opponentLevel');

      if (oppName) {
        this.opponentName = oppName.split('@')[0]; // Show username part of email
      } else {
        this.opponentName = 'IA';
      }
      this.engine.opponentName = this.opponentName;
      if (oppLevel) this.opponentLevel = Number(oppLevel);

      const localDeck = { hand: activeDeck.startingHand as any[], deck: activeDeck.deckCards as any[] };

      if (matchId) {
        await this.engine.startOnlineMatch(matchId, isHost, localDeck);
      } else {
        // AI match
        this.engine.initGame(localDeck, localDeck);
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy() {
    this.engine.disconnect();
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // Phase handled by engine timers now

  playCard(instanceId: string, position: 'attack' | 'defense') {
    this.engine.playCard(instanceId, position);
  }

  selectForAttack(instanceId: string) {
    if (this.engine.gameState()?.currentPhase !== 'attack') return;
    this.selectedCardId = instanceId;
    this.targetSelectionMode = true;
  }

  declareAttack(targetId: string | null) {
    if (!this.selectedCardId || !this.targetSelectionMode) return;
    this.engine.attack(this.selectedCardId, targetId);
    this.selectedCardId = null;
    this.targetSelectionMode = false;
  }

  resolveDraw(draw: boolean) {
    this.engine.resolveDrawPrompt(draw);
  }

  activateAbility(instanceId: string) {
    this.engine.activateAbility(instanceId);
  }

  async surrender() {
    this.engine.surrender();
    this.router.navigate(['/main']);
  }

  getAbilitySymbol(type: string): string {
    const t = type.toLowerCase();
    switch (t) {
      case 'fire': return '🔥';
      case 'water': return '💧';
      case 'grass':
      case 'bug': return '🌿';
      case 'electric': return '⚡';
      case 'normal':
      case 'fighting':
      case 'ground':
      case 'rock': return '✊';
      case 'psychic':
      case 'ghost':
      case 'poison':
      case 'dark': return '🔮';
      default: return '✨';
    }
  }

  getAbilityDescription(type: string): string {
    const t = type.toLowerCase();
    switch (t) {
      case 'fire': return 'Inflige 500 Daño directo al rival';
      case 'water': return 'Cura 500 HP a tu entrenador';
      case 'grass':
      case 'bug': return 'Roba 300 HP al rival';
      case 'electric': return 'Reduce 200 ATK a todo el campo rival';
      case 'normal':
      case 'fighting':
      case 'ground':
      case 'rock': return '+500 ATK y DEF a esta carta';
      case 'psychic':
      case 'ghost':
      case 'poison':
      case 'dark': return 'Destruye la carta rival con menor DEF';
      default: return '+300 ATK a esta carta';
    }
  }
}
