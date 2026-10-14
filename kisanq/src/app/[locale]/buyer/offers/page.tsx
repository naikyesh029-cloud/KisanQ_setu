import { WalletCards } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { OfferHistory } from '@/components/shared/OfferHistory';
import { getDictionary } from '@/lib/i18n/dictionaries';
export default async function BuyerOffersPage({params}:{params:Promise<{locale:string}>}){const {locale}=await params;const d=getDictionary(locale);return <><PageHeader eyebrow="BUYER WORKSPACE" title={d.myOffers} description="Review offers you've submitted and their current status." action={<span className="badge badge-neutral"><WalletCards size={13}/>Buyer offers</span>}/><OfferHistory dict={d}/></>}
