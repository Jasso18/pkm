export interface PokemonCard {
  id: number;
  pokeapi_id: number;
  name: string;
  image_url: string;
  type: string;
  attack: number;
  defense: number;
  hp: number;
  special_ability?: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  description: string;
}

export interface Deck {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  cards?: PokemonCard[];
}

export interface CardState extends PokemonCard {
  instance_id: string; // Unique ID for this specific card in a match
  current_hp: number;
  is_active: boolean;
  can_attack: boolean;
  position: 'attack' | 'defense';
  turns_on_field: number;
  ability_used: boolean;
}
