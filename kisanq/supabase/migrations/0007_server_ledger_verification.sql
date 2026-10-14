-- Verify the complete global chain without disclosing records outside the inspector's assigned scope.
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
