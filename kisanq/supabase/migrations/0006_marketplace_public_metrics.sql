-- Expose only the aggregate highest active offer, never other buyers' identities or bid history.
create or replace function public.highest_active_offer(p_lot_id uuid) returns numeric language plpgsql stable security definer set search_path=public as $$
declare result numeric;
begin
 if auth.uid() is null or public.current_app_role() is null or public.current_app_role() not in ('buyer','inspector','supervisor') then raise exception 'Authorized account required'; end if;
 if not exists(select 1 from public.crop_lots where id=p_lot_id and status='listed' and (offer_expires_at is null or offer_expires_at>now())) then return null; end if;
 select max(price_per_unit) into result from public.offers where lot_id=p_lot_id and status='active' and expires_at>now();
 return result;
end; $$;
revoke all on function public.highest_active_offer(uuid) from public,anon;
grant execute on function public.highest_active_offer(uuid) to authenticated;

create or replace function public.market_demand_pressure(p_crop text) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare listing_count integer; offer_count integer; week_start date;
begin
 if auth.uid() is null or public.current_app_role() is null or public.current_app_role() not in ('farmer','buyer','inspector','supervisor') then raise exception 'Authorized account required'; end if;
 week_start:=date_trunc('week',now() at time zone 'Asia/Kolkata')::date;
 select count(*) into listing_count from public.crop_lots where lower(crop)=lower(p_crop) and status='listed' and (offer_expires_at is null or offer_expires_at>now()) and created_at>=(week_start::timestamp at time zone 'Asia/Kolkata') and created_at<((week_start+7)::timestamp at time zone 'Asia/Kolkata');
 select count(*) into offer_count from public.offers o join public.crop_lots l on l.id=o.lot_id where lower(l.crop)=lower(p_crop) and l.status='listed' and o.status='active' and o.created_at>=(week_start::timestamp at time zone 'Asia/Kolkata') and o.created_at<((week_start+7)::timestamp at time zone 'Asia/Kolkata') and o.expires_at>now();
 return jsonb_build_object('crop',p_crop,'week_start',week_start,'active_listings',listing_count,'active_offers',offer_count,'ratio',case when listing_count=0 then null else round(offer_count::numeric/listing_count,2) end,'label',case when listing_count=0 then 'Not enough listings to calculate' else 'Active buyer offers / active listings this week' end);
end; $$;
revoke all on function public.market_demand_pressure(text) from public,anon;
grant execute on function public.market_demand_pressure(text) to authenticated;

create or replace function public.highest_active_offers(p_lot_ids uuid[]) returns table(lot_id uuid,highest_offer numeric) language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null or public.current_app_role() is null or public.current_app_role() not in ('buyer','inspector','supervisor') then raise exception 'Authorized account required'; end if;
 return query select l.id,max(o.price_per_unit) from public.crop_lots l left join public.offers o on o.lot_id=l.id and o.status='active' and o.expires_at>now()
 where l.id=any(p_lot_ids) and l.status='listed' and (l.offer_expires_at is null or l.offer_expires_at>now()) group by l.id;
end; $$;
revoke all on function public.highest_active_offers(uuid[]) from public,anon;
grant execute on function public.highest_active_offers(uuid[]) to authenticated;
