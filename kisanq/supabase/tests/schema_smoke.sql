-- Run against a disposable Supabase database after migrations. All data changes are rolled back.
begin;
do $$
declare
 e1 public.audit_events;
 e2 public.audit_events;
 r boolean;
 tbl text;
 window_hours integer;
 fn_name text;
 v_farmer_a uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
 v_farmer_b uuid := 'aaaaaaaa-0000-4000-8000-000000000002';
 v_buyer_a uuid := 'bbbbbbbb-0000-4000-8000-000000000001';
 v_buyer_b uuid := 'bbbbbbbb-0000-4000-8000-000000000002';
 v_inspector_a uuid := 'cccccccc-0000-4000-8000-000000000001';
 v_supervisor uuid := 'dddddddd-0000-4000-8000-000000000001';
 v_mandi_a uuid := '11111111-0000-4000-8000-000000000001';
 v_mandi_b uuid := '11111111-0000-4000-8000-000000000002';
 v_slot_a uuid := '22222222-0000-4000-8000-000000000001';
 v_lot_a uuid;
 v_lot_b uuid;
 v_offer_a uuid;
 v_offer_b uuid;
 v_token public.tokens;
 v_demand jsonb;
 v_accept jsonb;
 v_verify jsonb;
 v_visible_count integer;
begin
 foreach tbl in array array['profiles','mandis','crop_profiles','crop_lots','slots','tokens','offers','price_history','inspections','disputes','audit_events'] loop
  select relrowsecurity into r from pg_class where oid=('public.'||tbl)::regclass;
  if r is distinct from true then raise exception 'RLS is not enabled on %', tbl; end if;
 end loop;
 foreach fn_name in array array['reserve_slot','check_in_token','record_inspection','process_expired_offers','accept_best_offer','verify_ledger_chain','market_demand_pressure','highest_active_offer','highest_active_offers','buyer_has_offer_on_lot','ensure_my_profile'] loop
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=fn_name) then
   raise exception 'Expected RPC function public.% is missing', fn_name;
  end if;
 end loop;
 select offer_window_hours into window_hours from public.crop_profiles where crop_key='maize';
 if window_hours is distinct from 48 then raise exception 'Expected maize offer_window_hours=48, got %', window_hours; end if;
 if public.canonical_jsonb('{"z":1,"a":{"y":2.50,"b":[3,true,null]}}'::jsonb) <> '{"a":{"b":[3,true,null],"y":2.5},"z":1}' then
  raise exception 'Canonical JSON serialization mismatch';
 end if;
 e1:=public.append_audit_event('schema_smoke',null,'schema_smoke_test_1',jsonb_build_object('payload',jsonb_build_object('z',1,'a',2)));
 e2:=public.append_audit_event('schema_smoke',null,'schema_smoke_test_2',jsonb_build_object('prev',e1.current_hash));
 if e2.previous_hash <> e1.current_hash or e2.sequence <> e1.sequence + 1 then
  raise exception 'Audit ledger chain linkage mismatch';
 end if;
 begin
  update public.audit_events set action='tampered' where sequence=e1.sequence;
  raise exception 'Audit update unexpectedly succeeded';
 exception when others then
  if sqlerrm <> 'Audit ledger is append-only' then raise; end if;
 end;
 begin
  delete from public.audit_events where sequence=e1.sequence;
  raise exception 'Audit delete unexpectedly succeeded';
 exception when others then
  if sqlerrm <> 'Audit ledger is append-only' then raise; end if;
 end;

 -- Seed disposable identities, mandis, and open slot for authenticated RLS & RPC tests
 insert into auth.users(id,phone) values
  (v_farmer_a,'+919000000001'),
  (v_farmer_b,'+919000000002'),
  (v_buyer_a,'+919000000003'),
  (v_buyer_b,'+919000000004'),
  (v_inspector_a,'+919000000005'),
  (v_supervisor,'+919000000006')
 on conflict(id) do nothing;

 update public.profiles set role='farmer',consent_version='kisanq-consent-v1',consent_at=now() where id in (v_farmer_a,v_farmer_b);
 update public.profiles set role='buyer',consent_version='kisanq-consent-v1',consent_at=now() where id in (v_buyer_a,v_buyer_b);
 update public.profiles set role='inspector',mandi_scope=array[v_mandi_a],consent_version='kisanq-consent-v1',consent_at=now() where id=v_inspector_a;
 update public.profiles set role='supervisor',consent_version='kisanq-consent-v1',consent_at=now() where id=v_supervisor;

 insert into public.mandis(id,name,district,capacity_per_slot,active) values
  (v_mandi_a,'Smoke Mandi A','Pune',10,true),
  (v_mandi_b,'Smoke Mandi B','Nashik',10,true)
 on conflict(id) do nothing;

 insert into public.slots(id,mandi_id,slot_date,starts_at,ends_at,capacity,booked_count,status)
 values(v_slot_a,v_mandi_a,(now() at time zone 'Asia/Kolkata')::date,'09:00','11:00',5,0,'open')
 on conflict(id) do nothing;

 -- 1. Farmer A creates a listed lot; Farmer B creates a listed lot in Mandi B
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',v_farmer_a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_farmer_a,'role','authenticated')::text,true);
 insert into public.crop_lots(farmer_id,crop,variety,area,area_unit,harvest_date,quantity,unit,condition,mandi_id,status)
 values(v_farmer_a,'Tomato','Hybrid',2,'acre',(now() at time zone 'Asia/Kolkata')::date,25,'quintal','good',v_mandi_a,'listed')
 returning id into v_lot_a;

 perform set_config('request.jwt.claim.sub',v_farmer_b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_farmer_b,'role','authenticated')::text,true);
 insert into public.crop_lots(farmer_id,crop,variety,area,area_unit,harvest_date,quantity,unit,condition,mandi_id,status)
 values(v_farmer_b,'Tomato','Local',1.5,'acre',(now() at time zone 'Asia/Kolkata')::date,15,'quintal','good',v_mandi_b,'listed')
 returning id into v_lot_b;

 -- Cross-farmer RLS check: Farmer B cannot see Farmer A's lot
 select count(*) into v_visible_count from public.crop_lots where id=v_lot_a;
 if v_visible_count <> 0 then raise exception 'RLS failure: Farmer B read Farmer A lot'; end if;

 -- 2. Buyer A places an offer on Lot A (tests guard_offer_insert under SECURITY INVOKER + RLS)
 perform set_config('request.jwt.claim.sub',v_buyer_a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_buyer_a,'role','authenticated')::text,true);
 insert into public.offers(lot_id,buyer_id,price_per_unit) values(v_lot_a,v_buyer_a,2400) returning id into v_offer_a;
 insert into public.offers(lot_id,buyer_id,price_per_unit) values(v_lot_b,v_buyer_a,2200) returning id into v_offer_b;

 if public.buyer_has_offer_on_lot(v_lot_a) is distinct from true then
  raise exception 'Expected buyer_has_offer_on_lot=true for Buyer A';
 end if;
 if public.highest_active_offer(v_lot_a) is distinct from 2400 then
  raise exception 'Expected highest_active_offer=2400';
 end if;

 -- Execute market_demand_pressure RPC (regression test for qualified o.created_at)
 v_demand := public.market_demand_pressure('Tomato');
 if (v_demand->>'active_listings')::integer < 2 or (v_demand->>'active_offers')::integer < 2 then
  raise exception 'Unexpected market_demand_pressure output: %', v_demand;
 end if;

 -- 3. Cross-buyer RLS & dispute ownership checks as Buyer B
 perform set_config('request.jwt.claim.sub',v_buyer_b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_buyer_b,'role','authenticated')::text,true);
 select count(*) into v_visible_count from public.offers where id=v_offer_a;
 if v_visible_count <> 0 then raise exception 'RLS failure: Buyer B read Buyer A offer'; end if;
 if public.buyer_has_offer_on_lot(v_lot_a) is distinct from false then
  raise exception 'Expected buyer_has_offer_on_lot=false for Buyer B';
 end if;
 begin
  insert into public.disputes(lot_id,raised_by,reason_code,description)
  values(v_lot_a,v_buyer_b,'quality','Unauthorized buyer dispute attempt');
  raise exception 'Expected guard_dispute_insert to reject uninvolved buyer';
 exception when others then
  if sqlerrm not like '%Buyers may only raise disputes%' then raise; end if;
 end;

 -- 4. Slot reservation, check-in, and mandi-scoped inspection
 perform set_config('request.jwt.claim.sub',v_farmer_a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_farmer_a,'role','authenticated')::text,true);
 v_token := public.reserve_slot(v_lot_a,v_slot_a);

 perform set_config('request.jwt.claim.sub',v_inspector_a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_inspector_a,'role','authenticated')::text,true);
 perform public.check_in_token(v_token.token_code);
 perform public.record_inspection(v_lot_a,'A',24.8,11.5,'weight_correction','Verified on calibrated gate weighbridge');

 -- Out-of-scope mandi inspection must be rejected
 begin
  perform public.record_inspection(v_lot_b,'A',15.0,10.0,'other','Out of scope attempt');
  raise exception 'Expected out-of-scope inspection to fail';
 exception when others then
  if sqlerrm not like '%outside assigned mandi scope%' and sqlerrm not like '%Lot must be checked in%' then raise; end if;
 end;

 -- 5. Single-lot expiry escalation in accept_best_offer without mutating Farmer B's lot
 execute 'reset role';
 update public.crop_lots set offer_expires_at=now()-interval '5 minutes' where id in (v_lot_a,v_lot_b);
 update public.offers set created_at=now()-interval '10 minutes' where id in (v_offer_a,v_offer_b);

 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',v_farmer_a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_farmer_a,'role','authenticated')::text,true);
 v_accept := public.accept_best_offer(v_lot_a);
 if v_accept->>'status' <> 'sold' then raise exception 'Expected lot A status=sold, got %', v_accept; end if;

 execute 'reset role';
 if exists(select 1 from public.crop_lots where id=v_lot_b and expiry_processed_at is not null) then
  raise exception 'Isolation failure: Farmer A accept_best_offer mutated Farmer B expired lot';
 end if;
 if exists(select 1 from public.audit_events where entity_id=v_lot_b and actor_id=v_farmer_a) then
  raise exception 'Attribution failure: Farmer A attributed on Farmer B audit event';
 end if;

 -- 6. Supervisor global ledger verification
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',v_supervisor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_supervisor,'role','authenticated')::text,true);
 v_verify := public.verify_ledger_chain();
 if (v_verify->>'valid')::boolean is distinct from true then
  raise exception 'Expected verify_ledger_chain valid=true, got %', v_verify;
 end if;
 execute 'reset role';
end; $$;
rollback;

