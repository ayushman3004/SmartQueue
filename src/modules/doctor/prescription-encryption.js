import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import ApiError from '../../../utils/ApiError.js';

export const clinicalFields = [
  'doctorName', 'doctorId', 'patientName', 'clinicName', 'symptoms', 'diagnosis',
  'medications', 'investigations', 'advice', 'followUp', 'followUpDate',
];

function encryptionKey() {
  const hex = process.env.PRESCRIPTION_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) {
    throw new ApiError(503, 'Prescription encryption is unavailable.');
  }
  return Buffer.from(hex, 'hex');
}

function associatedData({ _id, booking, business, doctor, patient }) {
  return Buffer.from(JSON.stringify(['serveq:prescription:v1', _id, booking, business, doctor, patient].map(String)));
}

export function encryptPrescription(record, fields) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), nonce);
  cipher.setAAD(associatedData(record));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(fields), 'utf8'), cipher.final()]);
  return ['v1', ...[nonce, cipher.getAuthTag(), ciphertext].map(bytes => bytes.toString('base64url'))].join('.');
}

export function decryptPrescription(record, envelope) {
  const key = encryptionKey();
  try {
    const parts = envelope.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') throw new Error();
    const [nonce, tag, ciphertext] = parts.slice(1).map(part => Buffer.from(part, 'base64url'));
    if (nonce.length !== 12 || tag.length !== 16) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAAD(associatedData(record));
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
  } catch {
    throw new ApiError(500, 'Could not decrypt the prescription.');
  }
}

export function readPrescription(document) {
  const prescription = document.toObject?.() || document;
  const { _id, booking, business, doctor, patient, createdAt, updatedAt, encryptedClinicalData } = prescription;
  const clinical = encryptedClinicalData === undefined ? prescription : decryptPrescription(prescription, encryptedClinicalData);
  return {
    _id, booking, business, doctor, patient, createdAt, updatedAt,
    ...Object.fromEntries(clinicalFields.map(field => [field, clinical[field]])),
  };
}
