import { Injectable, inject } from '@angular/core';
import { GameEngineService } from './game-engine.service';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private engine = inject(GameEngineService);

  private currentPhaseHandled = '';

  constructor() {
    // Basic AI loop runs faster now
    setInterval(() => this.aiLoop(), 250);
  }

  private aiLoop() {
    if (this.engine.isOnline) return;
    const state = this.engine.gameState();
    if (!state || state.winnerId || state.currentPlayerId !== 'opponent') {
      this.currentPhaseHandled = '';
      return;
    }

    if (this.currentPhaseHandled === state.currentPhase) return;
    this.currentPhaseHandled = state.currentPhase;

    const ai = state.player2;

    switch (state.currentPhase) {
      case 'draw':
        // Engine handles drawing automatically on turn start, just advance phase
        setTimeout(() => this.engine.nextPhase(), 1500);
        break;

      case 'main':
        // Try to play as many cards as possible
        while (ai.field.length < 5 && ai.hand.length > 0) {
          const sortedHand = [...ai.hand].sort((a, b) => (b.attack + b.defense) - (a.attack + a.defense));
          const toPlay = sortedHand[0];
          // Defend if defense is better than attack or if hp is low
          const position = (toPlay.defense > toPlay.attack || state.player2.hp < 1500) ? 'defense' : 'attack';
          this.engine.playCard(toPlay.instance_id, position);
        }
        setTimeout(() => this.engine.nextPhase(), 2000);
        break;

      case 'attack':
        // Attack logic
        let attacked = false;
        if (ai.field.length > 0) {
          const attackers = ai.field.filter(c => c.can_attack && c.position === 'attack');
          const playerField = state.player1.field;

          if (attackers.length > 0) {
            const attacker = attackers[0]; // Attack only once
            attacked = true;
            if (playerField.length === 0) {
              this.engine.attack(attacker.instance_id, null); // direct attack
            } else {
              // attack weakest monster
              const weakest = [...playerField].sort((a, b) => a.defense - b.defense)[0];
              this.engine.attack(attacker.instance_id, weakest.instance_id);
            }
          }
        }
        
        if (!attacked) {
          setTimeout(() => this.engine.nextPhase(), 2000);
        }
        break;

      case 'end':
        setTimeout(() => this.engine.nextPhase(), 1500);
        break;
    }
  }
}
