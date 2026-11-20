import PDFDocument from 'pdfkit';
import { readFileSync } from 'node:fs';

const font = readFileSync(new URL('./fonts/NotoSans-Regular.ttf', import.meta.url));

const fields = [
  ['Symptoms and findings', 'symptoms'], ['Diagnosis', 'diagnosis'],
  ['Medications', 'medications'], ['Investigations', 'investigations'],
  ['Advice', 'advice'], ['Follow-up', 'followUp'],
];

export function prescriptionPdf(prescription) {
  const document = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 52, right: 52 }, info: { Title: 'ServeQ prescription' } });
  document.font(font);
  const paintPage = () => {
    document.save().rect(0, 0, document.page.width, document.page.height).fill('#ffffff').restore();
  };
  paintPage();
  document.on('pageAdded', paintPage);
  const chunks = [];
  const output = new Promise((resolve, reject) => {
    document.on('data', chunk => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });
  document.fillColor('#145341').fontSize(12).text(prescription.clinicName);
  document.fontSize(29).text('Prescription').moveDown(0.5);
  document.fillColor('#253731').fontSize(11)
    .text(`Patient: ${prescription.patientName}`)
    .text(`Prescribing doctor: ${prescription.doctorName}`)
    .text(`Registration ID: ${prescription.doctorId}`)
    .text(`Issued: ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(prescription.createdAt))}`)
    .text(`Consultation reference: ${prescription.booking}`).moveDown();
  for (const [label, key] of fields) {
    if (!prescription[key]) continue;
    if (document.y > document.page.height - 130) document.addPage();
    document.fillColor('#145341').fontSize(13).text(label, { continued: false });
    document.fillColor('#253731').fontSize(11).text(prescription[key], { lineGap: 3 }).moveDown();
  }
  document.end();
  return output;
}
