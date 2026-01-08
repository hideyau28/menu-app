create extension if not exists "uuid-ossp";

create table trips (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  trip_code text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table members (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid not null references trips(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table expenses (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid not null references trips(id) on delete cascade,
  title text not null,
  category text,
  note text,
  payer_member_id uuid not null references members(id),
  total_amount_hkd_cents integer not null,
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table expense_participants (
  expense_id uuid not null references expenses(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  primary key (expense_id, member_id)
);

create index idx_members_trip_id on members(trip_id);
create index idx_expenses_trip_id on expenses(trip_id);
create index idx_expenses_date on expenses(date);
create index idx_trips_code on trips(trip_code);
