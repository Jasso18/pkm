-- Supabase Database Schema for Pokémon/Yu-Gi-Oh inspired TCG

-- 1. Profiles (extends auth.users)
CREATE TABLE public.user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Player Statistics
CREATE TABLE public.player_statistics (
  user_id UUID REFERENCES public.user_profiles(id) PRIMARY KEY,
  level INTEGER DEFAULT 1 CHECK (level <= 120),
  xp INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  rank_points INTEGER DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Pokemon Cards (Cached data from PokéAPI)
CREATE TABLE public.pokemon_cards (
  id SERIAL PRIMARY KEY,
  pokeapi_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  type TEXT NOT NULL,
  attack INTEGER NOT NULL,
  defense INTEGER NOT NULL,
  hp INTEGER NOT NULL,
  special_ability TEXT,
  rarity TEXT DEFAULT 'common',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. User Card Collection
CREATE TABLE public.user_card_collection (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  card_id INTEGER REFERENCES public.pokemon_cards(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, card_id)
);

-- 5. Decks
CREATE TABLE public.decks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Deck Cards
CREATE TABLE public.deck_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deck_id UUID REFERENCES public.decks(id) ON DELETE CASCADE,
  card_id INTEGER REFERENCES public.pokemon_cards(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0 AND quantity <= 3),
  is_starting_hand BOOLEAN DEFAULT false,
  UNIQUE(deck_id, card_id)
);

-- 7. Game Rooms
CREATE TABLE public.game_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID REFERENCES public.user_profiles(id),
  guest_id UUID REFERENCES public.user_profiles(id),
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Online Matches
CREATE TABLE public.online_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.game_rooms(id),
  host_state JSONB,
  guest_state JSONB,
  current_turn_user_id UUID REFERENCES public.user_profiles(id),
  phase TEXT DEFAULT 'draw' CHECK (phase IN ('draw', 'main', 'attack', 'end')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Match Turns
CREATE TABLE public.match_turns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES public.online_matches(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  player_id UUID REFERENCES public.user_profiles(id),
  action_type TEXT NOT NULL,
  action_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Match Results
CREATE TABLE public.match_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES public.online_matches(id) ON DELETE CASCADE,
  winner_id UUID REFERENCES public.user_profiles(id),
  loser_id UUID REFERENCES public.user_profiles(id),
  is_local BOOLEAN DEFAULT false,
  opponent_name TEXT,
  reason TEXT,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Achievements
CREATE TABLE public.achievements (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_url TEXT
);

CREATE TABLE public.user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  achievement_id INTEGER REFERENCES public.achievements(id),
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- 12. Notifications
CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Chat Messages
CREATE TABLE public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Missions
CREATE TABLE public.missions (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target_count INTEGER NOT NULL,
  reward_type TEXT CHECK (reward_type IN ('xp', 'card_rare', 'card_epic', 'card_legendary')),
  reward_amount INTEGER DEFAULT 1
);

CREATE TABLE public.user_missions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  mission_id INTEGER REFERENCES public.missions(id),
  current_progress INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  claimed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, mission_id)
);

-- RLS & Security setup (Basic examples)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_card_collection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone."
  ON public.user_profiles FOR SELECT
  USING ( true );

CREATE POLICY "Users can update own profile."
  ON public.user_profiles FOR UPDATE
  USING ( auth.uid() = id );

CREATE POLICY "Users can view their own decks."
  ON public.decks FOR SELECT
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can manage their own decks."
  ON public.decks FOR ALL
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can view their own collection."
  ON public.user_card_collection FOR SELECT
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can manage their own collection."
  ON public.user_card_collection FOR ALL
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can manage their own deck cards."
  ON public.deck_cards FOR ALL
  USING ( deck_id IN (SELECT id FROM public.decks WHERE user_id = auth.uid()) );

-- Trigger for creating user profile after auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username)
  VALUES (new.id, split_part(new.email, '@', 1));
  
  INSERT INTO public.player_statistics (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
