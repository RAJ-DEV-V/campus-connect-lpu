import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export interface GeneratePdfOptions {
  title: string;
  subject: string;
  subjectCode: string;
  year: number; // 1, 2, 3, 4
  materialType: string;
  description?: string;
  outputPath?: string;
}

export function formatYearLabel(year: number): string {
  switch (year) {
    case 1:
      return '1ST YEAR';
    case 2:
      return '2ND YEAR';
    case 3:
      return '3RD YEAR';
    case 4:
      return '4TH YEAR';
    default:
      return `YEAR ${year}`;
  }
}

export async function generateSamplePdf(options: GeneratePdfOptions): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // Standard A4
  const { width, height } = page.getSize();

  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontHelveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Top header bar (LPU Orange & Deep Navy)
  page.drawRectangle({
    x: 0,
    y: height - 100,
    width: width,
    height: 100,
    color: rgb(0.06, 0.09, 0.15),
  });

  page.drawRectangle({
    x: 0,
    y: height - 104,
    width: width,
    height: 4,
    color: rgb(0.98, 0.45, 0.09),
  });

  // Header Text
  page.drawText('CAMPUS CONNECT LPU', {
    x: 50,
    y: height - 42,
    size: 20,
    font: fontHelveticaBold,
    color: rgb(0.98, 0.45, 0.09),
  });

  page.drawText('LOVELY PROFESSIONAL UNIVERSITY - ACADEMIC REPOSITORY', {
    x: 50,
    y: height - 60,
    size: 9,
    font: fontHelvetica,
    color: rgb(0.8, 0.85, 0.9),
  });

  page.drawText(`OFFICIAL RESOURCE  |  ${formatYearLabel(options.year)}`, {
    x: 50,
    y: height - 76,
    size: 8,
    font: fontHelveticaBold,
    color: rgb(0.6, 0.7, 0.8),
  });

  // Material Badge Box
  const badgeWidth = 140;
  page.drawRectangle({
    x: width - badgeWidth - 40,
    y: height - 75,
    width: badgeWidth,
    height: 28,
    color: rgb(0.98, 0.45, 0.09),
  });

  page.drawText(options.materialType.toUpperCase(), {
    x: width - badgeWidth - 30,
    y: height - 58,
    size: 11,
    font: fontHelveticaBold,
    color: rgb(1, 1, 1),
  });

  // Subject Title and Code
  let y = height - 140;
  page.drawText(`${options.subjectCode} : ${options.subject}`, {
    x: 50,
    y,
    size: 16,
    font: fontHelveticaBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  y -= 25;
  page.drawText(`Document: ${options.title}`, {
    x: 50,
    y,
    size: 13,
    font: fontHelveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  y -= 20;
  if (options.description) {
    page.drawText(options.description.slice(0, 100), {
      x: 50,
      y,
      size: 10,
      font: fontHelveticaOblique,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  // Divider line
  y -= 20;
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });

  // Content sections
  y -= 30;
  page.drawText('1. OVERVIEW & EXAM BLUEPRINT', {
    x: 50,
    y,
    size: 12,
    font: fontHelveticaBold,
    color: rgb(0.06, 0.09, 0.15),
  });

  y -= 20;
  const overviewPoints = [
    `• Designed specifically for LPU ${formatYearLabel(options.year)} students based on current university syllabus.`,
    `• Covers critical theoretical concepts, high-frequency exam questions, and unit revisions.`,
    `• Verified by academic toppers and subject faculty coordinators.`,
    `• Aligned with continuous assessments, mid-term and end-term examination formats.`,
  ];

  for (const pt of overviewPoints) {
    page.drawText(pt, {
      x: 55,
      y,
      size: 10,
      font: fontHelvetica,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 18;
  }

  // Key Units / Topics Section
  y -= 15;
  page.drawText('2. HIGH-WEIGHTAGE UNITS & TOPICS', {
    x: 50,
    y,
    size: 12,
    font: fontHelveticaBold,
    color: rgb(0.06, 0.09, 0.15),
  });

  y -= 20;
  const topics = [
    `Unit 1: Fundamental Principles, Core Syntax, and Theoretical Foundations`,
    `Unit 2: Algorithmic Complexity, Standard Data Representations & Analysis`,
    `Unit 3: Applied Architecture, System Paradigms, and Implementation Models`,
    `Unit 4: Advanced Problem Solving, Numerical Case Studies & Solved PYQs`,
  ];

  for (let i = 0; i < topics.length; i++) {
    page.drawRectangle({
      x: 50,
      y: y - 10,
      width: width - 100,
      height: 24,
      color: i % 2 === 0 ? rgb(0.96, 0.97, 0.98) : rgb(1, 1, 1),
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 0.5,
    });

    page.drawText(topics[i], {
      x: 60,
      y: y - 3,
      size: 9.5,
      font: fontHelvetica,
      color: rgb(0.15, 0.15, 0.2),
    });
    y -= 30;
  }

  // Sample Solved Questions
  y -= 10;
  page.drawText('3. SAMPLE EXAM PREVIEW / HIGH FREQUENCY QUESTIONS', {
    x: 50,
    y,
    size: 12,
    font: fontHelveticaBold,
    color: rgb(0.06, 0.09, 0.15),
  });

  y -= 20;
  const sampleQuestions = [
    `Q1. Define core principles in ${options.subjectCode}. Analyze time and space tradeoffs.`,
    `Q2. Differentiate between primary structures with practical code/diagram illustrations.`,
    `Q3. Derive key equations or evaluate step-by-step algorithms with boundary conditions.`,
    `Q4. LPU End-Term Examination: Solve the 10-mark application question from Section-C.`,
  ];

  for (const q of sampleQuestions) {
    page.drawText(q, {
      x: 55,
      y,
      size: 9.5,
      font: fontHelvetica,
      color: rgb(0.2, 0.3, 0.4),
    });
    y -= 20;
  }

  // Notice Callout
  y -= 20;
  page.drawRectangle({
    x: 50,
    y: y - 35,
    width: width - 100,
    height: 45,
    color: rgb(1, 0.96, 0.93),
    borderColor: rgb(0.98, 0.45, 0.09),
    borderWidth: 1,
  });

  page.drawText('STUDENT NOTICE: EXCLUSIVE FOR CAMPUS CONNECT LPU MEMBERS', {
    x: 65,
    y: y - 10,
    size: 9,
    font: fontHelveticaBold,
    color: rgb(0.76, 0.25, 0.05),
  });

  page.drawText('Do not resell or re-distribute. Free open academic access for all Lovely Professional University students.', {
    x: 65,
    y: y - 25,
    size: 8.5,
    font: fontHelvetica,
    color: rgb(0.4, 0.2, 0.1),
  });

  // Footer bar
  page.drawLine({
    start: { x: 50, y: 50 },
    end: { x: width - 50, y: 50 },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });

  page.drawText('Campus Connect LPU - Official Academic Repository', {
    x: 50,
    y: 35,
    size: 8,
    font: fontHelvetica,
    color: rgb(0.5, 0.5, 0.5),
  });

  page.drawText('Page 1 of 1 | Academic Reference Document', {
    x: width - 210,
    y: 35,
    size: 8,
    font: fontHelvetica,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);

  if (options.outputPath) {
    const dir = path.dirname(options.outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(options.outputPath, buffer);
  }

  return buffer;
}
