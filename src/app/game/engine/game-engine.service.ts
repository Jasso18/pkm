import { Injectable, signal, computed, inject } from '@angular/core';
import { GameState, GamePhase, PlayerState } from '../../core/models/game.model';
import { PokemonCard, CardState } from '../../core/models/card.model';
import { SupabaseService } from '../../core/services/supabase.service';
import { SqliteService } from '../../core/services/sqlite.service';
import { interval, Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GameEngineService {
  public gameState = signal<GameState | null>(null);
  private timerSub?: Subscription;
  private supabase = inject(SupabaseService);
  private sqlite = inject(SqliteService);

  public isOnline = false;
  public opponentName = 'IA Oponente';
  private channel: any;
  private isProcessingRemoteAction = false;

  constructor() {}

  initGame(playerDeck: { hand: PokemonCard[], deck: PokemonCard[] }, aiDeck: { hand: PokemonCard[], deck: PokemonCard[] }) {
    const startingPlayer = Math.random() > 0.5 ? 'player' : 'opponent';
    
    const initialState: GameState = {
      matchId: crypto.randomUUID(),
      turnNumber: 1,
      currentPhase: 'draw',
      currentPlayerId: startingPlayer,
      player1: this.createInitialPlayerState('player', playerDeck),
      player2: this.createInitialPlayerState('opponent', aiDeck),
      winnerId: null,
      matchTimeRemaining: 300,
      phaseTimeRemaining: 3,
      pendingAction: null
    };

    // No initial draws because hands are already set via Deck Builder
    this.gameState.set(initialState);
    if (!this.isOnline) {
      this.startTimers(); // Online mode starts timers after state is synced
    }
  }

  async startOnlineMatch(matchId: string, isHost: boolean, localDeck: { hand: PokemonCard[], deck: PokemonCard[] }) {
    this.isOnline = true;
    this.channel = this.supabase.client.channel(`match_${matchId}`);

    this.channel.on('broadcast', { event: 'full_state' }, (payload: any) => {
      this.isProcessingRemoteAction = true;
      const previousWinner = this.gameState()?.winnerId;
      const flippedState = this.flipPerspective(payload.payload.state);
      this.gameState.set(flippedState);
      
      // If timers haven't started (initial load), start them
      if (!this.timerSub && !flippedState.winnerId) {
         this.startTimers();
      }

      if (flippedState.winnerId) {
         this.stopTimers();
         if (!previousWinner) {
            this.finishMatch(flippedState, flippedState.winnerId as any, flippedState.matchEndReason || 'unknown');
         }
      }
      this.isProcessingRemoteAction = false;
    });

    if (isHost) {
      this.channel.on('broadcast', { event: 'guest_deck' }, (payload: any) => {
        const guestDeck = payload.payload.deck;
        this.initGame(localDeck, guestDeck);
        this.channel.send({
          type: 'broadcast',
          event: 'full_state',
          payload: { state: this.gameState() }
        });
        this.startTimers();
      });
      this.channel.subscribe();
    } else {
      this.channel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          this.channel.send({
            type: 'broadcast',
            event: 'guest_deck',
            payload: { deck: localDeck }
          });
        }
      });
    }
  }

  disconnect() {
    this.isOnline = false;
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.stopTimers();
  }

  private broadcastState() {
    if (this.isOnline && this.channel && !this.isProcessingRemoteAction) {
      this.channel.send({
        type: 'broadcast',
        event: 'full_state',
        payload: { state: this.gameState() }
      });
    }
  }

  private flipPerspective(state: GameState): GameState {
    const newState = JSON.parse(JSON.stringify(state));
    const temp = newState.player1;
    newState.player1 = newState.player2;
    newState.player2 = temp;
    newState.player1.id = 'player';
    newState.player2.id = 'opponent';

    if (newState.currentPlayerId === 'player') newState.currentPlayerId = 'opponent';
    else if (newState.currentPlayerId === 'opponent') newState.currentPlayerId = 'player';

    if (newState.winnerId === 'player') newState.winnerId = 'opponent';
    else if (newState.winnerId === 'opponent') newState.winnerId = 'player';

    if (newState.pendingAction) {
       if (newState.pendingAction.playerId === 'player') newState.pendingAction.playerId = 'opponent';
       else if (newState.pendingAction.playerId === 'opponent') newState.pendingAction.playerId = 'player';
    }

    return newState;
  }

  private createInitialPlayerState(id: string, deckData: { hand: PokemonCard[], deck: PokemonCard[] }): PlayerState {
    const deckCards = deckData.deck.map((c, i) => this.mapToCardState(c, `${id}_deck_${i}`));
    const handCards = deckData.hand.map((c, i) => this.mapToCardState(c, `${id}_hand_${i}`));

    // Shuffle deck
    for (let i = deckCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deckCards[i], deckCards[j]] = [deckCards[j], deckCards[i]];
    }

    return {
      id,
      hp: 4000,
      deck: deckCards, // Store full CardState array
      hand: handCards,
      field: [],
      graveyard: []
    };
  }

  // Helper because we previously just pushed IDs to deck, let's keep it simple: the deck stores instances. 
  // Wait, the interface says `deck: string[]`. I need to change PlayerState if I store instances, or just store the instances in a lookup.
  // Actually, let's change `PlayerState.deck` to `CardState[]`. I will do that in game.model.ts in a sec.
  
  private mapToCardState(c: PokemonCard, instance_id: string): CardState {
    const state = {
      id: c.id,
      pokeapi_id: c.pokeapi_id,
      name: c.name,
      image_url: c.image_url,
      type: c.type,
      attack: c.attack,
      defense: c.defense,
      hp: c.hp,
      rarity: c.rarity,
      description: c.description,
      instance_id: instance_id,
      current_hp: c.hp,
      is_active: true,
      can_attack: false,
      position: 'attack' as 'attack' | 'defense',
      turns_on_field: 0,
      ability_used: false
    };
    (state as any).base_defense = c.defense;
    return state;
  }

  private drawCard(player: PlayerState) {
    if (player.deck.length === 0) {
      if (player.graveyard.length > 0) {
        // Recycle graveyard
        player.deck = [...player.graveyard];
        player.graveyard = [];
        // Shuffle deck
        for (let i = player.deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]];
        }
      } else {
        return; // Deck out and empty graveyard
      }
    }
    const card = player.deck.pop();
    if (card) {
      player.hand.push(card as any);
    }
  }

  private startTimers() {
    this.stopTimers();
    this.timerSub = interval(1000).subscribe(() => {
      this.gameState.update(state => {
        if (!state || state.winnerId) return state;

        if (state.pendingAction) {
          // Pause timers if waiting for user
          return { ...state };
        }

        state.matchTimeRemaining--;
        state.phaseTimeRemaining--;

        if (state.matchTimeRemaining <= 0) {
          this.stopTimers();
          if (state.player1.hp > state.player2.hp) {
             state.winnerId = 'player';
             state.matchEndReason = 'time_out';
             this.supabase.addXp(this.isOnline ? 50 : 10);
             this.finishMatch(state, 'player', 'time_out');
          }
          else if (state.player2.hp > state.player1.hp) {
             state.winnerId = 'opponent';
             state.matchEndReason = 'time_out';
             this.finishMatch(state, 'opponent', 'time_out');
          }
          else {
             state.winnerId = 'draw';
             state.matchEndReason = 'time_out';
             this.finishMatch(state, 'draw', 'time_out');
          }
          return { ...state };
        }

        if (state.phaseTimeRemaining <= 0) {
          this.handleNextPhase(state);
        }

        return { ...state };
      });
    });
  }

  private stopTimers() {
    if (this.timerSub) {
      this.timerSub.unsubscribe();
      this.timerSub = undefined;
    }
  }

  nextPhase() {
    this.gameState.update(state => {
      if (!state || state.winnerId) return state;
      this.handleNextPhase(state);
      return { ...state };
    });
    this.broadcastState();
  }

  private handleNextPhase(state: GameState) {
    const phases: GamePhase[] = ['draw', 'main', 'attack', 'end'];
    const currentIdx = phases.indexOf(state.currentPhase);
    
    if (currentIdx === phases.length - 1) {
      this.startNextTurn(state);
    } else {
      let nextPhase = phases[currentIdx + 1];
      if (nextPhase === 'attack' && state.turnNumber <= 2) {
        nextPhase = 'end'; // Skip attack phase for the first turn of each player
      }
      state.currentPhase = nextPhase;
      this.setPhaseTime(state);
    }
  }

  private startNextTurn(state: GameState) {
    state.currentPhase = 'draw';
    state.currentPlayerId = state.currentPlayerId === 'player' ? 'opponent' : 'player';
    state.turnNumber++;
    
    const activePlayer = state.currentPlayerId === 'player' ? state.player1 : state.player2;
    
    if (activePlayer.graveyard.length > 0) {
      activePlayer.deck.unshift(...activePlayer.graveyard); // Add to bottom
      activePlayer.graveyard = [];
    }
    
    this.drawCard(activePlayer);
    activePlayer.field.forEach(c => {
      c.can_attack = true;
      c.turns_on_field++;
    });
    this.setPhaseTime(state);
  }

  private setPhaseTime(state: GameState) {
    switch (state.currentPhase) {
      case 'draw': state.phaseTimeRemaining = 3; break;
      case 'main': state.phaseTimeRemaining = 40; break;
      case 'attack': state.phaseTimeRemaining = 30; break;
      case 'end': state.phaseTimeRemaining = 3; break;
    }
  }

  playCard(instanceId: string, position: 'attack' | 'defense') {
    this.gameState.update(state => {
      if (!state || state.currentPhase !== 'main' || state.pendingAction) return state;
      const player = state.currentPlayerId === 'player' ? state.player1 : state.player2;
      
      if (player.field.length >= 5) return state; // Field full

      const cardIndex = player.hand.findIndex(c => c.instance_id === instanceId);
      if (cardIndex > -1) {
        const card = player.hand.splice(cardIndex, 1)[0];
        card.position = position;
        card.can_attack = (position === 'attack');
        player.field.push(card);
        
        // Trigger draw prompt if it's the player
        if (state.currentPlayerId === 'player') {
          state.pendingAction = { type: 'draw_prompt', playerId: 'player' };
        } else {
          // AI automatically draws if possible, but ONLY if we are NOT online
          if (!this.isOnline) {
             this.drawCard(player);
          } else {
             state.pendingAction = { type: 'draw_prompt', playerId: 'opponent' };
          }
        }
      }
      return { ...state };
    });
    this.broadcastState();
  }

  resolveDrawPrompt(draw: boolean) {
    this.gameState.update(state => {
      if (!state || !state.pendingAction || state.pendingAction.type !== 'draw_prompt') return state;
      if (draw) {
        const player = state.currentPlayerId === 'player' ? state.player1 : state.player2;
        this.drawCard(player);
      }
      state.pendingAction = null;
      return { ...state };
    });
    this.broadcastState();
  }

  attack(attackerId: string, targetId: string | null) {
    this.gameState.update(state => {
      if (!state || state.currentPhase !== 'attack') return state;
      
      const attackerPlayer = state.currentPlayerId === 'player' ? state.player1 : state.player2;
      const defenderPlayer = state.currentPlayerId === 'player' ? state.player2 : state.player1;

      const attacker = attackerPlayer.field.find(c => c.instance_id === attackerId);
      if (!attacker || !attacker.can_attack || attacker.position !== 'attack') return state;

      if (targetId) {
        const defender = defenderPlayer.field.find(c => c.instance_id === targetId);
        if (defender) {
          // Attacker reduces defender's defense (which acts as HP)
          defender.defense -= attacker.attack;

          // Overflow damage hits the player directly
          if (defender.defense < 0) {
            defenderPlayer.hp -= Math.abs(defender.defense);
          }
          
          if (defender.defense <= 0) {
            this.destroyCard(defenderPlayer, defender);
          }
        }
      } else {
        // Direct attack
        if (defenderPlayer.field.length === 0) {
          defenderPlayer.hp -= attacker.attack;
        }
      }

      attacker.can_attack = false;
      this.checkWinCondition(state);

      if (!state.winnerId) {
        this.startNextTurn(state);
      }

      return { ...state };
    });
    this.broadcastState();
  }

  private destroyCard(player: PlayerState, card: CardState) {
    player.field = player.field.filter(c => c.instance_id !== card.instance_id);
    card.defense = (card as any).base_defense || card.hp; // Reset defense back to normal
    card.position = 'attack';
    card.can_attack = false;
    player.graveyard.push(card);
  }

  private checkWinCondition(state: GameState) {
    if (state.player1.hp < 0) state.player1.hp = 0;
    if (state.player2.hp < 0) state.player2.hp = 0;

    if (state.player1.hp <= 0) { 
      state.winnerId = 'opponent'; 
      state.matchEndReason = 'hp_zero';
      this.stopTimers(); 
      this.finishMatch(state, 'opponent', 'hp_zero');
    }
    if (state.player2.hp <= 0) { 
      state.winnerId = 'player'; 
      state.matchEndReason = 'hp_zero';
      this.stopTimers(); 
      this.supabase.addXp(this.isOnline ? 50 : 10);
      this.finishMatch(state, 'player', 'hp_zero');
    }
  }

  private async finishMatch(state: GameState, winner: 'player' | 'opponent' | 'draw', reason: string) {
    const user = this.supabase.currentUser();
    const isLocal = !this.isOnline;
    
    // Si no está logueado y es local, intentamos guardar solo localmente, pero como el usuario 
    // real es "player" no tenemos su UUID a menos que sea a través de supabase.
    // Usaremos un string genérico si no hay user.
    const userId = user?.id || null;
    let winnerId = null;
    let loserId = null;
    let resultType: 'win' | 'loss' | 'draw' = 'draw';

    if (winner === 'player') {
      winnerId = userId;
      resultType = 'win';
    } else if (winner === 'opponent') {
      loserId = userId; // if we lost, user is the loser
      resultType = 'loss';
    }

    const matchData = {
      winner: winner,
      reason: reason,
      isLocal: isLocal,
      opponentName: this.opponentName,
      date: new Date().toISOString()
    };

    if (!userId) {
      if (isLocal) {
        this.sqlite.saveLocalMatchResult(matchData);
      }
    } else {
      await this.supabase.saveMatchResult(state.matchId, winnerId, loserId, isLocal, this.opponentName, reason);
      await this.supabase.updatePlayerStatsResult(userId, resultType);
    }
  }

  activateAbility(instanceId: string) {
    this.gameState.update(state => {
      if (!state || state.currentPhase !== 'main' || state.pendingAction) return state;
      const player = state.currentPlayerId === 'player' ? state.player1 : state.player2;
      const opponent = state.currentPlayerId === 'player' ? state.player2 : state.player1;

      const card = player.field.find(c => c.instance_id === instanceId);
      if (!card || card.turns_on_field < 2 || card.ability_used) return state;

      const type = card.type.toLowerCase();
      
      switch (type) {
        case 'fire':
          opponent.hp -= 500;
          break;
        case 'water':
          player.hp = Math.min(4000, player.hp + 500);
          break;
        case 'grass':
        case 'bug':
          opponent.hp -= 300;
          player.hp = Math.min(4000, player.hp + 300);
          break;
        case 'electric':
          // Reduce attack of all opponent cards
          opponent.field.forEach(c => {
             c.attack = Math.max(0, c.attack - 200);
          });
          break;
        case 'normal':
        case 'fighting':
        case 'ground':
        case 'rock':
          card.attack += 500;
          card.defense += 500;
          break;
        case 'psychic':
        case 'ghost':
        case 'poison':
        case 'dark':
          if (opponent.field.length > 0) {
            // Destroy opponent card with lowest defense
            let lowestDefCard = opponent.field[0];
            for (const c of opponent.field) {
              if (c.defense < lowestDefCard.defense) {
                lowestDefCard = c;
              }
            }
            this.destroyCard(opponent, lowestDefCard);
          }
          break;
        default:
          card.attack += 300;
          break;
      }
      
      card.ability_used = true;
      this.checkWinCondition(state);

      return { ...state };
    });
    this.broadcastState();
  }

  surrender() {
    this.gameState.update(state => {
      if (!state || state.winnerId) return state;
      state.winnerId = 'opponent';
      state.matchEndReason = 'surrender';
      this.stopTimers();
      this.finishMatch(state, 'opponent', 'surrender');
      return { ...state };
    });
    this.broadcastState();
  }
}

