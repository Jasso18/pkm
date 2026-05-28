import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PokeapiService } from '../../core/services/pokeapi.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { PokemonCard } from '../../core/models/card.model';

@Component({
  selector: 'app-collection',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './collection.component.html',
  styleUrls: ['./collection.component.scss']
})
export class CollectionComponent implements OnInit {
  private pokeapi = inject(PokeapiService);
  private supabase = inject(SupabaseService);
  
  collectionData: any[] = [];
  cards: PokemonCard[] = [];
  loading = true;

  async ngOnInit() {
    this.loading = true;
    try {
      const { data, error } = await this.supabase.getUserCollection();
      if (error) throw error;

      if (data) {
        this.collectionData = data;
        this.cards = data.map(item => item.pokemon_cards as any as PokemonCard);
      }
    } catch (e) {
      console.error('Error loading collection:', e);
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
