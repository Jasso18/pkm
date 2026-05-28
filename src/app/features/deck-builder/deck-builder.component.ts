import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PokeapiService } from '../../core/services/pokeapi.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { PokemonCard } from '../../core/models/card.model';

@Component({
  selector: 'app-deck-builder',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './deck-builder.component.html',
  styleUrls: ['../collection/collection.component.scss', './deck-builder.component.scss']
})
export class DeckBuilderComponent implements OnInit {
  private pokeapi = inject(PokeapiService);
  private supabase = inject(SupabaseService);
  
  availableCards: PokemonCard[] = [];
  deck: PokemonCard[] = []; // Used for the draw deck
  startingHand: PokemonCard[] = []; // Used for the 6 initial cards
  loading = true;

  async ngOnInit() {
    try {
      // Get user collection from Supabase
      const { data: collData, error: collError } = await this.supabase.getUserCollection();
      if (collError) throw collError;

      if (collData) {
        this.availableCards = collData.map(c => c.pokemon_cards as any as PokemonCard);
      }

      // Load existing active deck
      const activeDeck = await this.supabase.loadActiveDeck();
      this.deck = activeDeck.deckCards as any as PokemonCard[];
      this.startingHand = activeDeck.startingHand as any as PokemonCard[];
      
    } catch (e) {
      console.error('Error loading cards:', e);
    } finally {
      this.loading = false;
    }
  }

  addToDeck(card: PokemonCard) {
    if (this.startingHand.length < 6) {
      this.startingHand.push(card);
    } else {
      this.deck.push(card);
    }
  }

  removeFromHand(index: number) {
    this.startingHand.splice(index, 1);
  }

  removeFromDeck(index: number) {
    this.deck.splice(index, 1);
  }

  async saveDeck() {
    if (this.startingHand.length !== 6) {
      alert('¡Debes elegir exactamente 6 cartas para tu mano inicial!');
      return;
    }
    this.loading = true;
    try {
      const handIds = this.startingHand.map(c => c.id);
      const deckIds = this.deck.map(c => c.id);
      await this.supabase.saveDeck('Mi Mazo Principal', handIds, deckIds);
      alert(`¡Mazo guardado! Mano: 6, Mazo de robo: ${this.deck.length}`);
    } catch (e: any) {
      alert('Error guardando el mazo: ' + e.message);
    } finally {
      this.loading = false;
    }
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
      case 'fire': return 'Daño 500 al rival';
      case 'water': return 'Cura 500 HP';
      case 'grass':
      case 'bug': return 'Roba 300 HP al rival';
      case 'electric': return 'Reduce 200 ATK al rival';
      case 'normal':
      case 'fighting':
      case 'ground':
      case 'rock': return '+500 ATK/DEF';
      case 'psychic':
      case 'ghost':
      case 'poison':
      case 'dark': return 'Destruye menor DEF rival';
      default: return '+300 ATK';
    }
  }
}
