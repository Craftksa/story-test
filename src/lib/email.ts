import nodemailer from 'nodemailer';

export const isSmtpConfigured = () =>
	!!process.env.SMTP_HOST &&
	!!process.env.SMTP_PORT &&
	!!process.env.SMTP_USER &&
	!!process.env.SMTP_PASS &&
	!!process.env.SMTP_FROM;

const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: parseInt(process.env.SMTP_PORT || '587'),
	secure: process.env.SMTP_SECURE === 'true',
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS,
	},
});

export async function sendPasswordResetEmail(email: string, otp: string) {
	if (!isSmtpConfigured()) {
		throw new Error("SMTP is not configured.");
	}

	const mailOptions = {
		from: process.env.SMTP_FROM,
		to: email,
		subject: 'Password Reset Request',
		html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>You have requested to reset your password. Please use the following OTP to continue:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #2563eb; letter-spacing: 3px; margin: 0;">${otp}</h1>
        </div>
        <p style="color: #666;">This OTP will expire in 10 minutes.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
      </div>
    `,
	};

	return transporter.sendMail(mailOptions);
}

export async function sendProjectReportEmail({
	projectName,
	reportTitle,
	recipients,
	pdfBuffer,
}: {
	projectName: string;
	reportTitle: string;
	recipients: Array<{ name: string; email?: string | null }>;
	pdfBuffer: Buffer;
}) {
	const recipientEmails = recipients
		.map((recipient) => recipient.email?.trim())
		.filter((email): email is string => !!email);

	if (recipientEmails.length === 0) {
		return null;
	}

	if (!isSmtpConfigured()) {
		throw new Error("SMTP is not configured.");
	}

	return transporter.sendMail({
		from: process.env.SMTP_FROM,
		to: recipientEmails.join(", "),
		subject: `Project Report - ${reportTitle}`,
		html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2 style="color: #1f2937; margin-bottom: 8px;">Project Report</h2>
        <p style="color: #4b5563; margin: 0 0 16px;">A new report has been issued for project <strong>${projectName}</strong>.</p>
        <p style="color: #4b5563;">Please find the attached PDF report.</p>
      </div>
    `,
		attachments: [
			{
				filename: `${reportTitle}.pdf`,
				content: pdfBuffer,
				contentType: "application/pdf",
			},
		],
	});
}

export function generateOTP(): string {
	return Math.floor(100000 + Math.random() * 900000).toString();
}
