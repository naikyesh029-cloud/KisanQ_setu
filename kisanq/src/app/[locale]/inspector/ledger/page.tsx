import { Fingerprint } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { LedgerVerifier } from '@/components/shared/LedgerVerifier';
import { getDictionary } from '@/lib/i18n/dictionaries';
export default async function LedgerPage({params}:{params:Promise<{locale:string}>}){const {locale}=await params;const d=getDictionary(locale);return <><PageHeader eyebrow="INSPECTOR · AUDIT" title={d.ledger} description="Review the tamper-evident audit trail and verify event-chain integrity." action={<span className="badge badge-neutral"><Fingerprint size={13}/>SHA-256</span>}/><LedgerVerifier dict={d}/></>}
