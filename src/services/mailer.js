const nodemailer = require('nodemailer');

// Configure the transporter
// For local testing, we recommend using Ethereal or a real Gmail (with App Password)
// We'll use a "log-only" fallback if no SMTP_HOST is provided to avoid crashes
let transporter;

if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} else {
  // Mock transporter for development
  transporter = {
    sendMail: async (options) => {
      console.log('📧 [MOCK EMAIL SENT]');
      console.log('To:', options.to);
      console.log('Subject:', options.subject);
      console.log('Body:', options.text);
      return { messageId: 'mock-id' };
    }
  };
}

async function sendFriendRequestEmail(toEmail, senderName) {
  const mailOptions = {
    from: '"PokéRosa 🌸" <noreply@pokerosa.com>',
    to: toEmail,
    subject: `¡Nueva solicitud de amistad de ${senderName}!`,
    text: `Hola! ${senderName} quiere ser tu amigo en PokéRosa. Entra a la aplicación para aceptar la invitación.`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #1a0f16; background: #f8e8f0; border-radius: 12px;">
        <h2 style="color: #ff477e;">🌸 ¡Nueva solicitud de amistad!</h2>
        <p>Hola,</p>
        <p><strong>${senderName}</strong> quiere ser tu amigo en <strong>PokéRosa</strong>.</p>
        <p>Entra a la aplicación para aceptar la invitación y empezar a batallar.</p>
        <hr style="border: none; border-top: 1px solid #ff7096; margin: 20px 0;" />
        <small>Este es un correo automático, por favor no respondas.</small>
      </div>
    `,
  };

  try {
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending email:', error);
    return null;
  }
}

module.exports = {
  sendFriendRequestEmail,
};
