import { NextResponse } from 'next/server';
import {
  analyzeRgbSamples,
  extractSamplesFromBase64,
  type AiQualityReport,
  type RgbColor,
  MANDI_QUALITY_DISCLAIMER
} from '@/lib/domain/aiQualityAnalyzer';

interface AnalyzeRequestBody {
  crop?: string;
  imageBase64?: string;
  samples?: RgbColor[];
}

export async function POST(request: Request) {
  try {
    let body: AnalyzeRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }

    const crop = (body.crop || 'Crop').trim();
    if (!crop || crop.length < 2) {
      return NextResponse.json({ error: 'Please specify a valid crop name (minimum 2 characters).' }, { status: 422 });
    }

    // Check for optional Gemini API key enhancement
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && body.imageBase64 && body.imageBase64.includes(';base64,')) {
      try {
        const mimeType = body.imageBase64.split(';base64,')[0]?.replace('data:', '') || 'image/jpeg';
        const data = body.imageBase64.split(';base64,')[1];

        const prompt = `You are a certified Indian APMC Mandi quality inspector. Analyze this image of ${crop}.
Output ONLY valid JSON matching this schema:
{
  "grade": "A" or "B" or "C" or "rejected",
  "confidence": number between 75 and 98,
  "defectPercentage": number between 0 and 100,
  "uniformityScore": number between 10 and 99,
  "estimatedMoisturePct": number,
  "primaryDefect": string or null,
  "colorConsistency": number between 10 and 99,
  "observations": [string, string],
  "recommendations": [string, string]
}`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inlineData: { mimeType, data } }
              ]
            }],
            generationConfig: { responseMimeType: 'application/json' }
          }),
          signal: AbortSignal.timeout(6000)
        });

        if (res.ok) {
          const geminiData = await res.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            const report: AiQualityReport = {
              crop,
              grade: ['A', 'B', 'C', 'rejected'].includes(parsed.grade) ? parsed.grade : 'B',
              confidence: Number(parsed.confidence) || 88,
              defectPercentage: Number(parsed.defectPercentage) || 6.5,
              uniformityScore: Number(parsed.uniformityScore) || 84,
              estimatedMoisturePct: Number(parsed.estimatedMoisturePct) || 12.0,
              primaryDefect: parsed.primaryDefect || null,
              metrics: {
                uniformityScore: Number(parsed.uniformityScore) || 84,
                defectPercentage: Number(parsed.defectPercentage) || 6.5,
                estimatedMoisturePct: Number(parsed.estimatedMoisturePct) || 12.0,
                colorConsistency: Number(parsed.colorConsistency) || 85,
                blemishCount: Math.round((Number(parsed.defectPercentage) || 6) * 1.5)
              },
              observations: Array.isArray(parsed.observations) ? parsed.observations : ['Visual quality verified.'],
              recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : ['Proceed with mandi slot booking.'],
              disclaimer: MANDI_QUALITY_DISCLAIMER,
              analyzedAt: new Date().toISOString(),
              method: 'gemini_1.5_flash_vision'
            };
            return NextResponse.json({ success: true, report });
          }
        }
      } catch {
        // Fall through to deterministic zero-cost engine gracefully
      }
    }

    // Deterministic $0 computer vision pipeline
    let samples: RgbColor[] = [];
    if (Array.isArray(body.samples) && body.samples.length > 0) {
      samples = body.samples;
    } else if (body.imageBase64) {
      samples = extractSamplesFromBase64(body.imageBase64, crop);
    }

    const report = analyzeRgbSamples(crop, samples);
    return NextResponse.json({ success: true, report });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Quality analysis failed.' },
      { status: 500 }
    );
  }
}
