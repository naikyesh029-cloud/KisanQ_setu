-- Tighten read scope: buyer sees public listings, farmer sees own lots, inspector sees assigned mandi scope.
drop policy if exists lots_farmer_select on public.crop_lots;
create policy lots_farmer_select on public.crop_lots for select to authenticated using(
 farmer_id=auth.uid() or
 (public.current_app_role()='buyer' and status='listed' and (offer_expires_at is null or offer_expires_at>now())) or
 (public.current_app_role()='inspector' and (public.current_app_role()='inspector') and (exists(select 1 from public.profiles p where p.id=auth.uid() and (p.mandi_scope is not null and mandi_id=any(p.mandi_scope)))) ) or
 public.current_app_role()='supervisor'
);
-- No direct user update policy: state, inspection and offer lifecycle changes go through database functions.
drop policy if exists lots_farmer_update on public.crop_lots;
drop policy if exists offers_buyer_update on public.offers;
-- Tokens are private to the farmer who owns the lot and authorized operations staff.
drop policy if exists tokens_read_scope on public.tokens;
create policy tokens_read_scope on public.tokens for select to authenticated using(
 exists(select 1 from public.crop_lots l where l.id=lot_id and l.farmer_id=auth.uid()) or
 public.current_app_role()='supervisor' or
 (public.current_app_role()='inspector' and exists(select 1 from public.crop_lots l join public.profiles p on p.id=auth.uid() where l.id=lot_id and (p.mandi_scope is not null and l.mandi_id=any(p.mandi_scope))) )
);
drop policy if exists profiles_read_self_or_inspector on public.profiles;
create policy profiles_read_self_or_inspector on public.profiles for select to authenticated using(id=auth.uid() or public.current_app_role()='supervisor');

-- Clients cannot manufacture system-owned grade/status/deadline fields on lot creation.
create or replace function public.set_lot_offer_expiry() returns trigger language plpgsql as $$
declare hours integer;
begin
 if auth.uid() is not null then
  if new.farmer_id is distinct from auth.uid() then raise exception 'Lot owner must be the authenticated farmer'; end if;
  if public.current_app_role() is distinct from 'farmer'::public.app_role then raise exception 'Farmer role required'; end if;
  if new.status not in ('draft','listed') then raise exception 'Invalid initial lot status'; end if;
  if new.harvest_date>current_date then raise exception 'Harvest date cannot be in the future'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.consent_version is not null and p.consent_at is not null) then raise exception 'Recorded consent required'; end if;
  select consent_at into new.consent_recorded_at from public.profiles where id=auth.uid();
  new.photo_path:=null; new.created_at:=now(); new.updated_at:=now();
  new.verified_grade:=null; new.verified_weight:=null; new.verified_moisture_pct:=null;
  new.ai_pregrade:=null; new.ai_pregrade_confidence:=null; new.grading_method:=null; new.grading_metadata:=null;
  new.best_offer_id:=null; new.expiry_processed_at:=null;
  select offer_window_hours into hours from public.crop_profiles where crop_key=lower(trim(new.crop));
  if hours is null then hours:=12; end if;
  new.offer_expires_at:=now()+make_interval(hours=>hours);
 end if;
 if new.offer_expires_at is null then
  select offer_window_hours into hours from public.crop_profiles where crop_key=lower(trim(new.crop));
  if hours is null then hours:=12; end if;
  new.offer_expires_at:=now()+make_interval(hours=>hours);
 end if;
 return new;
end; $$;

-- Dispute references/ownership are immutable to user-facing updates; only valid status transitions are accepted.
create or replace function public.guard_dispute_update() returns trigger language plpgsql as $$
declare role_now public.app_role;
begin
 if auth.uid() is not null then
  select role into role_now from public.profiles where id=auth.uid();
  if new.id is distinct from old.id or new.lot_id is distinct from old.lot_id or new.offer_id is distinct from old.offer_id or new.raised_by is distinct from old.raised_by or new.reason_code is distinct from old.reason_code or new.description is distinct from old.description or new.evidence_paths is distinct from old.evidence_paths then
   raise exception 'Dispute identity and evidence are immutable through this update path';
  end if;
  if role_now is null or role_now not in ('inspector','supervisor') then raise exception 'Inspector role required to update dispute'; end if;
  if new.assigned_inspector is distinct from old.assigned_inspector then raise exception 'Assignment requires a trusted administrative workflow'; end if;
  if not ((old.status='open' and new.status in ('under_review','rejected')) or (old.status='under_review' and new.status in ('resolved','rejected')) or (old.status=new.status)) then raise exception 'Invalid dispute status transition'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists disputes_guard_update on public.disputes;
create trigger disputes_guard_update before update on public.disputes for each row execute function public.guard_dispute_update();

-- Enforce consent and system-owned fields even when a client bypasses the web form and calls PostgREST directly.
drop policy if exists lots_farmer_insert on public.crop_lots;
create policy lots_farmer_insert on public.crop_lots for insert to authenticated with check(
 farmer_id=auth.uid() and public.current_app_role()='farmer' and
 exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='farmer' and p.consent_version is not null and p.consent_at is not null)
);

-- Offer ownership, deadline and status are database-owned regardless of the caller's insert payload.
create or replace function public.guard_offer_insert() returns trigger language plpgsql as $$
declare lot public.crop_lots;
begin
 if auth.uid() is not null then
  if public.current_app_role() is distinct from 'buyer'::public.app_role then raise exception 'Buyer role required'; end if;
  select * into lot from public.crop_lots where id=new.lot_id for update;
  if lot.id is null or lot.status<>'listed' or (lot.offer_expires_at is not null and lot.offer_expires_at<=now()) then raise exception 'Lot is not accepting offers'; end if;
  new.buyer_id:=auth.uid(); new.status:='active'; new.created_at:=now(); new.updated_at:=now();
  new.expires_at:=now()+interval '24 hours';
 end if;
 return new;
end; $$;
drop trigger if exists offers_guard_insert on public.offers;
create trigger offers_guard_insert before insert on public.offers for each row execute function public.guard_offer_insert();

-- Inspections are only created through record_inspection(), which atomically writes the lot's final verified values.
drop policy if exists inspections_insert_inspector on public.inspections;

-- Scope offer and inspection reads to the actor's own records or assigned mandi.
drop policy if exists offers_read_scope on public.offers;
create policy offers_read_scope on public.offers for select to authenticated using(
 buyer_id=auth.uid() or
 exists(select 1 from public.crop_lots l where l.id=lot_id and l.farmer_id=auth.uid()) or
 public.current_app_role()='supervisor' or
 (public.current_app_role()='inspector' and exists(select 1 from public.crop_lots l join public.profiles p on p.id=auth.uid() where l.id=lot_id and p.mandi_scope is not null and l.mandi_id=any(p.mandi_scope)))
);
drop policy if exists inspections_read_scope on public.inspections;
create policy inspections_read_scope on public.inspections for select to authenticated using(
 exists(select 1 from public.crop_lots l where l.id=lot_id and l.farmer_id=auth.uid()) or
 public.current_app_role()='supervisor' or
 (public.current_app_role()='inspector' and exists(select 1 from public.crop_lots l join public.profiles p on p.id=auth.uid() where l.id=lot_id and p.mandi_scope is not null and l.mandi_id=any(p.mandi_scope)))
);

-- Audit read scope is derived from the audited entity's mandi; supervisors may review the full chain.
drop policy if exists audit_events_inspector_read on public.audit_events;
create policy audit_events_inspector_read on public.audit_events for select to authenticated using(
 public.current_app_role()='supervisor' or
 (public.current_app_role()='inspector' and (
  (entity_type='crop_lot' and exists(select 1 from public.crop_lots l join public.profiles p on p.id=auth.uid() where l.id=entity_id and p.mandi_scope is not null and l.mandi_id=any(p.mandi_scope))) or
  (entity_type='offer' and exists(select 1 from public.offers o join public.crop_lots l on l.id=o.lot_id join public.profiles p on p.id=auth.uid() where o.id=entity_id and p.mandi_scope is not null and l.mandi_id=any(p.mandi_scope))) or
  (entity_type='inspection' and exists(select 1 from public.inspections i join public.crop_lots l on l.id=i.lot_id join public.profiles p on p.id=auth.uid() where i.id=entity_id and p.mandi_scope is not null and l.mandi_id=any(p.mandi_scope))) or
  (entity_type='dispute' and exists(select 1 from public.disputes d left join public.offers o on o.id=d.offer_id join public.crop_lots l on l.id=coalesce(d.lot_id,o.lot_id) join public.profiles p on p.id=auth.uid() where d.id=entity_id and p.mandi_scope is not null and l.mandi_id=any(p.mandi_scope))) or
  (entity_type='token' and exists(select 1 from public.tokens t join public.crop_lots l on l.id=t.lot_id join public.profiles p on p.id=auth.uid() where t.id=entity_id and p.mandi_scope is not null and l.mandi_id=any(p.mandi_scope)))
 ))
);

create or replace function public.guard_dispute_insert() returns trigger language plpgsql as $$
begin
 if auth.uid() is not null then
  if public.current_app_role() is null or public.current_app_role() not in ('farmer','buyer') then raise exception 'Farmer or buyer role required'; end if;
  new.raised_by:=auth.uid(); new.status:='open'; new.assigned_inspector:=null; new.resolution:=null; new.resolved_by:=null; new.resolved_at:=null; new.created_at:=now(); new.updated_at:=now();
 end if;
 return new;
end; $$;
drop trigger if exists disputes_guard_insert on public.disputes;
create trigger disputes_guard_insert before insert on public.disputes for each row execute function public.guard_dispute_insert();
create or replace function public.guard_dispute_update() returns trigger language plpgsql as $$
declare role_now public.app_role;
begin
 if auth.uid() is not null then
  select role into role_now from public.profiles where id=auth.uid();
  if new.id is distinct from old.id or new.lot_id is distinct from old.lot_id or new.offer_id is distinct from old.offer_id or new.raised_by is distinct from old.raised_by or new.reason_code is distinct from old.reason_code or new.description is distinct from old.description or new.evidence_paths is distinct from old.evidence_paths or new.created_at is distinct from old.created_at then
   raise exception 'Dispute identity and evidence are immutable through this update path';
  end if;
  if role_now is null or role_now not in ('inspector','supervisor') then raise exception 'Inspector role required to update dispute'; end if;
  if new.assigned_inspector is distinct from old.assigned_inspector then raise exception 'Assignment requires a trusted administrative workflow'; end if;
  if not ((old.status='open' and new.status in ('under_review','rejected')) or (old.status='under_review' and new.status in ('resolved','rejected')) or (old.status=new.status)) then raise exception 'Invalid dispute status transition'; end if;
  if new.status='resolved' then new.resolved_by:=auth.uid();new.resolved_at:=now(); else new.resolved_by:=null;new.resolved_at:=null;end if;
  new.updated_at:=now();
 end if;
 return new;
end; $$;

-- Scope offer-only disputes through the associated offer's lot as well as direct lot disputes.
drop policy if exists disputes_read_scope on public.disputes;
create policy disputes_read_scope on public.disputes for select to authenticated using(
 raised_by=auth.uid() or
 exists(select 1 from public.offers o where o.id=offer_id and o.buyer_id=auth.uid()) or
 exists(select 1 from public.crop_lots l where l.id=lot_id and l.farmer_id=auth.uid()) or
 public.current_app_role()='supervisor' or
 (public.current_app_role()='inspector' and exists(
   select 1 from public.crop_lots l join public.profiles p on p.id=auth.uid()
   where p.mandi_scope is not null and l.mandi_id=any(p.mandi_scope)
     and (l.id=lot_id or l.id=(select o.lot_id from public.offers o where o.id=offer_id))
 ))
);
drop policy if exists disputes_update_inspector on public.disputes;
create policy disputes_update_inspector on public.disputes for update to authenticated using(
 public.current_app_role()='supervisor' or
 (public.current_app_role()='inspector' and exists(
   select 1 from public.crop_lots l join public.profiles p on p.id=auth.uid()
   where p.mandi_scope is not null and l.mandi_id=any(p.mandi_scope)
     and (l.id=lot_id or l.id=(select o.lot_id from public.offers o where o.id=offer_id))
 ))
) with check(status in ('open','under_review','resolved','rejected','withdrawn'));

-- Database-level bounds complement Zod because clients can call PostgREST directly.
alter table public.crop_lots drop constraint if exists crop_lots_area_upper_bound;
alter table public.crop_lots add constraint crop_lots_area_upper_bound check(area<=100000);
alter table public.crop_lots drop constraint if exists crop_lots_quantity_upper_bound;
alter table public.crop_lots add constraint crop_lots_quantity_upper_bound check(quantity<=1000000);
alter table public.crop_lots drop constraint if exists crop_lots_asking_price_upper_bound;
alter table public.crop_lots add constraint crop_lots_asking_price_upper_bound check(asking_price is null or asking_price<=100000000);
alter table public.crop_lots drop constraint if exists crop_lots_text_bounds;
alter table public.crop_lots add constraint crop_lots_text_bounds check(length(variety)<=100 and (description is null or length(description)<=1000));
alter table public.offers drop constraint if exists offers_price_upper_bound;
alter table public.offers add constraint offers_price_upper_bound check(price_per_unit<=100000000);
alter table public.disputes drop constraint if exists disputes_description_upper_bound;
alter table public.disputes add constraint disputes_description_upper_bound check(length(description)<=2000);
alter table public.inspections drop constraint if exists inspections_explanation_upper_bound;
alter table public.inspections add constraint inspections_explanation_upper_bound check(explanation is null or length(explanation)<=1000);

alter table public.crop_lots drop constraint if exists crop_lots_verified_weight_upper_bound;
alter table public.crop_lots add constraint crop_lots_verified_weight_upper_bound check(verified_weight is null or verified_weight<=1000000);
alter table public.inspections drop constraint if exists inspections_verified_weight_upper_bound;
alter table public.inspections add constraint inspections_verified_weight_upper_bound check(verified_weight<=1000000);
