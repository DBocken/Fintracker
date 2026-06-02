-- Add preferred_market_provider column to user_settings table
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS preferred_market_provider TEXT DEFAULT 'yahoo';

-- Add check constraint to ensure only valid values
ALTER TABLE user_settings 
ADD CONSTRAINT preferred_market_provider_check 
CHECK (preferred_market_provider IN ('yahoo', 'etoro'));

-- Update existing records to have the default value
UPDATE user_settings 
SET preferred_market_provider = 'yahoo' 
WHERE preferred_market_provider IS NULL;
