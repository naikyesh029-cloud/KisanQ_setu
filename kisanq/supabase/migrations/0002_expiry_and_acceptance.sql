alter table public.crop_lots add column if not exists expiry_processed_at timestamptz;
create or replace function public.process_expired_offers() returns jsonb language plpgsql security definer set search_path=public as $$
declare item record; best uuid; processed integer:=0; no_offer integer:=0;
begin
 for item in select id,farmer_id,crop from public.crop_lots where status='listed' and offer_expires_at is not null and offer_expires_at<=now() and expiry_processed_at is null for update skip locked loop
  update public.offers set status='expired',updated_at=now() where lot_id=item.id and status='active' and expires_at<=now();
  select id into best from public.offers where lot_id=item.id and status='active' and expires_at>now() order by price_per_unit desc,created_at asc,id asc limit 1;
  if best is null then
   update public.crop_lots set status='expired',expiry_processed_at=now(),updated_at=now() where id=item.id;
   no_offer:=no_offer+1;
   perform public.append_audit_event('crop_lot',item.id,'offer_window_expired_no_offer',jsonb_build_object('lot_id',item.id,'crop',item.crop,'result','no_valid_offer'));
  else
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
 if lot.expiry_processed_at is null or lot.best_offer_id is null then raise exception 'No best offer is awaiting confirmation'; end if;
 select * into best from public.offers where id=lot.best_offer_id and lot_id=lot.id and status='active' and expires_at>now() for update;
 if best.id is null then raise exception 'Best offer is no longer available'; end if;
 update public.offers set status='accepted',updated_at=now() where id=best.id;
 update public.offers set status='rejected',updated_at=now() where lot_id=lot.id and id<>best.id and status='active';
 update public.crop_lots set status='sold',updated_at=now() where id=lot.id;
 perform public.append_audit_event('crop_lot',lot.id,'farmer_accepted_best_offer',jsonb_build_object('lot_id',lot.id,'offer_id',best.id,'price_per_unit',best.price_per_unit));
 return jsonb_build_object('lot_id',lot.id,'offer_id',best.id,'price_per_unit',best.price_per_unit,'status','sold');
end; $$;
revoke all on function public.accept_best_offer(uuid) from public,anon;
grant execute on function public.accept_best_offer(uuid) to authenticated;
