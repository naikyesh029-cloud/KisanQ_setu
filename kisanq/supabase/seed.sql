-- Repeatable demonstration seed. Every price record is explicitly simulated_demo.
insert into public.mandis(id,name,district,state,location_label,capacity_per_slot,storage_capacity,storage_occupied,active) values
 ('11111111-1111-4111-8111-111111111111','Pimpri Agricultural Market','Pune','Maharashtra','Pimpri, Pune',80,2500,1630,true),
 ('22222222-2222-4222-8222-222222222222','Pune Market Yard','Pune','Maharashtra','Gultekdi, Pune',120,5000,3350,true),
 ('33333333-3333-4333-8333-333333333333','Nashik APMC','Nashik','Maharashtra','Nashik, Maharashtra',90,3200,2100,true)
on conflict(id) do update set name=excluded.name,district=excluded.district,state=excluded.state,location_label=excluded.location_label,capacity_per_slot=excluded.capacity_per_slot,storage_capacity=excluded.storage_capacity,storage_occupied=excluded.storage_occupied,active=excluded.active;
insert into public.slots(id,mandi_id,slot_date,starts_at,ends_at,capacity,booked_count,status) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111',current_date,'08:00','10:00',30,18,'open'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','11111111-1111-4111-8111-111111111111',current_date,'10:00','12:00',30,27,'open'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','11111111-1111-4111-8111-111111111111',current_date,'12:00','14:00',20,6,'open'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','22222222-2222-4222-8222-222222222222',current_date,'08:00','10:00',40,21,'open'),
 ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','33333333-3333-4333-8333-333333333333',current_date,'08:00','10:00',30,19,'open')
on conflict(id) do update set capacity=excluded.capacity,booked_count=least(public.slots.booked_count,excluded.capacity),status=case when public.slots.booked_count>=excluded.capacity then 'full' else 'open' end;
-- Fixed illustrative price points; generated date series makes reseeding idempotent and labels all data as simulated.
with crop_data(crop,base,step,source) as (values
 ('Paddy',2320,10,'KisanQ local simulation'),('Soybean',4680,-10,'KisanQ local simulation'),('Onion',2850,45,'KisanQ local simulation'),
 ('Tomato',1980,30,'KisanQ local simulation'),('Wheat',2750,5,'KisanQ local simulation'),('Cotton',7150,-20,'KisanQ local simulation')),
days as (select generate_series(current_date-6,current_date,interval '1 day')::date as observed_on),
rows as (select m.id mandi_id,c.crop,d.observed_on,greatest(0,c.base-c.step*((current_date-d.observed_on)::int)) as modal,c.source from crop_data c cross join days d cross join (select '11111111-1111-4111-8111-111111111111'::uuid id) m)
insert into public.price_history(mandi_id,crop,observed_on,minimum_price,maximum_price,modal_price,source,source_url,provenance)
select mandi_id,crop,observed_on,modal*0.95,modal*1.05,modal,source,null,'simulated_demo' from rows
on conflict(mandi_id,crop,observed_on,source) do update set minimum_price=excluded.minimum_price,maximum_price=excluded.maximum_price,modal_price=excluded.modal_price,provenance='simulated_demo';
