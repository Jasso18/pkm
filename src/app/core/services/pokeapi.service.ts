import { Injectable } from '@angular/core';
import { PokemonCard } from '../models/card.model';

@Injectable({
  providedIn: 'root'
})
export class PokeapiService {
  private baseUrl = 'https://pokeapi.co/api/v2';

  constructor() {}

  async getPokemonCard(idOrName: string | number): Promise<PokemonCard> {
    const response = await fetch(`${this.baseUrl}/pokemon/${idOrName}`);
    if (!response.ok) {
      throw new Error('Pokemon not found');
    }
    const data = await response.json();
    
    // Map PokéAPI data to our game's Card model
    // Base stats in PokeAPI: HP, Attack, Defense, Sp. Atk, Sp. Def, Speed
    const hpStat = data.stats.find((s: any) => s.stat.name === 'hp').base_stat;
    const attackStat = data.stats.find((s: any) => s.stat.name === 'attack').base_stat;
    const defenseStat = data.stats.find((s: any) => s.stat.name === 'defense').base_stat;

    // Convert stats to YGO scale (e.g., base stat 100 = 1000 ATK, capped at 3000 roughly)
    const attack = Math.min(Math.round((attackStat / 100) * 2000), 4000);
    const defense = Math.min(Math.round((defenseStat / 100) * 2000), 4000);
    const hp = Math.min(Math.round((hpStat / 100) * 2000), 4000);

    const type = data.types[0].type.name; // Primary type
    const ability = data.abilities[0]?.ability?.name || 'None';

    // Rarity logic based on base experience
    let rarity: PokemonCard['rarity'] = 'common';
    if (data.base_experience > 250) rarity = 'legendary';
    else if (data.base_experience > 200) rarity = 'epic';
    else if (data.base_experience > 150) rarity = 'rare';
    else if (data.base_experience > 100) rarity = 'uncommon';

    return {
      id: 0, // Will be set by our DB
      pokeapi_id: data.id,
      name: data.name,
      image_url: data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
      type: type,
      attack: attack,
      defense: defense,
      hp: hp,
      special_ability: ability,
      rarity: rarity,
      description: `A ${type} type Pokémon. Base Experience: ${data.base_experience}`
    };
  }
}
