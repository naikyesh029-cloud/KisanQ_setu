-- KisanQ core schema. Apply with Supabase CLI: supabase db push
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

do $$ begin create type public.app_role as enum ('farmer','buyer','inspector','supervisor'); exception when duplicate_object then null; end $$;
do $$ begin create type public.lot_status as enum ('draft','listed','reserved','checked_in','inspected','sold','withdrawn','expired'); exception when duplicate_object then null; end $$;
do $$ begin create type public.offer_status as enum ('active','accepted','rejected','withdrawn','expired'); exception when duplicate_object then null; end $$;
do $$ begin create type public.token_status as enum ('reserved','checked_in','cancelled','completed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.dispute_status as enum ('open','under_review','resolved','rejected','withdrawn'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 role public.app_role not null default 'farmer',
 phone text,
 display_name text not null default 'KisanQ user',
 language_pref text not null default 'en' check(language_pref in ('en','hi','mr')),
 consent_version text,
 consent_at timestamptz,
 mandi_scope uuid[],
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles(role);

-- Signup metadata is deliberately ignored: public clients cannot self-assign privileged roles.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id, role, phone, display_name)
 values(new.id, 'farmer', new.phone, coalesce(nullif(new.raw_user_meta_data->>'display_name',''),'KisanQ farmer'))
 on conflict(id) do nothing;
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.guard_profile_update() returns trigger language plpgsql as $$
begin
 if auth.uid() is not null and auth.uid() = old.id then
  if new.role is distinct from old.role or new.consent_version is distinct from old.consent_version or new.consent_at is distinct from old.consent_at or new.mandi_scope is distinct from old.mandi_scope then
   raise exception 'Protected profile fields cannot be changed by the account holder';
  end if;
 end if;
 new.updated_at := now(); return new;
end; $$;
drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update before update on public.profiles for each row execute function public.guard_profile_update();

create table if not exists public.mandis (
 id uuid primary key default gen_random_uuid(), name text not null, district text not null, state text not null default 'Maharashtra',
 location_label text, capacity_per_slot integer not null default 0 check(capacity_per_slot>=0), storage_capacity numeric check(storage_capacity is null or storage_capacity>=0),
 storage_occupied numeric check(storage_occupied is null or storage_occupied>=0), active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.crop_profiles (
 crop_key text primary key, display_name text not null, offer_window_hours integer not null check(offer_window_hours between 1 and 168),
 perishability_group text not null check(perishability_group in ('very_perishable','perishable','storable','unknown')),
 notes text not null default 'Configurable operational default; not a scientific shelf-life claim.', updated_at timestamptz not null default now()
);
insert into public.crop_profiles(crop_key,display_name,offer_window_hours,perishability_group) values
 ('spinach','Spinach',3,'very_perishable'),('leafy vegetables','Leafy vegetables',3,'very_perishable'),('coriander','Coriander',3,'very_perishable'),
 ('tomato','Tomato',8,'perishable'),('onion','Onion',8,'perishable'),('potato','Potato',8,'perishable'),
 ('paddy','Paddy',48,'storable'),('wheat','Wheat',48,'storable'),('soybean','Soybean',48,'storable'),('cotton','Cotton',48,'storable')
on conflict(crop_key) do nothing;

create table if not exists public.crop_lots (
 id uuid primary key default gen_random_uuid(), farmer_id uuid not null references public.profiles(id) on delete restrict,
 crop text not null check(length(trim(crop)) between 2 and 80), variety text not null,
 area numeric not null check(area>0), area_unit text not null check(area_unit in ('acre','hectare')),
 harvest_date date not null, quantity numeric not null check(quantity>0), unit text not null check(unit in ('kg','quintal','tonne')),
 condition text not null check(condition in ('excellent','good','fair','needs_review')),
 mandi_id uuid not null references public.mandis(id) on delete restrict, status public.lot_status not null default 'listed',
 photo_path text, moisture_pct numeric check(moisture_pct between 0 and 100), asking_price numeric check(asking_price is null or asking_price>0), description text,
 ai_pregrade text, ai_pregrade_confidence numeric check(ai_pregrade_confidence between 0 and 100), grading_method text, grading_metadata jsonb,
 verified_grade text, verified_weight numeric check(verified_weight is null or verified_weight>0), verified_moisture_pct numeric check(verified_moisture_pct between 0 and 100),
 offer_expires_at timestamptz, best_offer_id uuid, consent_recorded_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists crop_lots_market_idx on public.crop_lots(status,mandi_id,crop,created_at desc);
create index if not exists crop_lots_farmer_idx on public.crop_lots(farmer_id,created_at desc);
create index if not exists crop_lots_expiry_idx on public.crop_lots(offer_expires_at) where status='listed';

create table if not exists public.slots (
 id uuid primary key default gen_random_uuid(), mandi_id uuid not null references public.mandis(id) on delete restrict,
 slot_date date not null, starts_at time not null, ends_at time not null, capacity integer not null check(capacity>=0),
 booked_count integer not null default 0 check(booked_count>=0 and booked_count<=capacity), status text not null default 'open' check(status in ('open','full','closed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(mandi_id,slot_date,starts_at), check(ends_at>starts_at)
);
create table if not exists public.tokens (
 id uuid primary key default gen_random_uuid(), lot_id uuid not null unique references public.crop_lots(id) on delete restrict,
 slot_id uuid not null references public.slots(id) on delete restrict, token_code text not null unique,
 status public.token_status not null default 'reserved', check_in_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists tokens_slot_idx on public.tokens(slot_id,status);

create table if not exists public.offers (
 id uuid primary key default gen_random_uuid(), lot_id uuid not null references public.crop_lots(id) on delete restrict,
 buyer_id uuid not null references public.profiles(id) on delete restrict, price_per_unit numeric not null check(price_per_unit>0),
 status public.offer_status not null default 'active', expires_at timestamptz not null default (now()+interval '24 hours'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists offers_lot_active_idx on public.offers(lot_id,status,price_per_unit desc,created_at asc);
create index if not exists offers_buyer_idx on public.offers(buyer_id,created_at desc);

alter table public.crop_lots drop constraint if exists crop_lots_best_offer_fk;
alter table public.crop_lots add constraint crop_lots_best_offer_fk foreign key(best_offer_id) references public.offers(id) on delete set null;

create table if not exists public.price_history (
 id uuid primary key default gen_random_uuid(), mandi_id uuid references public.mandis(id) on delete restrict,
 crop text not null, observed_on date not null, minimum_price numeric not null check(minimum_price>=0),
 maximum_price numeric not null check(maximum_price>=minimum_price), modal_price numeric not null check(modal_price between minimum_price and maximum_price),
 source text not null, source_url text, provenance text not null check(provenance in ('verified_source','simulated_demo')),
 created_at timestamptz not null default now(), unique(mandi_id,crop,observed_on,source)
);
create index if not exists price_history_crop_date_idx on public.price_history(crop,observed_on desc);

create table if not exists public.inspections (
 id uuid primary key default gen_random_uuid(), lot_id uuid not null references public.crop_lots(id) on delete restrict,
 inspector_id uuid not null references public.profiles(id) on delete restrict, verified_grade text not null check(verified_grade in ('A','B','C','rejected')),
 verified_weight numeric not null check(verified_weight>0), moisture_pct numeric check(moisture_pct between 0 and 100), condition text,
 reason_code text check(reason_code is null or reason_code in ('estimate_mismatch','weight_correction','moisture_correction','physical_condition','other')),
 explanation text, estimate_before jsonb, values_before jsonb, created_at timestamptz not null default now()
);
create index if not exists inspections_lot_idx on public.inspections(lot_id,created_at desc);

create table if not exists public.disputes (
 id uuid primary key default gen_random_uuid(), lot_id uuid references public.crop_lots(id) on delete restrict,
 offer_id uuid references public.offers(id) on delete restrict, raised_by uuid not null references public.profiles(id) on delete restrict,
 assigned_inspector uuid references public.profiles(id) on delete set null, reason_code text not null check(reason_code in ('quality','weight','payment','offer_process','token_slot','other')),
 description text not null check(length(trim(description))>=8), evidence_paths text[] not null default '{}', status public.dispute_status not null default 'open',
 resolution text, resolved_by uuid references public.profiles(id) on delete set null, resolved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(lot_id is not null or offer_id is not null)
);
create index if not exists disputes_status_idx on public.disputes(status,created_at desc);

create table if not exists public.audit_events (
 sequence bigint generated always as identity primary key, id uuid not null default gen_random_uuid() unique,
 entity_type text not null, entity_id uuid, actor_id uuid references public.profiles(id) on delete set null,
 action text not null, reason_code text, event_payload jsonb not null,
 previous_hash text not null, current_hash text not null, created_at timestamptz not null default now()
);
create index if not exists audit_events_entity_idx on public.audit_events(entity_type,entity_id,sequence);

-- Recursive stable JSON serialization with lexicographically sorted object keys; shared by writer/verifier.
create or replace function public.canonical_jsonb(value jsonb) returns text language plpgsql immutable strict as $$
declare kind text; result text;
begin
 kind := jsonb_typeof(value);
 if kind='object' then
  select '{'||coalesce(string_agg(to_json(key)::text||':'||public.canonical_jsonb(val),',' order by key collate "C"),'')||'}' into result from jsonb_each(value) as e(key,val);
  return result;
 elsif kind='array' then
  select '['||coalesce(string_agg(public.canonical_jsonb(val),',' order by ord),'')||']' into result from jsonb_array_elements(value) with ordinality as e(val,ord);
  return result;
 elsif kind='number' then return trim_scale((value #>> '{}')::numeric)::text;
 else return value::text;
 end if;
end; $$;

create or replace function public.append_audit_event(p_entity_type text,p_entity_id uuid,p_action text,p_payload jsonb,p_reason_code text default null)
returns public.audit_events language plpgsql security definer set search_path=public,extensions as $$
declare previous text; next_sequence bigint; event_hash text; inserted public.audit_events;
begin
 -- Serialize ledger writers globally so concurrent appends cannot fork the chain.
 perform pg_advisory_xact_lock(hashtext('kisanq_audit_ledger'));
 select current_hash,sequence+1 into previous,next_sequence from public.audit_events order by sequence desc limit 1;
 if previous is null then previous := 'KISANQ_LEDGER_GENESIS_V1'; next_sequence := 1; end if;
 event_hash := encode(extensions.digest(convert_to(previous||public.canonical_jsonb(p_payload),'UTF8'),'sha256'),'hex');
 insert into public.audit_events(sequence,entity_type,entity_id,actor_id,action,reason_code,event_payload,previous_hash,current_hash)
 overriding system value values(next_sequence,p_entity_type,p_entity_id,auth.uid(),p_action,p_reason_code,p_payload,previous,event_hash) returning * into inserted;
 return inserted;
end; $$;
revoke all on function public.append_audit_event(text,uuid,text,jsonb,text) from public, anon, authenticated;
-- Mutations go through narrowly scoped domain RPCs/server-side policies; the ledger itself is immutable.
create or replace function public.reject_audit_mutation() returns trigger language plpgsql as $$ begin raise exception 'Audit ledger is append-only'; end; $$;
drop trigger if exists audit_events_no_update on public.audit_events;
create trigger audit_events_no_update before update or delete on public.audit_events for each row execute function public.reject_audit_mutation();

create or replace function public.reserve_slot(p_lot_id uuid,p_slot_id uuid) returns public.tokens language plpgsql security definer set search_path=public as $$
declare actor uuid := auth.uid(); lot public.crop_lots; chosen_slot public.slots; new_token public.tokens; code text;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 if public.current_app_role() is distinct from 'farmer'::public.app_role then raise exception 'Farmer role required'; end if;
 select * into lot from public.crop_lots where id=p_lot_id for update;
 if lot.id is null or lot.farmer_id<>actor or lot.status not in ('listed','draft') then raise exception 'Lot is unavailable for reservation'; end if;
 select * into chosen_slot from public.slots where id=p_slot_id and mandi_id=lot.mandi_id for update;
 if chosen_slot.id is null or chosen_slot.status<>'open' or chosen_slot.booked_count>=chosen_slot.capacity then raise exception 'Slot is full or unavailable'; end if;
 update public.slots set booked_count=booked_count+1,status=case when booked_count+1>=capacity then 'full' else 'open' end,updated_at=now() where id=p_slot_id;
 code := 'KQ-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
 insert into public.tokens(lot_id,slot_id,token_code) values(p_lot_id,p_slot_id,code) returning * into new_token;
 update public.crop_lots set status='reserved',updated_at=now() where id=p_lot_id;
 perform public.append_audit_event('token',new_token.id,'slot_reserved',jsonb_build_object('lot_id',p_lot_id,'slot_id',p_slot_id,'token_code',code));
 return new_token;
end; $$;
revoke all on function public.reserve_slot(uuid,uuid) from public, anon;
grant execute on function public.reserve_slot(uuid,uuid) to authenticated;

-- SECURITY DEFINER role lookup avoids recursive RLS checks when policies need the current role.
create or replace function public.current_app_role() returns public.app_role language sql stable security definer set search_path=public as $$
 select role from public.profiles where id=auth.uid() limit 1; $$;
revoke all on function public.current_app_role() from public; grant execute on function public.current_app_role() to authenticated;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.mandis enable row level security;
alter table public.crop_profiles enable row level security;
alter table public.crop_lots enable row level security;
alter table public.slots enable row level security;
alter table public.tokens enable row level security;
alter table public.offers enable row level security;
alter table public.price_history enable row level security;
alter table public.inspections enable row level security;
alter table public.disputes enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists profiles_read_self_or_inspector on public.profiles;
create policy profiles_read_self_or_inspector on public.profiles for select to authenticated using (id=auth.uid() or public.current_app_role() in ('inspector','supervisor'));
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
drop policy if exists mandis_read_active on public.mandis;
create policy mandis_read_active on public.mandis for select to authenticated using(active=true);
drop policy if exists crop_profiles_read on public.crop_profiles;
create policy crop_profiles_read on public.crop_profiles for select to authenticated using(true);
drop policy if exists lots_farmer_select on public.crop_lots;
create policy lots_farmer_select on public.crop_lots for select to authenticated using(farmer_id=auth.uid() or status in ('listed','reserved','checked_in','inspected') or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='supervisor') or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='inspector' and (p.mandi_scope is not null and mandi_id=any(p.mandi_scope))));
drop policy if exists lots_farmer_insert on public.crop_lots;
create policy lots_farmer_insert on public.crop_lots for insert to authenticated with check(farmer_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='farmer'));
drop policy if exists lots_farmer_update on public.crop_lots;
create policy lots_farmer_update on public.crop_lots for update to authenticated using(farmer_id=auth.uid() and status in ('draft','listed')) with check(farmer_id=auth.uid());
drop policy if exists slots_read on public.slots;
create policy slots_read on public.slots for select to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and (p.role='supervisor' or p.role='inspector' and (p.mandi_scope is not null and mandi_id=any(p.mandi_scope)) or p.role in ('farmer','buyer'))));
drop policy if exists tokens_read_scope on public.tokens;
create policy tokens_read_scope on public.tokens for select to authenticated using(exists(select 1 from public.crop_lots l where l.id=lot_id and (l.farmer_id=auth.uid() or l.status in ('listed','reserved','checked_in','inspected'))) or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('inspector','supervisor')));
drop policy if exists offers_read_scope on public.offers;
create policy offers_read_scope on public.offers for select to authenticated using(buyer_id=auth.uid() or exists(select 1 from public.crop_lots l where l.id=lot_id and l.farmer_id=auth.uid()) or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('inspector','supervisor')));
drop policy if exists offers_buyer_insert on public.offers;
create policy offers_buyer_insert on public.offers for insert to authenticated with check(buyer_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='buyer') and exists(select 1 from public.crop_lots l where l.id=lot_id and l.status='listed' and (l.offer_expires_at is null or l.offer_expires_at>now())));
drop policy if exists offers_buyer_update on public.offers;
create policy offers_buyer_update on public.offers for update to authenticated using(buyer_id=auth.uid() and status='active') with check(buyer_id=auth.uid());
drop policy if exists price_history_read on public.price_history;
create policy price_history_read on public.price_history for select to authenticated using(true);
drop policy if exists inspections_read_scope on public.inspections;
create policy inspections_read_scope on public.inspections for select to authenticated using(exists(select 1 from public.crop_lots l where l.id=lot_id and l.farmer_id=auth.uid()) or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('inspector','supervisor')));
drop policy if exists inspections_insert_inspector on public.inspections;
create policy inspections_insert_inspector on public.inspections for insert to authenticated with check(inspector_id=auth.uid() and exists(select 1 from public.profiles p join public.crop_lots l on l.id=lot_id where p.id=auth.uid() and p.role in ('inspector','supervisor') and (p.role='supervisor' or p.mandi_scope is not null and l.mandi_id=any(p.mandi_scope))));
drop policy if exists disputes_read_scope on public.disputes;
create policy disputes_read_scope on public.disputes for select to authenticated using(raised_by=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('inspector','supervisor') and (p.role='supervisor' or (p.mandi_scope is not null and exists(select 1 from public.crop_lots l where l.id=lot_id and l.mandi_id=any(p.mandi_scope))))));
drop policy if exists disputes_insert_user on public.disputes;
create policy disputes_insert_user on public.disputes for insert to authenticated with check(raised_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('farmer','buyer')));
drop policy if exists disputes_update_inspector on public.disputes;
create policy disputes_update_inspector on public.disputes for update to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and (p.role='supervisor' or (p.role='inspector' and p.mandi_scope is not null and exists(select 1 from public.crop_lots l where l.id=lot_id and l.mandi_id=any(p.mandi_scope)))))) with check(status in ('open','under_review','resolved','rejected','withdrawn'));
drop policy if exists audit_events_inspector_read on public.audit_events;
create policy audit_events_inspector_read on public.audit_events for select to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('inspector','supervisor')));
-- No client insert/update/delete policies on audit_events; only privileged, narrowly controlled RPCs may append.

-- Keep provenance read-only to clients: there are deliberately no client write policies on price_history/crop_profiles/mandis.
