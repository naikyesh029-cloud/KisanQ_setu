import { Gavel } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DisputeDesk } from '@/components/shared/DisputeDesk';
import { getDictionary } from '@/lib/i18n/dictionaries';
export default async function DisputesPage({params}:{params:Promise<{locale:string}>}){const {locale}=await params;const d=getDictionary(locale);return <><PageHeader eyebrow="CASE MANAGEMENT" title={d.disputes} description={d.disputesSub} action={<span className="badge badge-neutral"><Gavel size={13}/>Scoped access</span>}/><DisputeDesk dict={d}/></>}
