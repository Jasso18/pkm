import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { inject } from '@angular/core';
import { PokeapiService } from './pokeapi.service';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  public currentUser = signal<User | null>(null);
  public initialized: Promise<void>;
  private resolveInitialized!: () => void;
  private pokeapi = inject(PokeapiService, { optional: true });

  get client(): SupabaseClient {
    return this.supabase;
  }

  constructor() {
    this.initialized = new Promise((resolve) => {
      this.resolveInitialized = resolve;
    });

    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
    
    // Check initial session
    this.supabase.auth.getSession().then(({ data: { session } }) => {
      this.currentUser.set(session?.user ?? null);
      this.resolveInitialized();
    });

    // Listen to auth changes
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.currentUser.set(session?.user ?? null);
    });
  }

  // Auth Methods
  async signInWithEmail(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  async signUpWithEmail(email: string, password: string) {
    return this.supabase.auth.signUp({ email, password });
  }

  async signInWithGoogle() {
    return this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/main'
      }
    });
  }

  async signOut() {
    return this.supabase.auth.signOut();
  }

  async resetPassword(email: string) {
    return this.supabase.auth.resetPasswordForEmail(email);
  }

  // DB Methods
  async getProfile() {
    const user = this.currentUser();
    if (!user) throw new Error('Not logged in');
    return this.supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
  }

  async getPlayerStats() {
    const user = this.currentUser();
    if (!user) throw new Error('Not logged in');
    return this.supabase
      .from('player_statistics')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
  }

  async getUserCollection() {
    const user = this.currentUser();
    if (!user) throw new Error('Not logged in');
    return this.supabase
      .from('user_card_collection')
      .select('card_id, quantity, pokemon_cards(*)')
      .eq('user_id', user.id);
  }

  async grantStarterCards(cards: any[]) {
    const user = this.currentUser();
    if (!user) throw new Error('Not logged in');

    // 1. Upsert into pokemon_cards cache
    const dbCards = cards.map(c => ({
      pokeapi_id: c.pokeapi_id,
      name: c.name,
      image_url: c.image_url,
      type: c.type,
      attack: c.attack,
      defense: c.defense,
      hp: c.hp,
      special_ability: c.special_ability,
      rarity: c.rarity,
      description: c.description
    }));

    const { data: insertedCards, error: insertError } = await this.supabase
      .from('pokemon_cards')
      .upsert(dbCards, { onConflict: 'pokeapi_id' })
      .select();

    if (insertError) throw insertError;

    // 2. Insert into user_card_collection
    const collectionData = insertedCards.map(c => ({
      user_id: user.id,
      card_id: c.id,
      quantity: 1
    }));

    const { error: collError } = await this.supabase
      .from('user_card_collection')
      .upsert(collectionData, { onConflict: 'user_id, card_id' });

    if (collError) throw collError;
  }

  async saveDeck(name: string, startingHandIds: number[], deckIds: number[]) {
    const user = this.currentUser();
    if (!user) throw new Error('Not logged in');

    // Basic logic: Upsert a single active deck for now
    const { data: deck, error: deckError } = await this.supabase
      .from('decks')
      .upsert({ user_id: user.id, name, is_active: true }, { onConflict: 'id' }) // wait, UUID is generated. We need to find the active deck first
      .select()
      .single();

    // To be safe, delete all active decks and recreate
    await this.supabase.from('decks').delete().eq('user_id', user.id);
    
    const { data: newDeck, error: newDeckError } = await this.supabase
      .from('decks')
      .insert({ user_id: user.id, name, is_active: true })
      .select()
      .single();

    if (newDeckError || !newDeck) throw newDeckError;

    const deckCardsData = [];
    for (const cid of startingHandIds) {
      deckCardsData.push({ deck_id: newDeck.id, card_id: cid, is_starting_hand: true, quantity: 1 });
    }
    for (const cid of deckIds) {
      deckCardsData.push({ deck_id: newDeck.id, card_id: cid, is_starting_hand: false, quantity: 1 });
    }

    const { error: dcError } = await this.supabase
      .from('deck_cards')
      .insert(deckCardsData);

    if (dcError) throw dcError;
  }

  async loadActiveDeck() {
    const user = this.currentUser();
    if (!user) throw new Error('Not logged in');

    const { data: deck } = await this.supabase
      .from('decks')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!deck) return { startingHand: [], deckCards: [] };

    const { data: cards } = await this.supabase
      .from('deck_cards')
      .select('is_starting_hand, pokemon_cards(*)')
      .eq('deck_id', deck.id);

    if (!cards) return { startingHand: [], deckCards: [] };

    const startingHand = cards.filter(c => c.is_starting_hand).map(c => c.pokemon_cards);
    const deckCards = cards.filter(c => !c.is_starting_hand).map(c => c.pokemon_cards);

    return { startingHand, deckCards };
  }
  async addXp(amount: number) {
    const user = this.currentUser();
    if (!user) return;
    try {
      const { data: stats } = await this.supabase.from('player_statistics').select('xp, level').eq('user_id', user.id).maybeSingle();
      
      let newXp = amount;
      let newLevel = 1;
      let oldLevel = 1;

      if (stats) {
        oldLevel = stats.level || 1;
        newXp = stats.xp + amount;
        newLevel = Math.floor(newXp / 100) + 1;
        
        const { error } = await this.supabase.from('player_statistics')
          .update({ xp: newXp, level: newLevel })
          .eq('user_id', user.id);
        
        if (error) console.error('Update XP error', error);
      } else {
        const { error } = await this.supabase.from('player_statistics')
          .insert({ user_id: user.id, xp: newXp, level: newLevel });
          
        if (error) console.error('Insert XP error', error);
      }
      
      if (newLevel > oldLevel && this.pokeapi) {
        const rewardCards = [];
        const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        for (let i = oldLevel + 1; i <= newLevel; i++) {
          const nextCardId = 906 + i;
          if (nextCardId <= 1025) {
            const card = await this.pokeapi.getPokemonCard(nextCardId);
            card.rarity = rarities[Math.floor(Math.random() * rarities.length)] as any;
            rewardCards.push(card);
          }
        }
        if (rewardCards.length > 0) {
          await this.grantStarterCards(rewardCards);
        }
      }
    } catch (e) {
      console.error('Error adding XP', e);
    }
  }

  async saveMatchResult(matchId: string | null, winnerId: string | null, loserId: string | null, isLocal: boolean, opponentName: string, reason: string): Promise<boolean> {
    const user = this.currentUser();
    if (!user) return false;

    const formattedReason = `[${isLocal ? 'Local' : 'Online'} vs ${opponentName}] ${reason}`;

    const { error } = await this.supabase
      .from('match_results')
      .insert({
        winner_id: winnerId,
        loser_id: loserId,
        reason: formattedReason
      });
      
    if (error) {
      console.error('Error saving match result', error);
      return false;
    }
    return true;
  }

  async updatePlayerStatsResult(userId: string, resultType: 'win' | 'loss' | 'draw') {
    try {
      const { data: stats } = await this.supabase.from('player_statistics').select('wins, losses, draws').eq('user_id', userId).single();
      if (stats) {
        let updateData: any = {};
        if (resultType === 'win') updateData.wins = stats.wins + 1;
        if (resultType === 'loss') updateData.losses = stats.losses + 1;
        if (resultType === 'draw') updateData.draws = stats.draws + 1;
        
        await this.supabase.from('player_statistics').update(updateData).eq('user_id', userId);
      }
    } catch (e) {
      console.error('Error updating player stats result', e);
    }
  }

  async getMatchHistory() {
    const user = this.currentUser();
    if (!user) return [];
    
    const { data, error } = await this.supabase
      .from('match_results')
      .select('*, winner:user_profiles!winner_id(username), loser:user_profiles!loser_id(username)')
      .or(`winner_id.eq.${user.id},loser_id.eq.${user.id}`)
      .order('completed_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching match history', error);
      return [];
    }
    return data || [];
  }
}
