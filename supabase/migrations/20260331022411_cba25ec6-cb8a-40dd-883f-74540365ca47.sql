ALTER TABLE public.daily_player_predictions 
ADD COLUMN IF NOT EXISTS bet_amount text NULL,
ADD COLUMN IF NOT EXISTS payout text NULL;