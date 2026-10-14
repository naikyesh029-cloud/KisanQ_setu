-- Consent can only be recorded for the authenticated user's own profile through this narrow RPC.
create or replace function public.guard_profile_update() returns trigger language plpgsql as $$
begin
 if auth.uid() is not null and auth.uid() = old.id then
  if new.role is distinct from old.role or new.mandi_scope is distinct from old.mandi_scope then
   raise exception 'Protected profile fields cannot be changed by the account holder';
  end if;
  if (new.consent_version is distinct from old.consent_version or new.consent_at is distinct from old.consent_at)
    and current_setting('kisanq.allow_consent_update',true) is distinct from 'on' then
   raise exception 'Consent fields must be updated through the consent RPC';
  end if;
 end if;
 new.updated_at := now(); return new;
end; $$;
create or replace function public.record_user_consent(p_version text) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_version is null or p_version not in ('kisanq-consent-v1') then raise exception 'Unsupported consent version'; end if;
 perform set_config('kisanq.allow_consent_update','on',true);
 update public.profiles set consent_version=p_version,consent_at=now(),updated_at=now() where id=auth.uid();
 if not found then raise exception 'Profile not found'; end if;
end; $$;
revoke all on function public.record_user_consent(text) from public,anon;
grant execute on function public.record_user_consent(text) to authenticated;

-- Audit critical mutations in the same transaction as the business write.
create or replace function public.audit_lot_mutation() returns trigger language plpgsql security definer set search_path=public as $$
declare payload jsonb; action_name text;
begin
 if tg_op='INSERT' then payload:=jsonb_build_object('lot_id',new.id,'farmer_id',new.farmer_id,'crop',new.crop,'variety',new.variety,'quantity',new.quantity,'unit',new.unit,'status',new.status,'mandi_id',new.mandi_id); action_name:='crop_lot_created';
 else payload:=jsonb_build_object('lot_id',new.id,'status_before',old.status,'status_after',new.status,'asking_price_before',old.asking_price,'asking_price_after',new.asking_price,'verified_grade_before',old.verified_grade,'verified_grade_after',new.verified_grade,'verified_weight_before',old.verified_weight,'verified_weight_after',new.verified_weight); action_name:='crop_lot_updated'; end if;
 perform public.append_audit_event('crop_lot',new.id,action_name,payload); return new;
end; $$;
drop trigger if exists crop_lots_audit_insert on public.crop_lots;
create trigger crop_lots_audit_insert after insert on public.crop_lots for each row execute function public.audit_lot_mutation();
drop trigger if exists crop_lots_audit_update on public.crop_lots;
create trigger crop_lots_audit_update after update of status,asking_price,verified_grade,verified_weight,verified_moisture_pct on public.crop_lots for each row when (old.status is distinct from new.status or old.asking_price is distinct from new.asking_price or old.verified_grade is distinct from new.verified_grade or old.verified_weight is distinct from new.verified_weight or old.verified_moisture_pct is distinct from new.verified_moisture_pct) execute function public.audit_lot_mutation();

create or replace function public.audit_offer_mutation() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then perform public.append_audit_event('offer',new.id,'offer_created',jsonb_build_object('offer_id',new.id,'lot_id',new.lot_id,'buyer_id',new.buyer_id,'price_per_unit',new.price_per_unit,'status',new.status));
 elsif old.status is distinct from new.status then perform public.append_audit_event('offer',new.id,'offer_status_changed',jsonb_build_object('offer_id',new.id,'lot_id',new.lot_id,'status_before',old.status,'status_after',new.status)); end if;
 return new;
end; $$;
drop trigger if exists offers_audit_insert on public.offers;
create trigger offers_audit_insert after insert on public.offers for each row execute function public.audit_offer_mutation();
drop trigger if exists offers_audit_update on public.offers;
create trigger offers_audit_update after update of status on public.offers for each row when (old.status is distinct from new.status) execute function public.audit_offer_mutation();

create or replace function public.audit_inspection_insert() returns trigger language plpgsql security definer set search_path=public as $$
begin perform public.append_audit_event('inspection',new.id,'physical_inspection_recorded',jsonb_build_object('inspection_id',new.id,'lot_id',new.lot_id,'inspector_id',new.inspector_id,'verified_grade',new.verified_grade,'verified_weight',new.verified_weight,'moisture_pct',new.moisture_pct,'reason_code',new.reason_code,'explanation',new.explanation,'estimate_before',new.estimate_before,'values_before',new.values_before),new.reason_code); return new; end; $$;
drop trigger if exists inspections_audit_insert on public.inspections;
create trigger inspections_audit_insert after insert on public.inspections for each row execute function public.audit_inspection_insert();

create or replace function public.audit_dispute_mutation() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then perform public.append_audit_event('dispute',new.id,'dispute_created',jsonb_build_object('dispute_id',new.id,'lot_id',new.lot_id,'offer_id',new.offer_id,'raised_by',new.raised_by,'reason_code',new.reason_code,'status',new.status),new.reason_code);
 elsif old.status is distinct from new.status or old.resolution is distinct from new.resolution then perform public.append_audit_event('dispute',new.id,'dispute_status_changed',jsonb_build_object('dispute_id',new.id,'status_before',old.status,'status_after',new.status,'resolution',new.resolution,'resolved_by',new.resolved_by)); end if;
 return new;
end; $$;
drop trigger if exists disputes_audit_insert on public.disputes;
create trigger disputes_audit_insert after insert on public.disputes for each row execute function public.audit_dispute_mutation();
drop trigger if exists disputes_audit_update on public.disputes;
create trigger disputes_audit_update after update of status,resolution on public.disputes for each row when (old.status is distinct from new.status or old.resolution is distinct from new.resolution) execute function public.audit_dispute_mutation();

-- A buyer/farmer may see a dispute tied to an offer they own or a lot they own.
drop policy if exists disputes_read_scope on public.disputes;
create policy disputes_read_scope on public.disputes for select to authenticated using(
 raised_by=auth.uid() or
 exists(select 1 from public.offers o where o.id=offer_id and o.buyer_id=auth.uid()) or
 exists(select 1 from public.crop_lots l where l.id=lot_id and l.farmer_id=auth.uid()) or
 (public.current_app_role() in ('inspector','supervisor') and (public.current_app_role()='supervisor' or exists(select 1 from public.crop_lots l join public.profiles p on p.id=auth.uid() where l.id=lot_id and (p.mandi_scope is not null and l.mandi_id=any(p.mandi_scope)))))
);
