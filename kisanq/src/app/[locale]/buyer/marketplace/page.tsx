import { ShoppingBasket } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Marketplace } from '@/components/shared/Marketplace';
import { getDictionary } from '@/lib/i18n/dictionaries';
export default async function MarketplacePage({params}:{params:Promise<{locale:string}>}) {const {locale}=await params;const d=getDictionary(locale);return <><PageHeader eyebrow="BUYER WORKSPACE" title={d.marketplace} description="Browse listed crop lots, compare grades and submit offers directly to farmers." action={<span className="badge badge-neutral"><ShoppingBasket size={13}/>Offer workflow</span>}/><Marketplace dict={d}/></>}
