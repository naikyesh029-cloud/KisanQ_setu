create or replace function public.check_in_token(p_token_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); actor_role public.app_role; tok public.tokens; lot public.crop_lots;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 select role into actor_role from public.profiles where id=actor;
 if actor_role is null or actor_role not in ('inspector','supervisor') then raise exception 'Inspector role required'; end if;
 select * into tok from public.tokens where token_code=p_token_code for update;
 if tok.id is null then raise exception 'Token not found'; end if;
 select * into lot from public.crop_lots where id=tok.lot_id for update;
 if lot.id is null then raise exception 'Crop lot not found'; end if;
 if actor_role='inspector' and not exists(select 1 from public.profiles p where p.id=actor and p.mandi_scope is not null and lot.mandi_id=any(p.mandi_scope)) then raise exception 'Inspector is outside assigned mandi scope'; end if;
 if tok.status<>'reserved' or lot.status<>'reserved' then raise exception 'Token or lot is not awaiting check-in'; end if;
 update public.tokens set status='checked_in',check_in_at=now(),updated_at=now() where id=tok.id;
 update public.crop_lots set status='checked_in',updated_at=now() where id=lot.id;
 perform public.append_audit_event('token',tok.id,'physical_check_in_recorded',jsonb_build_object('token_id',tok.id,'lot_id',lot.id,'slot_id',tok.slot_id,'token_code',tok.token_code));
 return jsonb_build_object('token_id',tok.id,'lot_id',lot.id,'token_code',tok.token_code,'status','checked_in','checked_in_at',now());
end; $$;
revoke all on function public.check_in_token(text) from public,anon;
grant execute on function public.check_in_token(text) to authenticated;
