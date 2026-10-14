create or replace function public.set_lot_offer_expiry() returns trigger language plpgsql as $$
declare hours integer;
begin
 if new.offer_expires_at is null then
  select offer_window_hours into hours from public.crop_profiles where crop_key=lower(trim(new.crop));
  if hours is null then hours:=12; end if;
  new.offer_expires_at:=now()+make_interval(hours=>hours);
 end if;
 return new;
end; $$;
drop trigger if exists crop_lots_set_expiry on public.crop_lots;
create trigger crop_lots_set_expiry before insert on public.crop_lots for each row execute function public.set_lot_offer_expiry();

create or replace function public.record_inspection(p_lot_id uuid,p_verified_grade text,p_verified_weight numeric,p_moisture_pct numeric,p_reason_code text,p_explanation text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); actor_role public.app_role; lot public.crop_lots; inspection public.inspections; before_values jsonb;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 select role into actor_role from public.profiles where id=actor;
 if actor_role is null or actor_role not in ('inspector','supervisor') then raise exception 'Inspector role required'; end if;
 select * into lot from public.crop_lots where id=p_lot_id for update;
 if lot.id is null then raise exception 'Lot not found'; end if;
 if lot.status not in ('checked_in','inspected') then raise exception 'Lot must be checked in before physical inspection'; end if;
 if actor_role='inspector' and not exists(select 1 from public.profiles p where p.id=actor and (p.mandi_scope is not null and lot.mandi_id=any(p.mandi_scope))) then raise exception 'Inspector is outside assigned mandi scope'; end if;
 if p_verified_grade is null or p_verified_grade not in ('A','B','C','rejected') or p_verified_weight is null or p_verified_weight<=0 or p_reason_code is null or p_reason_code not in ('estimate_mismatch','weight_correction','moisture_correction','physical_condition','other') or p_explanation is null or length(trim(p_explanation))<8 then raise exception 'Valid grade, weight, reason and explanation required'; end if;
 before_values:=jsonb_build_object('ai_pregrade',lot.ai_pregrade,'ai_pregrade_confidence',lot.ai_pregrade_confidence,'quantity',lot.quantity,'unit',lot.unit,'moisture_pct',lot.moisture_pct,'verified_grade',lot.verified_grade,'verified_weight',lot.verified_weight);
 insert into public.inspections(lot_id,inspector_id,verified_grade,verified_weight,moisture_pct,reason_code,explanation,estimate_before,values_before)
 values(lot.id,actor,p_verified_grade,p_verified_weight,p_moisture_pct,p_reason_code,p_explanation,jsonb_build_object('ai_pregrade',lot.ai_pregrade,'confidence',lot.ai_pregrade_confidence,'method',lot.grading_method),before_values) returning * into inspection;
 update public.crop_lots set verified_grade=p_verified_grade,verified_weight=p_verified_weight,verified_moisture_pct=p_moisture_pct,status='inspected',updated_at=now() where id=lot.id;
 return jsonb_build_object('inspection_id',inspection.id,'lot_id',lot.id,'verified_grade',p_verified_grade,'verified_weight',p_verified_weight,'status','inspected');
end; $$;
revoke all on function public.record_inspection(uuid,text,numeric,numeric,text,text) from public,anon;
grant execute on function public.record_inspection(uuid,text,numeric,numeric,text,text) to authenticated;
