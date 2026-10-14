import { PageHeader } from '@/components/shared/PageHeader';
import { SupervisorAudit } from '@/components/shared/SupervisorAudit';
import { getDictionary } from '@/lib/i18n/dictionaries';
export default async function SupervisorAuditPage({params}:{params:Promise<{locale:string}>}){const {locale}=await params;const d=getDictionary(locale);return <><PageHeader eyebrow="GOVERNANCE" title={d.supervisorAudit} description="Inspect reason-coded quality overrides, offer transitions and dispute resolution history."/><SupervisorAudit dict={d}/></>}
