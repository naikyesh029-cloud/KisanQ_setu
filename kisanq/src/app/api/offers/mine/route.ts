import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
 const supabase=await createSupabaseServerClient(); if(!supabase)return NextResponse.json({error:'Supabase is not configured.',offers:[]},{status:503});
 const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:'Sign in to view offers.',offers:[]},{status:401});
 const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single(); if(profile?.role!=='buyer')return NextResponse.json({error:'Only buyer accounts can view buyer offer history.',offers:[]},{status:403});
 const {data,error}=await supabase.from('offers').select('id,lot_id,price_per_unit,status,expires_at,created_at,crop_lots:crop_lots!offers_lot_id_fkey(crop,variety,unit,mandi_id)').eq('buyer_id',user.id).order('created_at',{ascending:false}).limit(100);
 if(error)return NextResponse.json({error:'Could not load offers.',offers:[]},{status:400});return NextResponse.json({offers:data??[]});
}
