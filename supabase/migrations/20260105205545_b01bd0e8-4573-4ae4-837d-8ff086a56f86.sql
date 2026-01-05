-- Make client_email nullable in quotes table
ALTER TABLE quotes ALTER COLUMN client_email DROP NOT NULL;