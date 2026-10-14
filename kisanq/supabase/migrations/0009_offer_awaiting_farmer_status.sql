-- A winning offer remains explicitly pending farmer confirmation after the listing closes.
alter type public.offer_status add value if not exists 'awaiting_farmer';
