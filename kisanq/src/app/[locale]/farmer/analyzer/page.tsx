import { PageHeader } from '@/components/shared/PageHeader';
import { AiQualityAnalyzer } from '@/components/shared/AiQualityAnalyzer';
export default async function FarmerAnalyzerPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ crop?: string }>;
}) {
  const { locale } = await params;
  const sParams = await searchParams;

  return (
    <>
      <PageHeader
        eyebrow="OPTICAL HARVEST GRADING"
        title="AI Crop Quality Analyzer"
        description="Instant visual pre-grading for color uniformity, surface defect detection, and moisture estimation before mandi arrival."
      />
      <div style={{ marginTop: 20 }}>
        <AiQualityAnalyzer locale={locale} initialCrop={sParams?.crop || 'Tomato'} />
      </div>
    </>
  );
}
