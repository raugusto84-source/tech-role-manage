-- Enable pgcrypto for gen_random_bytes / gen_random_uuid
create extension if not exists pgcrypto with schema public;

-- (Optional) ensure uuid-ossp if some objects depend on it
create extension if not exists "uuid-ossp" with schema public;