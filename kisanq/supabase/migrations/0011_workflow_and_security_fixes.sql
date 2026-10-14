-- 0011: Align crop offer-window profiles, IST harvest-date checks, marketplace/slot/offer lifecycle transitions, and dispute ownership invariants.

insert into public.crop_profiles(crop_key,display_name,offer_window_hours,perishability_group) values
 ('lettuce','Lettuce',3,'very_perishable'),
 ('fenugreek','Fenugreek',3,'very_perishable'),
 ('tomatoes','Tomatoes',8,'perishable'),
 ('brinjal','Brinjal',8,'perishable'),
 ('rice','Rice',48,'storable'),
 ('maize','Maize',48,'storable'),
 ('wheat grain','Wheat grain',48,'storable')
on conflict(crop_key) do update set
 offer_window_hours=excluded.offer_window_hours,
 perishability_group=excluded.perishability_group,
 updated_at=now();

-- Use Asia/Kolkata date for harvest_date validation to match the Next.js API handler and avoid midnight-to-05:30 IST rejections.
create or replace function public.set_lot_offer_expiry() returns trigger language plpgsql as $$
declare hours integer; today_ist date := (now() at time zone 'Asia/Kolkata')::date;
begin
 if auth.uid() is not null then
  if new.farmer_id is distinct from auth.uid() then raise exception 'Lot owner must be the authenticated farmer'; end if;
  if public.current_app_role() is distinct from 'farmer'::public.app_role then raise exception 'Farmer role required'; end if;
  if new.status not in ('draft','listed') then raise exception 'Invalid initial lot status'; end if;
  if new.harvest_date > today_ist then raise exception 'Harvest date cannot be in the future'; end if;
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

-- -- Allow buyers to view active marketplace lots AND lots on which they have previously submitted an offer (needed for OfferHistory and DisputeDesk after expiry/sale).
create or replace function public.buyer_has_offer_on_lot(p_lot_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.offers where lot_id=p_lot_id and buyer_id=auth.uid());
$$;
revoke all on function public.buyer_has_offer_on_lot(uuid) from public,anon;
grant execute on function public.buyer_has_offer_on_lot(uuid) to authenticated;

drop policy if exists lots_farmer_select on public.crop_lots;
create policy lots_farmer_select on public.crop_lots for select to authenticated using(
 farmer_id=auth.uid() or
 (public.current_app_role()='buyer' and (
  (status in ('listed','reserved','checked_in','inspected') and expiry_processed_at is null and (offer_expires_at is null or offer_expires_at>now())) or
  public.buyer_has_offer_on_lot(id)
 )) or
 (public.current_app_role()='inspector' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.mandi_scope is not null and mandi_id=any(p.mandi_scope))) or
 public.current_app_role()='supervisor'
);

drop policy if exists offers_buyer_insert on public.offers;
create policy offers_buyer_insert on public.offers for insert to authenticated with check(
 buyer_id=auth.uid() and
 public.current_app_role()='buyer' and
 exists(
  select 1 from public.crop_lots l
  where l.id=lot_id
    and l.status in ('listed','reserved','checked_in','inspected')
    and l.expiry_processed_at is null
    and (l.offer_expires_at is null or l.offer_expires_at>now())
 )
);

create or replace function public.guard_offer_insert() returns trigger language plpgsql set search_path=public as $$
declare lot public.crop_lots;
begin
 if auth.uid() is not null then
  if public.current_app_role() is distinct from 'buyer'::public.app_role then raise exception 'Buyer role required'; end if;
  select * into lot from public.crop_lots where id=new.lot_id;
  if lot.id is null or lot.status not in ('listed','reserved','checked_in','inspected') or lot.expiry_processed_at is not null or (lot.offer_expires_at is not null and lot.offer_expires_at<=now()) then
   raise exception 'Lot is not accepting offers';
  end if;
  new.buyer_id:=auth.uid(); new.status:='active'; new.created_at:=now(); new.updated_at:=now();
  new.expires_at:=coalesce(lot.offer_expires_at,now()+interval '24 hours');
 end if;
 return new;
end; $$;

create or replace function public.highest_active_offer(p_lot_id uuid) returns numeric language plpgsql stable security definer set search_path=public as $$
declare result numeric;
begin
 if auth.uid() is null or public.current_app_role() is null or public.current_app_role() not in ('buyer','inspector','supervisor') then raise exception 'Authorized account required'; end if;
 if not exists(select 1 from public.crop_lots where id=p_lot_id and status in ('listed','reserved','checked_in','inspected') and expiry_processed_at is null and (offer_expires_at is null or offer_expires_at>now())) then return null; end if;
 select max(price_per_unit) into result from public.offers where lot_id=p_lot_id and status='active' and expires_at>now();
 return result;
end; $$;
revoke all on function public.highest_active_offer(uuid) from public,anon;
grant execute on function public.highest_active_offer(uuid) to authenticated;

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

-- Process expired offer windows across listed/reserved/checked_in/inspected lots without clobbering physical yard statuses.
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
   update public.crop_lots
   set status=case when item.status='listed' then 'expired'::public.lot_status else item.status end,
       expiry_processed_at=now(),
       updated_at=now()
   where id=item.id;
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
revoke all on function public.process_expired_offers() from public,anon,authenticated;
grant execute on function public.process_expired_offers() to service_role;

create or replace function public.accept_best_offer(p_lot_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); lot public.crop_lots; best public.offers;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 if public.current_app_role() is distinct from 'farmer'::public.app_role then raise exception 'Farmer role required'; end if;
 select * into lot from public.crop_lots where id=p_lot_id for update;
 if lot.id is null or lot.farmer_id<>actor then raise exception 'Lot not found in your account'; end if;
 if lot.status in ('sold','withdrawn','expired') then raise exception 'Lot is not eligible for offer acceptance'; end if;
 if lot.expiry_processed_at is null and lot.offer_expires_at is not null and lot.offer_expires_at<=now() then
  select * into best from public.offers where lot_id=lot.id and status='active' and created_at<=lot.offer_expires_at order by price_per_unit desc,created_at asc,id asc limit 1 for update;
  if best.id is not null then
   update public.offers set status='expired',updated_at=now() where lot_id=lot.id and status='active' and id<>best.id;
   update public.offers set status='awaiting_farmer',updated_at=now() where id=best.id;
   update public.crop_lots set best_offer_id=best.id,expiry_processed_at=now(),updated_at=now() where id=lot.id returning * into lot;
   perform public.append_audit_event('crop_lot',lot.id,'best_offer_escalated_for_farmer_confirmation',jsonb_build_object('lot_id',lot.id,'best_offer_id',best.id,'result','awaiting_farmer_confirmation'));
  end if;
 end if;
 if lot.expiry_processed_at is null or lot.best_offer_id is null then raise exception 'No best offer is awaiting confirmation'; end if;
 select * into best from public.offers where id=lot.best_offer_id and lot_id=lot.id and status='awaiting_farmer' for update;
 if best.id is null then raise exception 'Best offer is no longer available'; end if;
 update public.offers set status='accepted',updated_at=now() where id=best.id;
 update public.offers set status='rejected',updated_at=now() where lot_id=lot.id and id<>best.id and status in ('active','awaiting_farmer');
 update public.crop_lots set status='sold',updated_at=now() where id=lot.id;
 perform public.append_audit_event('crop_lot',lot.id,'farmer_accepted_best_offer',jsonb_build_object('lot_id',lot.id,'offer_id',best.id,'price_per_unit',best.price_per_unit));
 return jsonb_build_object('lot_id',lot.id,'offer_id',best.id,'price_per_unit',best.price_per_unit,'status','sold');
end; $$;
revoke all on function public.accept_best_offer(uuid) from public,anon;
grant execute on function public.accept_best_offer(uuid) to authenticated;

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

-- Allow slot reservation for listed, draft, inspected, or sold lots that do not yet have a token, and reject past slot dates.
create or replace function public.reserve_slot(p_lot_id uuid,p_slot_id uuid) returns public.tokens language plpgsql security definer set search_path=public,extensions as $$
declare actor uuid := auth.uid(); lot public.crop_lots; chosen_slot public.slots; new_token public.tokens; code text; today_ist date := (now() at time zone 'Asia/Kolkata')::date;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 if public.current_app_role() is distinct from 'farmer'::public.app_role then raise exception 'Farmer role required'; end if;
 select * into lot from public.crop_lots where id=p_lot_id for update;
 if lot.id is null or lot.farmer_id<>actor or lot.status not in ('listed','draft','inspected','sold') then raise exception 'Lot is unavailable for reservation'; end if;
 if exists(select 1 from public.tokens where lot_id=p_lot_id) then raise exception 'A slot token is already assigned to this lot'; end if;
 select * into chosen_slot from public.slots where id=p_slot_id and mandi_id=lot.mandi_id for update;
 if chosen_slot.id is null or chosen_slot.status<>'open' or chosen_slot.booked_count>=chosen_slot.capacity or chosen_slot.slot_date<today_ist then raise exception 'Slot is full or unavailable'; end if;
 update public.slots set booked_count=booked_count+1,status=case when booked_count+1>=capacity then 'full' else 'open' end,updated_at=now() where id=p_slot_id;
 code := 'KQ-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
 insert into public.tokens(lot_id,slot_id,token_code) values(p_lot_id,p_slot_id,code) returning * into new_token;
 update public.crop_lots set status=case when lot.status in ('listed','draft') then 'reserved'::public.lot_status else lot.status end,updated_at=now() where id=p_lot_id;
 perform public.append_audit_event('token',new_token.id,'slot_reserved',jsonb_build_object('lot_id',p_lot_id,'slot_id',p_slot_id,'token_code',code));
 return new_token;
end; $$;
revoke all on function public.reserve_slot(uuid,uuid) from public, anon;
grant execute on function public.reserve_slot(uuid,uuid) to authenticated;

-- Allow gate check-in and physical inspection to proceed on sold lots without regressing 'sold' status.
create or replace function public.check_in_token(p_token_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); actor_role public.app_role; tok public.tokens; lot public.crop_lots; next_lot_status public.lot_status;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 select role into actor_role from public.profiles where id=actor;
 if actor_role is null or actor_role not in ('inspector','supervisor') then raise exception 'Inspector role required'; end if;
 select * into tok from public.tokens where token_code=p_token_code for update;
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
 return jsonb_build_object('inspection_id',inspection.id,'lot_id',lot.id,'verified_grade',p_verified_grade,'verified_weight',p_verified_weight,'status',next_lot_status);
end; $$;
revoke all on function public.record_inspection(uuid,text,numeric,numeric,text,text) from public,anon;
grant execute on function public.record_inspection(uuid,text,numeric,numeric,text,text) to authenticated;

-- Enforce dispute ownership and cross-reference integrity at the database layer.
create or replace function public.guard_dispute_insert() returns trigger language plpgsql security definer set search_path=public as $$
declare actor uuid := auth.uid(); actor_role public.app_role; ref_offer public.offers; ref_lot public.crop_lots;
begin
 if actor is not null then
  actor_role := public.current_app_role();
  if actor_role is null or actor_role not in ('farmer','buyer') then raise exception 'Farmer or buyer role required'; end if;
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

-- Role-aware public registration: users can register as farmer or buyer with localized display names.
-- Privileged roles ('inspector', 'supervisor') are strictly protected and cannot be self-assigned.
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
  v_role,
  new.phone,
  coalesce(nullif(new.raw_user_meta_data->>'display_name',''), case when v_role = 'buyer' then 'KisanQ buyer' else 'KisanQ farmer' end),
  case when new.raw_user_meta_data->>'language_pref' in ('en','hi','mr') then new.raw_user_meta_data->>'language_pref' else 'en' end
 )
 on conflict(id) do update set
  phone = coalesce(excluded.phone, public.profiles.phone),
  display_name = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name);
 return new;
end; $$;

-- Idempotent profile provisioner for authenticated users.
-- Ensures caller's profile exists even if registered prior to trigger execution or without manual seed.
-- Strictly enforces that public callers can only create farmer or buyer profiles.
create or replace function public.ensure_my_profile(p_role text default 'farmer', p_display_name text default null, p_language_pref text default 'en')
returns public.profiles language plpgsql security definer set search_path=public,extensions as $$
declare
 v_role text;
 v_profile public.profiles;
begin
 if auth.uid() is null then
  raise exception 'Authentication required';
 end if;
 if p_role in ('farmer', 'buyer') then
  v_role := p_role;
 else
  v_role := 'farmer';
 end if;

 select * into v_profile from public.profiles where id = auth.uid();
 if v_profile.id is null then
  insert into public.profiles(id, role, phone, display_name, language_pref)
  select
   u.id,
   v_role,
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

