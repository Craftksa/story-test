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

const getReportSenderFrom = () =>
	process.env.SMTP_FROM ? `"CRAFT TEAM" <${process.env.SMTP_FROM}>` : process.env.SMTP_FROM;

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
	reportId,
	projectName,
	reportTitle,
	recipients,
	pdfBuffer,
	attachmentFileName,
}: {
	reportId: string;
	projectName: string;
	reportTitle: string;
	recipients: Array<{ name: string; email?: string | null }>;
	pdfBuffer: Buffer;
	attachmentFileName?: string;
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
		from: getReportSenderFrom(),
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
				filename: attachmentFileName || `report-${reportId}.pdf`,
				content: pdfBuffer,
				contentType: "application/pdf",
				contentDisposition: "attachment",
			},
		],
	});
}

export async function sendProjectLetterEmail({
	projectName,
	recipientEmail,
	recipientName,
	letterSubject,
	letterBody,
	letterDate,
	attachments,
}: {
	projectName: string;
	recipientEmail: string;
	recipientName: string;
	letterSubject: string;
	letterBody: string;
	letterDate?: string | null;
	attachments?: Array<{ url: string; name?: string | null }>;
}) {
	if (!isSmtpConfigured()) {
		throw new Error("SMTP is not configured.");
	}

	const attachmentLinks = (attachments ?? []).filter((attachment) => attachment?.url?.trim());
	const formattedLetterDate = letterDate ? new Date(letterDate).toLocaleDateString("en-GB") : null;

	return transporter.sendMail({
		from: getReportSenderFrom(),
		to: recipientEmail.trim(),
		subject: letterSubject,
		html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2 style="color: #1f2937; margin-bottom: 8px;">Official Letter</h2>
        <p style="color: #4b5563; margin: 0 0 16px;">
          A letter has been issued for project <strong>${projectName}</strong>.
        </p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; color: #374151;">
          <p style="margin: 0 0 12px;"><strong>Recipient:</strong> ${recipientName}</p>
          ${formattedLetterDate ? `<p style="margin: 0 0 12px;"><strong>Date:</strong> ${formattedLetterDate}</p>` : ""}
          <p style="margin: 0 0 12px;"><strong>Subject:</strong> ${letterSubject}</p>
          <div style="white-space: pre-line; line-height: 1.8;">${letterBody}</div>
        </div>
        ${
					attachmentLinks.length > 0
						? `
        <div style="margin-top: 16px;">
          <p style="color: #374151; margin: 0 0 8px;"><strong>Attachments</strong></p>
          <ul style="padding-left: 20px; margin: 0;">
            ${attachmentLinks
							.map(
								(attachment) =>
									`<li><a href="${attachment.url}" style="color: #2563eb;">${attachment.name || attachment.url}</a></li>`
							)
							.join("")}
          </ul>
        </div>`
						: ""
				}
      </div>
    `,
	});
}

export function generateOTP(): string {
	return Math.floor(100000 + Math.random() * 900000).toString();
}
