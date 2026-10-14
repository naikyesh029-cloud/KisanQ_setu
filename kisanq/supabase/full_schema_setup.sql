-- ==============================================================================
-- KisanQ Complete Consolidated Schema Setup (0001 - 0011 + Fixes)
-- Paste and run this ONE script in the Supabase Dashboard SQL Editor.
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- 2. CUSTOM TYPES
do $$ begin create type public.app_role as enum ('farmer','buyer','inspector','supervisor'); exception when duplicate_object then null; end $$;
do $$ begin create type public.lot_status as enum ('draft','listed','reserved','checked_in','inspected','sold','withdrawn','expired'); exception when duplicate_object then null; end $$;
do $$ begin create type public.offer_status as enum ('active','awaiting_farmer','accepted','rejected','withdrawn','expired'); exception when duplicate_object then null; end $$;
alter type public.offer_status add value if not exists 'awaiting_farmer';
do $$ begin create type public.token_status as enum ('reserved','checked_in','cancelled','completed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.dispute_status as enum ('open','under_review','resolved','rejected','withdrawn'); exception when duplicate_object then null; end $$;

-- 3. CORE TABLES
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 role public.app_role not null default 'farmer',
 phone text,
 display_name text not null default 'KisanQ user',
 language_pref text not null default 'en' check(language_pref in ('en','hi','mr')),
 consent_version text,
 consent_at timestamptz,
 mandi_scope uuid[],
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles(role);

create table if not exists public.mandis (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 district text not null,
 state text not null default 'Maharashtra',
 location_label text,
 capacity_per_slot integer not null default 0 check(capacity_per_slot>=0),
 storage_capacity numeric check(storage_capacity is null or storage_capacity>=0),
 storage_occupied numeric check(storage_occupied is null or storage_occupied>=0),
 active boolean not null default true,
 created_at timestamptz not null default now()
);

create table if not exists public.crop_profiles (
 crop_key text primary key,
 display_name text not null,
 offer_window_hours integer not null check(offer_window_hours between 1 and 168),
 perishability_group text not null check(perishability_group in ('very_perishable','perishable','storable','unknown','high','medium','low')),
 notes text not null default 'Configurable operational default; not a scientific shelf-life claim.',
 updated_at timestamptz not null default now()
);
alter table public.crop_profiles add column if not exists notes text not null default 'Configurable operational default; not a scientific shelf-life claim.';
alter table public.crop_profiles add column if not exists updated_at timestamptz not null default now();
alter table public.crop_profiles drop constraint if exists crop_profiles_perishability_group_check;
alter table public.crop_profiles add constraint crop_profiles_perishability_group_check check(perishability_group in ('very_perishable','perishable','storable','unknown','high','medium','low'));


create table if not exists public.crop_lots (
 id uuid primary key default gen_random_uuid(),
 farmer_id uuid not null references public.profiles(id) on delete restrict,
 crop text not null,
 variety text not null,
 area numeric not null check(area>0),
 area_unit text not null default 'acre' check(area_unit in ('acre','hectare')),
 harvest_date date not null,
 quantity numeric not null check(quantity>0),
 unit text not null default 'quintal' check(unit in ('quintal','kg','tonne')),
 condition text not null check(condition in ('excellent','good','fair','needs_review')),
 mandi_id uuid not null references public.mandis(id) on delete restrict,
 moisture_pct numeric check(moisture_pct is null or (moisture_pct>=0 and moisture_pct<=100)),
 verified_moisture_pct numeric check(verified_moisture_pct is null or (verified_moisture_pct>=0 and verified_moisture_pct<=100)),
 asking_price numeric check(asking_price is null or asking_price>0),
 ai_pregrade text,
 ai_pregrade_confidence numeric check(ai_pregrade_confidence between 0 and 100),
 grading_method text,
 grading_metadata jsonb,
 verified_grade text check(verified_grade is null or verified_grade in ('A','B','C','rejected')),
 verified_weight numeric check(verified_weight is null or verified_weight>0),
 status public.lot_status not null default 'listed',
 offer_expires_at timestamptz,
 expiry_processed_at timestamptz,
 best_offer_id uuid,
 consent_recorded_at timestamptz not null default now(),
 description text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists crop_lots_farmer_idx on public.crop_lots(farmer_id);
create index if not exists crop_lots_mandi_idx on public.crop_lots(mandi_id);
create index if not exists crop_lots_status_idx on public.crop_lots(status);
create index if not exists crop_lots_crop_created_idx on public.crop_lots(lower(crop), created_at);
alter table public.crop_lots add column if not exists expiry_processed_at timestamptz;
alter table public.crop_lots add column if not exists ai_pregrade text;
alter table public.crop_lots add column if not exists ai_pregrade_confidence numeric;
alter table public.crop_lots add column if not exists grading_method text;
alter table public.crop_lots add column if not exists grading_metadata jsonb;

create table if not exists public.slots (
 id uuid primary key default gen_random_uuid(),
 mandi_id uuid not null references public.mandis(id) on delete cascade,
 slot_date date not null,
 starts_at time not null,
 ends_at time not null,
 capacity integer not null check(capacity>0),
 booked_count integer not null default 0 check(booked_count>=0),
 status text not null default 'open' check(status in ('open','full','cancelled','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint slots_time_check check (ends_at > starts_at)
);
create index if not exists slots_mandi_date_idx on public.slots(mandi_id,slot_date);
alter table public.slots drop constraint if exists slots_status_check;
alter table public.slots add constraint slots_status_check check(status in ('open','full','cancelled','closed'));
alter table public.slots add column if not exists updated_at timestamptz not null default now();

create table if not exists public.tokens (
 id uuid primary key default gen_random_uuid(),
 lot_id uuid not null unique references public.crop_lots(id) on delete cascade,
 slot_id uuid not null references public.slots(id) on delete restrict,
 token_code text not null unique,
 status public.token_status not null default 'reserved',
 check_in_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.tokens add column if not exists updated_at timestamptz not null default now();

create table if not exists public.offers (
 id uuid primary key default gen_random_uuid(),
 lot_id uuid not null references public.crop_lots(id) on delete cascade,
 buyer_id uuid not null references public.profiles(id) on delete restrict,
 price_per_unit numeric not null check(price_per_unit>0),
 status public.offer_status not null default 'active',
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists offers_lot_idx on public.offers(lot_id);
create index if not exists offers_buyer_idx on public.offers(buyer_id);
create index if not exists offers_lot_status_created_idx on public.offers(lot_id, status, created_at);

create table if not exists public.price_history (
 id uuid primary key default gen_random_uuid(),
 mandi_id uuid not null references public.mandis(id) on delete cascade,
 crop text not null,
 observed_on date not null,
 minimum_price numeric not null check(minimum_price>0),
 maximum_price numeric not null check(maximum_price>=minimum_price),
 modal_price numeric not null check(modal_price>=minimum_price and modal_price<=maximum_price),
 source text not null,
 source_url text,
 provenance text not null check(provenance in ('live_source','verified_partner','simulated_demo','verified_source')),
 created_at timestamptz not null default now(),
 unique(mandi_id,crop,observed_on,source)
);
alter table public.price_history drop constraint if exists price_history_provenance_check;
alter table public.price_history add constraint price_history_provenance_check check(provenance in ('verified_source','simulated_demo','live_source','verified_partner'));

create table if not exists public.inspections (
 id uuid primary key default gen_random_uuid(),
 lot_id uuid not null references public.crop_lots(id) on delete cascade,
 inspector_id uuid not null references public.profiles(id) on delete restrict,
 verified_grade text not null check(verified_grade in ('A','B','C','rejected')),
 verified_weight numeric not null check(verified_weight>0),
 moisture_pct numeric check(moisture_pct is null or (moisture_pct>=0 and moisture_pct<=100)),
 reason_code text not null check(reason_code in ('estimate_mismatch','weight_correction','moisture_correction','physical_condition','other')),
 explanation text not null,
 estimate_before jsonb,
 values_before jsonb,
 created_at timestamptz not null default now()
);
alter table public.inspections add column if not exists estimate_before jsonb;
alter table public.inspections add column if not exists values_before jsonb;

create table if not exists public.disputes (
 id uuid primary key default gen_random_uuid(),
 lot_id uuid not null references public.crop_lots(id) on delete cascade,
 offer_id uuid references public.offers(id) on delete restrict,
 raised_by uuid not null references public.profiles(id) on delete restrict,
 assigned_inspector uuid references public.profiles(id) on delete set null,
 reason_code text not null check(reason_code in ('quality','weight','payment','offer_process','token_slot','other')),
 description text not null,
 status public.dispute_status not null default 'open',
 resolution text,
 resolved_by uuid references public.profiles(id) on delete set null,
 resolved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
 sequence bigint generated always as identity primary key,
 id uuid not null default gen_random_uuid() unique,
 entity_type text not null,
 entity_id uuid,
 actor_id uuid references public.profiles(id) on delete set null,
 action text not null,
 reason_code text,
 event_payload jsonb not null,
 previous_hash text not null,
 current_hash text not null,
 created_at timestamptz not null default now()
);
alter table public.audit_events add column if not exists id uuid default gen_random_uuid();
alter table public.audit_events add column if not exists created_at timestamptz default now();

-- Immutable audit ledger trigger
create or replace function public.reject_audit_mutation() returns trigger language plpgsql as $$
begin
 raise exception 'Audit ledger is append-only';
end; $$;
drop trigger if exists audit_events_no_update on public.audit_events;
create trigger audit_events_no_update before update or delete on public.audit_events for each row execute function public.reject_audit_mutation();

-- 4. BASE CROP PROFILES
insert into public.crop_profiles(crop_key,display_name,offer_window_hours,perishability_group) values
 ('spinach','Spinach',3,'very_perishable'),
 ('leafy vegetables','Leafy vegetables',3,'very_perishable'),
 ('coriander','Coriander',3,'very_perishable'),
 ('lettuce','Lettuce',3,'very_perishable'),
 ('fenugreek','Fenugreek',3,'very_perishable'),
 ('tomato','Tomato',8,'perishable'),
 ('tomatoes','Tomatoes',8,'perishable'),
 ('onion','Onion',8,'perishable'),
 ('potato','Potato',8,'perishable'),
 ('brinjal','Brinjal',8,'perishable'),
 ('paddy','Paddy',48,'storable'),
 ('rice','Rice',48,'storable'),
 ('wheat','Wheat',48,'storable'),
 ('wheat grain','Wheat grain',48,'storable'),
 ('soybean','Soybean',48,'storable'),
 ('cotton','Cotton',48,'storable'),
 ('maize','Maize',48,'storable')
on conflict(crop_key) do update set
 display_name=excluded.display_name,
 offer_window_hours=excluded.offer_window_hours,
 perishability_group=excluded.perishability_group,
 updated_at=now();

-- 5. CANONICAL JSON & LEDGER HASHING (SCHEMA-QUALIFIED extensions.digest)
create or replace function public.canonical_jsonb(value jsonb) returns text language plpgsql immutable as $$
declare kind text; result text;
begin
 if value is null or jsonb_typeof(value)='null' then return 'null'; end if;
 kind := jsonb_typeof(value);
 if kind='object' then
  select '{'||coalesce(string_agg(to_json(key)::text||':'||public.canonical_jsonb(val),',' order by key collate "C"),'')||'}' into result from jsonb_each(value) as e(key,val);
  return result;
 elsif kind='array' then
  select '['||coalesce(string_agg(public.canonical_jsonb(val),',' order by ord),'')||']' into result from jsonb_array_elements(value) with ordinality as e(val,ord);
  return result;
 elsif kind='number' then
  if (value::text)::numeric=0 then return '0'; end if;
  return trim_scale((value #>> '{}')::numeric)::text;
 elsif kind='string' or kind='boolean' then
  return value::text;
 else
  return 'null';
 end if;
end; $$;

drop function if exists public.append_audit_event(text,uuid,text,jsonb,text);
create or replace function public.append_audit_event(p_entity_type text,p_entity_id uuid,p_action text,p_payload jsonb,p_reason_code text default null)
returns public.audit_events language plpgsql security definer set search_path=public,extensions as $$
declare previous text; next_sequence bigint; event_hash text; inserted public.audit_events;
begin
 perform pg_advisory_xact_lock(hashtext('kisanq_audit_ledger'));
 select current_hash,sequence+1 into previous,next_sequence from public.audit_events order by sequence desc limit 1;
 if previous is null then previous := 'KISANQ_LEDGER_GENESIS_V1'; next_sequence := 1; end if;
 event_hash := encode(extensions.digest(convert_to(previous||public.canonical_jsonb(p_payload),'UTF8'),'sha256'),'hex');
 insert into public.audit_events(sequence,entity_type,entity_id,actor_id,action,reason_code,event_payload,previous_hash,current_hash)
 overriding system value values(next_sequence,p_entity_type,p_entity_id,auth.uid(),p_action,p_reason_code,p_payload,previous,event_hash) returning * into inserted;
 return inserted;
end; $$;
revoke all on function public.append_audit_event(text,uuid,text,jsonb,text) from public, anon, authenticated;

drop function if exists public.verify_ledger_chain();
create or replace function public.verify_ledger_chain() returns jsonb language plpgsql stable security definer set search_path=public,extensions as $$
declare item record; expected_previous text:='KISANQ_LEDGER_GENESIS_V1'; expected_sequence bigint:=1; checked_count bigint:=0; expected_hash text;
begin
 if auth.uid() is null or public.current_app_role() is null or public.current_app_role() not in ('inspector','supervisor') then raise exception 'Inspector or supervisor role required'; end if;
 for item in select sequence,previous_hash,current_hash,event_payload from public.audit_events order by sequence asc loop
  checked_count:=checked_count+1;
  expected_hash:=encode(extensions.digest(convert_to(expected_previous||public.canonical_jsonb(item.event_payload),'UTF8'),'sha256'),'hex');
  if item.sequence<>expected_sequence or item.previous_hash<>expected_previous or item.current_hash<>expected_hash then
   return jsonb_build_object('valid',false,'checked',checked_count,'firstFailure',item.sequence,'completeChain',true,'scope','complete global chain');
  end if;
  expected_previous:=item.current_hash; expected_sequence:=expected_sequence+1;
 end loop;
 return jsonb_build_object('valid',true,'checked',checked_count,'firstFailure',null,'completeChain',true,'scope','complete global chain');
end; $$;
revoke all on function public.verify_ledger_chain() from public,anon;
grant execute on function public.verify_ledger_chain() to authenticated;

-- 6. AUTHENTICATION, ROLES & REGISTRATION
create or replace function public.current_app_role() returns public.app_role language sql stable security definer set search_path=public as $$
 select role from public.profiles where id=auth.uid() limit 1; $$;
revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

-- Role-aware registration trigger on auth.users
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public,extensions as $$
declare
 v_role text;
begin
 if new.raw_user_meta_data->>'role' in ('farmer', 'buyer') then
  v_role := new.raw_user_meta_data->>'role';
 else
  v_role := 'farmer';
 end if;
 insert into public.profiles(id, role, phone, display_name, language_pref)
 values(
  new.id,
  v_role::public.app_role,
  new.phone,
  coalesce(nullif(new.raw_user_meta_data->>'display_name',''), case when v_role = 'buyer' then 'KisanQ buyer' else 'KisanQ farmer' end),
  case when new.raw_user_meta_data->>'language_pref' in ('en','hi','mr') then new.raw_user_meta_data->>'language_pref' else 'en' end
 )
 on conflict(id) do update set
  phone = coalesce(excluded.phone, public.profiles.phone),
  display_name = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name);
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Safe idempotent profile provisioner for authenticated users
drop function if exists public.ensure_my_profile(text, text, text);
create or replace function public.ensure_my_profile(p_role text default 'farmer', p_display_name text default null, p_language_pref text default 'en')
returns public.profiles language plpgsql security definer set search_path=public,extensions as $$
declare
 v_role text;
 v_profile public.profiles;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_role in ('farmer', 'buyer') then v_role := p_role; else v_role := 'farmer'; end if;

 select * into v_profile from public.profiles where id = auth.uid();
 if v_profile.id is null then
  insert into public.profiles(id, role, phone, display_name, language_pref)
  select
   u.id,
   v_role::public.app_role,
   u.phone,
   coalesce(nullif(p_display_name, ''), case when v_role = 'buyer' then 'KisanQ buyer' else 'KisanQ farmer' end),
   case when p_language_pref in ('en','hi','mr') then p_language_pref else 'en' end
  from auth.users u where u.id = auth.uid()
  returning * into v_profile;
 end if;
 return v_profile;
end; $$;
revoke all on function public.ensure_my_profile(text, text, text) from public, anon;
grant execute on function public.ensure_my_profile(text, text, text) to authenticated;

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

drop function if exists public.record_user_consent(text);
create or replace function public.record_user_consent(p_version text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 update public.profiles set consent_version=p_version, consent_at=now() where id=auth.uid();
 perform public.append_audit_event('profile',auth.uid(),'dpdp_consent_recorded',jsonb_build_object('profile_id',auth.uid(),'version',p_version));
 return true;
end; $$;
revoke all on function public.record_user_consent(text) from public,anon;
grant execute on function public.record_user_consent(text) to authenticated;

-- 7. DOMAIN RPCS: LOT EXPIRY, SLOTS, TOKENS, INSPECTION, OFFERS
drop function if exists public.highest_active_offers(uuid[]);
create or replace function public.highest_active_offers(p_lot_ids uuid[]) returns table(lot_id uuid,highest_offer numeric) language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null or public.current_app_role() is null or public.current_app_role() not in ('buyer','inspector','supervisor') then raise exception 'Authorized account required'; end if;
 return query
  select l.id,max(o.price_per_unit)
  from public.crop_lots l
  left join public.offers o on o.lot_id=l.id and o.status='active' and o.expires_at>now()
  where l.id=any(p_lot_ids)
    and l.status in ('listed','reserved','checked_in','inspected')
    and l.expiry_processed_at is null
    and (l.offer_expires_at is null or l.offer_expires_at>now())
  group by l.id;
end; $$;
revoke all on function public.highest_active_offers(uuid[]) from public,anon;
grant execute on function public.highest_active_offers(uuid[]) to authenticated;

drop function if exists public.highest_active_offer(uuid);
create or replace function public.highest_active_offer(p_lot_id uuid) returns numeric language plpgsql stable security definer set search_path=public as $$
declare highest numeric;
begin
 select highest_offer into highest from public.highest_active_offers(array[p_lot_id]);
 return highest;
end; $$;
revoke all on function public.highest_active_offer(uuid) from public,anon;
grant execute on function public.highest_active_offer(uuid) to authenticated;

drop function if exists public.market_demand_pressure(text);
create or replace function public.market_demand_pressure(p_crop text) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare listing_count integer; offer_count integer; week_start date;
begin
 if auth.uid() is null or public.current_app_role() is null or public.current_app_role() not in ('farmer','buyer','inspector','supervisor') then raise exception 'Authorized account required'; end if;
 week_start:=date_trunc('week',now() at time zone 'Asia/Kolkata')::date;
 select count(*) into listing_count from public.crop_lots where lower(crop)=lower(trim(p_crop)) and status in ('listed','reserved','checked_in','inspected') and expiry_processed_at is null and (offer_expires_at is null or offer_expires_at>now()) and created_at>=(week_start::timestamp at time zone 'Asia/Kolkata') and created_at<((week_start+7)::timestamp at time zone 'Asia/Kolkata');
 select count(*) into offer_count from public.offers o join public.crop_lots l on l.id=o.lot_id where lower(l.crop)=lower(trim(p_crop)) and l.status in ('listed','reserved','checked_in','inspected') and l.expiry_processed_at is null and o.status='active' and o.created_at>=(week_start::timestamp at time zone 'Asia/Kolkata') and o.created_at<((week_start+7)::timestamp at time zone 'Asia/Kolkata') and o.expires_at>now();
 return jsonb_build_object('crop',trim(p_crop),'week_start',week_start,'active_listings',listing_count,'active_offers',offer_count,'ratio',case when listing_count=0 then null else round(offer_count::numeric/listing_count,2) end,'label',case when listing_count=0 then 'Not enough listings to calculate' else 'Active buyer offers / active listings this week' end);
end; $$;
revoke all on function public.market_demand_pressure(text) from public,anon;
grant execute on function public.market_demand_pressure(text) to authenticated;

drop function if exists public.process_expired_offers();
create or replace function public.process_expired_offers() returns jsonb language plpgsql security definer set search_path=public as $$
declare item record; best uuid; processed integer:=0; no_offer integer:=0;
begin
 for item in
  select id,crop,status,offer_expires_at
  from public.crop_lots
  where status in ('listed','reserved','checked_in','inspected')
    and offer_expires_at is not null
    and offer_expires_at<=now()
    and expiry_processed_at is null
  for update skip locked
 loop
  select id into best from public.offers where lot_id=item.id and status='active' and created_at<=item.offer_expires_at order by price_per_unit desc,created_at asc,id asc limit 1 for update;
  if best is null then
   update public.offers set status='expired',updated_at=now() where lot_id=item.id and status='active';
   update public.crop_lots set status=case when item.status='listed' then 'expired'::public.lot_status else item.status end, expiry_processed_at=now(), updated_at=now() where id=item.id;
   no_offer:=no_offer+1;
   perform public.append_audit_event('crop_lot',item.id,'offer_window_expired_no_offer',jsonb_build_object('lot_id',item.id,'crop',item.crop,'result','no_valid_offer'));
  else
   update public.offers set status='expired',updated_at=now() where lot_id=item.id and status='active' and id<>best;
   update public.offers set status='awaiting_farmer',updated_at=now() where id=best;
   update public.crop_lots set best_offer_id=best,expiry_processed_at=now(),updated_at=now() where id=item.id;
   perform public.append_audit_event('crop_lot',item.id,'best_offer_escalated_for_farmer_confirmation',jsonb_build_object('lot_id',item.id,'best_offer_id',best,'result','awaiting_farmer_confirmation'));
  end if;
  processed:=processed+1;
 end loop;
 return jsonb_build_object('processed',processed,'no_offer',no_offer);
end; $$;

drop function if exists public.accept_best_offer(uuid);
create or replace function public.accept_best_offer(p_lot_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare lot public.crop_lots; best uuid; winning public.offers;
begin
 select * into lot from public.crop_lots where id=p_lot_id for update;
 if lot.id is null then raise exception 'Crop lot not found'; end if;
 if auth.uid() is null or lot.farmer_id<>auth.uid() then raise exception 'Only the lot owner can accept an offer'; end if;
 if lot.status='sold' then raise exception 'This lot has already been sold'; end if;
 if lot.status not in ('listed','reserved','checked_in','inspected') then raise exception 'Lot is not in an acceptable state'; end if;
 if lot.offer_expires_at is null or lot.offer_expires_at>now() then raise exception 'Offer window has not closed yet'; end if;

 if lot.expiry_processed_at is null then
  select id into best from public.offers where lot_id=lot.id and status='active' and created_at<=lot.offer_expires_at order by price_per_unit desc,created_at asc,id asc limit 1 for update;
  if best is null then
   update public.offers set status='expired',updated_at=now() where lot_id=lot.id and status='active';
   update public.crop_lots set status=case when lot.status='listed' then 'expired'::public.lot_status else lot.status end, expiry_processed_at=now(), updated_at=now() where id=lot.id;
   perform public.append_audit_event('crop_lot',lot.id,'offer_window_expired_no_offer',jsonb_build_object('lot_id',lot.id,'crop',lot.crop,'result','no_valid_offer'));
   raise exception 'No active offers existed when the window closed';
  else
   update public.offers set status='expired',updated_at=now() where lot_id=lot.id and status='active' and id<>best;
   update public.offers set status='awaiting_farmer',updated_at=now() where id=best;
   update public.crop_lots set best_offer_id=best,expiry_processed_at=now(),updated_at=now() where id=lot.id;
   perform public.append_audit_event('crop_lot',lot.id,'best_offer_escalated_for_farmer_confirmation',jsonb_build_object('lot_id',lot.id,'best_offer_id',best,'result','awaiting_farmer_confirmation'));
   lot.best_offer_id := best;
  end if;
 end if;

 if lot.best_offer_id is null then raise exception 'No valid offer available to accept'; end if;
 select * into winning from public.offers where id=lot.best_offer_id and lot_id=lot.id for update;
 if winning.id is null or winning.status<>'awaiting_farmer' then raise exception 'Winning offer is not in awaiting_farmer status'; end if;

 update public.offers set status='accepted',updated_at=now() where id=winning.id;
 update public.offers set status='rejected',updated_at=now() where lot_id=lot.id and id<>winning.id and status in ('active','awaiting_farmer');
 update public.crop_lots set status='sold',best_offer_id=winning.id,updated_at=now() where id=lot.id;

 perform public.append_audit_event('crop_lot',lot.id,'offer_accepted_by_farmer',jsonb_build_object('lot_id',lot.id,'offer_id',winning.id,'buyer_id',winning.buyer_id,'price_per_unit',winning.price_per_unit));
 return jsonb_build_object('lot_id',lot.id,'offer_id',winning.id,'price_per_unit',winning.price_per_unit,'status','sold');
end; $$;
revoke all on function public.accept_best_offer(uuid) from public,anon;
grant execute on function public.accept_best_offer(uuid) to authenticated;

drop function if exists public.reserve_slot(uuid,uuid);
create or replace function public.reserve_slot(p_lot_id uuid,p_slot_id uuid) returns public.tokens language plpgsql security definer set search_path=public,extensions as $$
declare lot public.crop_lots; target_slot public.slots; new_token public.tokens; random_part text;
begin
 select * into lot from public.crop_lots where id=p_lot_id for update;
 if lot.id is null then raise exception 'Crop lot not found'; end if;
 if auth.uid() is null or lot.farmer_id<>auth.uid() then raise exception 'Only the lot owner can reserve a slot'; end if;
 if lot.status not in ('listed','draft','inspected','sold') then raise exception 'Lot is not in a reservable state'; end if;
 if exists(select 1 from public.tokens where lot_id=p_lot_id) then raise exception 'A token already exists for this crop lot'; end if;

 select * into target_slot from public.slots where id=p_slot_id for update;
 if target_slot.id is null then raise exception 'Slot not found'; end if;
 if target_slot.mandi_id<>lot.mandi_id then raise exception 'Slot mandi does not match lot mandi'; end if;
 if target_slot.slot_date < (now() at time zone 'Asia/Kolkata')::date then raise exception 'Cannot reserve a slot for a past date'; end if;
 if target_slot.booked_count>=target_slot.capacity or target_slot.status<>'open' then raise exception 'Slot capacity is full'; end if;

 update public.slots set booked_count=booked_count+1, status=case when booked_count+1>=capacity then 'full' else 'open' end where id=target_slot.id;
 random_part := upper(encode(extensions.digest(convert_to(gen_random_uuid()::text||clock_timestamp()::text,'UTF8'),'sha256'),'hex'));
 insert into public.tokens(lot_id,slot_id,token_code,status)
 values(lot.id,target_slot.id,'KQ-'||substring(random_part from 1 for 10),'reserved')
 returning * into new_token;

 if lot.status in ('listed','draft') then update public.crop_lots set status='reserved', updated_at=now() where id=lot.id; end if;
 perform public.append_audit_event('token',new_token.id,'slot_reserved',jsonb_build_object('lot_id',lot.id,'slot_id',target_slot.id,'token_code',new_token.token_code));
 return new_token;
end; $$;
revoke all on function public.reserve_slot(uuid,uuid) from public,anon;
grant execute on function public.reserve_slot(uuid,uuid) to authenticated;

drop function if exists public.check_in_token(text);
create or replace function public.check_in_token(p_token_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); actor_role public.app_role; tok public.tokens; lot public.crop_lots; next_lot_status public.lot_status;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 select role into actor_role from public.profiles where id=actor;
 if actor_role is null or actor_role not in ('inspector','supervisor') then raise exception 'Inspector role required'; end if;
 select * into tok from public.tokens where upper(trim(token_code))=upper(trim(p_token_code)) for update;
 if tok.id is null then raise exception 'Token not found'; end if;
 select * into lot from public.crop_lots where id=tok.lot_id for update;
 if lot.id is null then raise exception 'Crop lot not found'; end if;
 if actor_role='inspector' and not exists(select 1 from public.profiles p where p.id=actor and p.mandi_scope is not null and lot.mandi_id=any(p.mandi_scope)) then raise exception 'Inspector is outside assigned mandi scope'; end if;
 if tok.status<>'reserved' or lot.status not in ('reserved','sold') then raise exception 'Token or lot is not awaiting check-in'; end if;
 next_lot_status := case when lot.status='sold' then 'sold'::public.lot_status else 'checked_in'::public.lot_status end;
 update public.tokens set status='checked_in',check_in_at=now(),updated_at=now() where id=tok.id;
 update public.crop_lots set status=next_lot_status,updated_at=now() where id=lot.id;
 perform public.append_audit_event('token',tok.id,'physical_check_in_recorded',jsonb_build_object('token_id',tok.id,'lot_id',lot.id,'slot_id',tok.slot_id,'token_code',tok.token_code));
 return jsonb_build_object('token_id',tok.id,'lot_id',lot.id,'token_code',tok.token_code,'status',next_lot_status,'checked_in_at',now());
end; $$;
revoke all on function public.check_in_token(text) from public,anon;
grant execute on function public.check_in_token(text) to authenticated;

drop function if exists public.record_inspection(uuid,text,numeric,numeric,text,text);
create or replace function public.record_inspection(p_lot_id uuid,p_verified_grade text,p_verified_weight numeric,p_moisture_pct numeric,p_reason_code text,p_explanation text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); actor_role public.app_role; lot public.crop_lots; inspection public.inspections; before_values jsonb; next_lot_status public.lot_status;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 select role into actor_role from public.profiles where id=actor;
 if actor_role is null or actor_role not in ('inspector','supervisor') then raise exception 'Inspector role required'; end if;
 select * into lot from public.crop_lots where id=p_lot_id for update;
 if lot.id is null then raise exception 'Lot not found'; end if;
 if lot.status not in ('checked_in','inspected') and not (lot.status='sold' and exists(select 1 from public.tokens t where t.lot_id=lot.id and t.status in ('checked_in','completed'))) then
  raise exception 'Lot must be checked in before physical inspection';
 end if;
 if actor_role='inspector' and not exists(select 1 from public.profiles p where p.id=actor and (p.mandi_scope is not null and lot.mandi_id=any(p.mandi_scope))) then raise exception 'Inspector is outside assigned mandi scope'; end if;
 if p_verified_grade is null or p_verified_grade not in ('A','B','C','rejected') or p_verified_weight is null or p_verified_weight<=0 or p_reason_code is null or p_reason_code not in ('estimate_mismatch','weight_correction','moisture_correction','physical_condition','other') or p_explanation is null or length(trim(p_explanation))<8 then raise exception 'Valid grade, weight, reason and explanation required'; end if;
 next_lot_status := case when lot.status='sold' then 'sold'::public.lot_status else 'inspected'::public.lot_status end;
 before_values:=jsonb_build_object('ai_pregrade',lot.ai_pregrade,'ai_pregrade_confidence',lot.ai_pregrade_confidence,'quantity',lot.quantity,'unit',lot.unit,'moisture_pct',lot.moisture_pct,'verified_grade',lot.verified_grade,'verified_weight',lot.verified_weight);
 insert into public.inspections(lot_id,inspector_id,verified_grade,verified_weight,moisture_pct,reason_code,explanation,estimate_before,values_before)
 values(lot.id,actor,p_verified_grade,p_verified_weight,p_moisture_pct,p_reason_code,p_explanation,jsonb_build_object('ai_pregrade',lot.ai_pregrade,'confidence',lot.ai_pregrade_confidence,'method',lot.grading_method),before_values) returning * into inspection;
 update public.crop_lots set verified_grade=p_verified_grade,verified_weight=p_verified_weight,verified_moisture_pct=p_moisture_pct,status=next_lot_status,updated_at=now() where id=lot.id;
 perform public.append_audit_event('inspection',inspection.id,'weighbridge_inspection_recorded',jsonb_build_object('lot_id',lot.id,'inspector_id',actor,'verified_grade',p_verified_grade,'verified_weight',p_verified_weight,'reason_code',p_reason_code));
 return jsonb_build_object('inspection_id',inspection.id,'lot_id',lot.id,'verified_grade',p_verified_grade,'verified_weight',p_verified_weight,'status',next_lot_status);
end; $$;
revoke all on function public.record_inspection(uuid,text,numeric,numeric,text,text) from public,anon;
grant execute on function public.record_inspection(uuid,text,numeric,numeric,text,text) to authenticated;

-- 8. TRIGGERS: OFFER GUARDS, PERISHABILITY EXPIRY, DISPUTE GUARDS
create or replace function public.set_lot_offer_expiry() returns trigger language plpgsql as $$
declare hours integer; today_ist date := (now() at time zone 'Asia/Kolkata')::date;
begin
 if auth.uid() is not null then
  if new.farmer_id is distinct from auth.uid() then raise exception 'Lot owner must be the authenticated farmer'; end if;
  if public.current_app_role() is distinct from 'farmer'::public.app_role then raise exception 'Farmer role required'; end if;
  if new.status not in ('draft','listed') then raise exception 'Invalid initial lot status'; end if;
  if new.harvest_date > today_ist then raise exception 'Harvest date cannot be in the future'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.consent_version is not null and p.consent_at is not null) then raise exception 'Recorded consent required'; end if;
 end if;
 if new.offer_expires_at is null then
  select offer_window_hours into hours from public.crop_profiles where crop_key=lower(trim(new.crop));
  if hours is null then
   if lower(trim(new.crop)) in ('spinach','leafy vegetables','coriander','lettuce','fenugreek') then hours := 3;
   elsif lower(trim(new.crop)) in ('tomato','tomatoes','onion','potato','brinjal') then hours := 8;
   else hours := 48;
   end if;
  end if;
  new.offer_expires_at := now() + make_interval(hours => hours);
 end if;
 return new;
end; $$;
drop trigger if exists crop_lots_set_expiry on public.crop_lots;
create trigger crop_lots_set_expiry before insert on public.crop_lots for each row execute function public.set_lot_offer_expiry();

create or replace function public.guard_offer_insert() returns trigger language plpgsql set search_path=public as $$
declare target_lot public.crop_lots;
begin
 if auth.uid() is not null then
  if new.buyer_id is distinct from auth.uid() then raise exception 'Offer creator must be the authenticated buyer'; end if;
  if public.current_app_role() is distinct from 'buyer'::public.app_role then raise exception 'Buyer role required'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.consent_version is not null and p.consent_at is not null) then raise exception 'Recorded consent required'; end if;
 end if;
 select * into target_lot from public.crop_lots where id=new.lot_id;
 if target_lot.id is null then raise exception 'Crop lot not found'; end if;
 if target_lot.status not in ('listed','reserved','checked_in','inspected') then raise exception 'Lot is not open for offers'; end if;
 if target_lot.expiry_processed_at is not null or (target_lot.offer_expires_at is not null and target_lot.offer_expires_at <= now()) then raise exception 'Offer window has expired'; end if;
 if new.price_per_unit is null or new.price_per_unit <= 0 then raise exception 'Price must be positive'; end if;
 if new.expires_at is null or new.expires_at > target_lot.offer_expires_at then new.expires_at := target_lot.offer_expires_at; end if;
 return new;
end; $$;
drop trigger if exists offers_guard_insert on public.offers;
create trigger offers_guard_insert before insert on public.offers for each row execute function public.guard_offer_insert();

create or replace function public.buyer_has_offer_on_lot(p_lot_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.offers where lot_id=p_lot_id and buyer_id=auth.uid());
$$;
revoke all on function public.buyer_has_offer_on_lot(uuid) from public,anon;
grant execute on function public.buyer_has_offer_on_lot(uuid) to authenticated;

create or replace function public.buyer_has_offer_on_lot(p_buyer_id uuid, p_lot_id uuid) returns boolean language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then return false; end if;
 if auth.uid() <> p_buyer_id and public.current_app_role() not in ('inspector','supervisor') then return false; end if;
 return exists(select 1 from public.offers o where o.buyer_id = p_buyer_id and o.lot_id = p_lot_id);
end; $$;
revoke all on function public.buyer_has_offer_on_lot(uuid, uuid) from public, anon;
grant execute on function public.buyer_has_offer_on_lot(uuid, uuid) to authenticated;

create or replace function public.guard_dispute_insert() returns trigger language plpgsql security definer set search_path=public as $$
declare actor uuid := auth.uid(); actor_role text := public.current_app_role(); ref_lot public.crop_lots; ref_offer public.offers;
begin
 if actor is null or actor_role not in ('farmer','buyer','inspector','supervisor') then raise exception 'Authentication required to raise disputes'; end if;
 if actor_role in ('farmer','buyer') then
  if new.offer_id is not null then
   select * into ref_offer from public.offers where id=new.offer_id;
   if ref_offer.id is null then raise exception 'Referenced offer not found'; end if;
   if actor_role='buyer' and ref_offer.buyer_id<>actor then raise exception 'Buyers may only dispute their own offers'; end if;
   if new.lot_id is not null and new.lot_id<>ref_offer.lot_id then raise exception 'Referenced offer does not match the specified crop lot'; end if;
   new.lot_id := ref_offer.lot_id;
  end if;
  if new.lot_id is null then raise exception 'A valid crop lot or offer reference is required'; end if;
  select * into ref_lot from public.crop_lots where id=new.lot_id;
  if ref_lot.id is null then raise exception 'Referenced crop lot not found'; end if;
  if actor_role='farmer' and ref_lot.farmer_id<>actor then raise exception 'Farmers may only raise disputes on their own crop lots'; end if;
  if actor_role='buyer' and new.offer_id is null and not exists(select 1 from public.offers o where o.lot_id=ref_lot.id and o.buyer_id=actor) then
   raise exception 'Buyers may only raise disputes for lots on which they have submitted an offer';
  end if;
  new.raised_by:=actor; new.status:='open'; new.assigned_inspector:=null; new.resolution:=null; new.resolved_by:=null; new.resolved_at:=null; new.created_at:=now(); new.updated_at:=now();
 end if;
 return new;
end; $$;
drop trigger if exists disputes_guard_insert on public.disputes;
create trigger disputes_guard_insert before insert on public.disputes for each row execute function public.guard_dispute_insert();

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
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

-- Profiles policies
drop policy if exists profiles_read_self_or_inspector on public.profiles;
create policy profiles_read_self_or_inspector on public.profiles for select to authenticated using (id=auth.uid() or public.current_app_role()='supervisor');
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());

-- Mandis & Crop Profiles
drop policy if exists mandis_read on public.mandis;
create policy mandis_read on public.mandis for select to anon,authenticated using (active=true);
drop policy if exists crop_profiles_read on public.crop_profiles;
create policy crop_profiles_read on public.crop_profiles for select to anon,authenticated using(true);

-- Crop Lots policies
drop policy if exists lots_farmer_select on public.crop_lots;
create policy lots_farmer_select on public.crop_lots for select to authenticated using (
 farmer_id=auth.uid()
 or (status in ('listed','reserved','checked_in','inspected') and public.current_app_role() in ('buyer','inspector','supervisor'))
 or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='supervisor')
 or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='inspector' and (p.mandi_scope is not null and mandi_id=any(p.mandi_scope)))
);
drop policy if exists lots_farmer_insert on public.crop_lots;
create policy lots_farmer_insert on public.crop_lots for insert to authenticated with check(farmer_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='farmer'));

-- Slots & Tokens policies
drop policy if exists slots_read on public.slots;
create policy slots_read on public.slots for select to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and (p.role='supervisor' or p.role='inspector' and (p.mandi_scope is not null and mandi_id=any(p.mandi_scope)) or p.role in ('farmer','buyer'))));
drop policy if exists tokens_read_scope on public.tokens;
create policy tokens_read_scope on public.tokens for select to authenticated using(exists(select 1 from public.crop_lots l where l.id=lot_id and (l.farmer_id=auth.uid() or l.status in ('listed','reserved','checked_in','inspected'))) or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('inspector','supervisor')));

-- Offers policies
drop policy if exists offers_read_scope on public.offers;
create policy offers_read_scope on public.offers for select to authenticated using(buyer_id=auth.uid() or exists(select 1 from public.crop_lots l where l.id=lot_id and l.farmer_id=auth.uid()) or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('inspector','supervisor')));
drop policy if exists offers_buyer_insert on public.offers;
create policy offers_buyer_insert on public.offers for insert to authenticated with check(buyer_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='buyer') and exists(select 1 from public.crop_lots l where l.id=lot_id and l.status in ('listed','reserved','checked_in','inspected') and l.expiry_processed_at is null and (l.offer_expires_at is null or l.offer_expires_at>now())));

-- Inspections policies
drop policy if exists inspections_read_scope on public.inspections;
create policy inspections_read_scope on public.inspections for select to authenticated using(exists(select 1 from public.crop_lots l where l.id=lot_id and l.farmer_id=auth.uid()) or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('inspector','supervisor')));
drop policy if exists inspections_insert_inspector on public.inspections;
create policy inspections_insert_inspector on public.inspections for insert to authenticated with check(inspector_id=auth.uid() and exists(select 1 from public.profiles p join public.crop_lots l on l.id=lot_id where p.id=auth.uid() and p.role in ('inspector','supervisor') and (p.role='supervisor' or p.mandi_scope is not null and l.mandi_id=any(p.mandi_scope))));

-- Disputes policies
drop policy if exists disputes_read_scope on public.disputes;
create policy disputes_read_scope on public.disputes for select to authenticated using (
 raised_by=auth.uid()
 or exists(select 1 from public.crop_lots l where l.id=lot_id and l.farmer_id=auth.uid())
 or (offer_id is not null and exists(select 1 from public.offers o where o.id=offer_id and o.buyer_id=auth.uid()))
 or (public.current_app_role()='buyer' and public.buyer_has_offer_on_lot(auth.uid(), lot_id))
 or exists(select 1 from public.profiles p where p.id=auth.uid() and (p.role='supervisor' or (p.role='inspector' and p.mandi_scope is not null and exists(select 1 from public.crop_lots l where l.id=lot_id and l.mandi_id=any(p.mandi_scope)))))
);
drop policy if exists disputes_insert_user on public.disputes;
create policy disputes_insert_user on public.disputes for insert to authenticated with check(raised_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('farmer','buyer')));
drop policy if exists disputes_update_inspector on public.disputes;
create policy disputes_update_inspector on public.disputes for update to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and (p.role='supervisor' or (p.role='inspector' and p.mandi_scope is not null and exists(select 1 from public.crop_lots l where l.id=lot_id and l.mandi_id=any(p.mandi_scope)))))) with check(status in ('open','under_review','resolved','rejected','withdrawn'));

-- Price history & Audit events policies
drop policy if exists price_history_read on public.price_history;
create policy price_history_read on public.price_history for select to anon,authenticated using(true);
drop policy if exists audit_events_inspector_read on public.audit_events;
create policy audit_events_inspector_read on public.audit_events for select to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('inspector','supervisor')));

-- ==============================================================================
-- DONE! All tables, triggers, ledger cryptography, and policies are fully initialized.
-- ==============================================================================
