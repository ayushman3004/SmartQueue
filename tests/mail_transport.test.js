import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import NodemailerHelper from 'nodemailer-otp';

test('OTP helper sends correctly through the patched Nodemailer transport API', async () => {
  const helper = new NodemailerHelper('sender@example.com', 'test-only-password');
  helper.transporter.close();
  const transport = nodemailer.createTransport({ jsonTransport: true });
  helper.transporter = transport;

  let message;
  const sendMail = transport.sendMail.bind(transport);
  transport.sendMail = async (options) => {
    const result = await sendMail(options);
    message = JSON.parse(result.message);
    return result;
  };

  try {
    const otp = helper.generateOtp(6);
    assert.match(otp, /^\d{6}$/);
    const result = await helper.sendEmail(
      'recipient@example.com', 'Verification code', 'Your verification code is', otp,
    );
    assert.equal(result.success, true);
    assert.equal(message.from.address, 'sender@example.com');
    assert.equal(message.to[0].address, 'recipient@example.com');
    assert.equal(message.subject, 'Verification code');
    assert.equal(message.text, `Your verification code is: ${otp}`);
  } finally {
    transport.close();
  }
});
