require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { Pool } = require("pg");
const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminDeleteUserCommand } = require("@aws-sdk/client-cognito-identity-provider");
// const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const { CognitoJwtVerifier } = require("aws-jwt-verify");
const fs = require("fs");
const path = require("path");

const app = express();
app.set("trust proxy", 1); // Required behind ALB for rate limiter

const s3 = new S3Client({ region: "ca-central-1" });
// const sns = new SNSClient({ region: process.env.SNS_REGION || "ca-central-1" });
const ses = new SESClient({ region: process.env.SES_REGION || "ca-central-1" });
// const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const S3_BUCKET = process.env.S3_BUCKET || "aires-inspect-test";
console.log("🪣 S3 Bucket configured:", S3_BUCKET);
console.log("🔑 AWS Access Key ID:", process.env.AWS_ACCESS_KEY_ID ? "✅ Loaded" : "❌ NOT FOUND");
console.log("🔑 AWS Secret Access Key:", process.env.AWS_SECRET_ACCESS_KEY ? "✅ Loaded" : "❌ NOT FOUND");
console.log("📍 AWS Region:", process.env.AWS_DEFAULT_REGION || "ca-central-1");
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL || "no-reply@test.aires-risk.com";

const cognito = new CognitoIdentityProviderClient({ region: process.env.COGNITO_REGION || "ca-central-1" });
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

const jwtVerifier = USER_POOL_ID && process.env.COGNITO_CLIENT_ID
  ? CognitoJwtVerifier.create({
      userPoolId: USER_POOL_ID,
      tokenUse: "id",
      clientId: process.env.COGNITO_CLIENT_ID,
    })
  : null;
const CSV_KEY = "Client-Payment-info/submissions.csv";

const CSV_HEADERS = [
  "Paid At", "Company Name", "Industry", "Jurisdiction", "Post No",
  "Address", "City", "State", "Country", "Postal Code",
  "Contact Person", "Email", "Phone Number", "Role", "AI Regulated",
  "Reason for Assessment", "Payment Method", "Payment Amount (USD)",
  "Payment Successful", "Invoice Number", "Invoice Date",
  "Invoice Amount", "Currency", "Invoice Status", "Invoice PDF URL",
  "Stripe Session ID", "Secondary User Name", "Secondary User Email", "Secondary User Added At"
];

//PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organization (
        organization_id SERIAL PRIMARY KEY,
        company_name VARCHAR(500),
        industry VARCHAR(255),
        jurisdiction VARCHAR(255),
        post_no VARCHAR(100),
        address VARCHAR(500),
        city VARCHAR(255),
        state VARCHAR(255),
        country VARCHAR(255),
        postal_code VARCHAR(50),
        contact_person VARCHAR(500),
        email VARCHAR(500),
        phone_number VARCHAR(100),
        role VARCHAR(255),
        is_ai_regulated BOOLEAN,
        reason_for_assessment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment (
        payment_id SERIAL PRIMARY KEY,
        organization_id INT REFERENCES organization(organization_id),
        stripe_session_id VARCHAR(255) UNIQUE,
        email_address VARCHAR(500),
        payment_method VARCHAR(100),
        payment_amount DECIMAL(10,2),
        payment_successful BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoice (
        invoice_id SERIAL PRIMARY KEY,
        organization_id INT REFERENCES organization(organization_id),
        payment_id INT REFERENCES payment(payment_id),
        invoice_number VARCHAR(255),
        invoice_date TIMESTAMPTZ,
        invoice_amount DECIMAL(10,2),
        currency VARCHAR(10),
        invoice_status VARCHAR(100),
        invoice_pdf_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        refund_initiated BOOLEAN DEFAULT FALSE
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS secondary_user (
        secondary_user_id SERIAL PRIMARY KEY,
        organization_id INT REFERENCES organization(organization_id),
        name VARCHAR(500),
        email VARCHAR(500) UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS assessment_session (
        session_id SERIAL PRIMARY KEY,
        organization_id INT REFERENCES organization(organization_id),
        session_token UUID DEFAULT gen_random_uuid() UNIQUE,
        status VARCHAR(50) DEFAULT 'not_started',
        started_at TIMESTAMPTZ,
        submitted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS assessment_response (
        response_id SERIAL PRIMARY KEY,
        session_id INT REFERENCES assessment_session(session_id),
        question_id VARCHAR(100),
        question_text TEXT,
        answer TEXT,
        answered_by VARCHAR(500),
        answered_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(session_id, question_id)
      )
    `);
    console.log("Database ready");
  } catch (err) {
    console.error("DB init error:", err.message);
  }
}
initDb();

// S3 CSV helpers
async function getCsvFromS3() {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: CSV_KEY }));
    const chunks = [];
    for await (const chunk of res.Body) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf-8");
  } catch (err) {
    if (err.name === "NoSuchKey") return null;
    throw err;
  }
}

async function appendCsvRow(row) {
  try {
    console.log("📝 appendCsvRow called - attempting to write to S3...");
    const existing = await getCsvFromS3();
    const newLine = row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
    let content;
    if (!existing) {
      const headers = CSV_HEADERS.map(h => `"${h}"`).join(",");
      content = headers + "\n" + newLine + "\n";
      console.log("📝 Creating new CSV file...");
    } else {
      content = existing.trimEnd() + "\n" + newLine + "\n";
      console.log("📝 Appending to existing CSV...");
    }
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: CSV_KEY,
      Body: content,
      ContentType: "text/csv",
    }));
    console.log("✅ CSV updated in S3 successfully");
  } catch (err) {
    console.error("❌ appendCsvRow error:", err.message);
    console.error("❌ Error code:", err.Code);
    throw err;
  }
}

// Send invoice email via SES
async function sendInvoiceEmail(customerEmail, orgName, contactName, paymentAmount, invoiceNumber, invoiceDate, invoiceAmount, currency, invoicePdfUrl) {
  console.log("📧 sendInvoiceEmail called with:", { customerEmail, orgName });

  if (!customerEmail) {
    console.log("No customer email — skipping invoice email");
    return;
  }

  // Use static Cognito login URL from environment
  const cognitoLoginUrl = process.env.COGNITO_LOGIN_URL || null;

  const formattedDate = invoiceDate ? new Date(invoiceDate).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric"
  }) : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f9fafb;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          padding: 30px;
        }
        .greeting {
          font-size: 16px;
          margin-bottom: 20px;
        }
        .confirmation-box {
          background: #ecfdf5;
          border-left: 4px solid #10b981;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .confirmation-box p {
          margin: 5px 0;
          font-size: 14px;
        }
        .invoice-section {
          margin: 30px 0;
          border-top: 1px solid #e5e7eb;
          padding-top: 20px;
        }
        .invoice-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 15px;
          color: #1f2937;
        }
        .invoice-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        .detail-row {
          font-size: 14px;
        }
        .detail-label {
          color: #6b7280;
          font-weight: 500;
          margin-bottom: 3px;
        }
        .detail-value {
          color: #1f2937;
          font-weight: 600;
        }
        .amount-box {
          background: #f3f4f6;
          padding: 20px;
          border-radius: 6px;
          margin: 20px 0;
          text-align: center;
        }
        .amount-label {
          color: #6b7280;
          font-size: 14px;
          margin-bottom: 8px;
        }
        .amount-value {
          font-size: 32px;
          font-weight: 700;
          color: #1f2937;
        }
        .next-steps {
          margin: 30px 0;
          border-top: 1px solid #e5e7eb;
          padding-top: 20px;
        }
        .next-steps-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
          color: #1f2937;
        }
        .steps-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .steps-list li {
          padding: 8px 0 8px 30px;
          position: relative;
          font-size: 14px;
          color: #374151;
        }
        .steps-list li:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #10b981;
          font-weight: bold;
          font-size: 16px;
        }
        .button-group {
          margin: 25px 0;
          text-align: center;
        }
        .button {
          display: inline-block;
          background: #667eea;
          color: white;
          text-decoration: none;
          padding: 12px 30px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 14px;
          margin: 0 10px;
        }
        .button:hover {
          background: #5568d3;
        }
        .button-secondary {
          background: #e5e7eb;
          color: #1f2937;
        }
        .button-secondary:hover {
          background: #d1d5db;
        }
        .footer {
          background: #f9fafb;
          border-top: 1px solid #e5e7eb;
          padding: 20px 30px;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
        .footer p {
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✓ Payment Confirmed</h1>
        </div>

        <div class="content">
          <div class="greeting">
            <p>Dear ${contactName || 'Valued Customer'},</p>
            <p>Thank you for your payment for the AIRES LITE Assessment. Your invoice details are below.</p>
          </div>

          <div class="confirmation-box">
            <p><strong>Status:</strong> Payment successfully received and processed</p>
            <p><strong>Company:</strong> ${orgName || 'N/A'}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
          </div>

          <div class="invoice-section">
            <div class="invoice-title">Invoice Details</div>
            <div class="invoice-details">
              <div class="detail-row">
                <div class="detail-label">Invoice Number</div>
                <div class="detail-value">${invoiceNumber || 'N/A'}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Invoice Date</div>
                <div class="detail-value">${formattedDate}</div>
              </div>
            </div>

            <div class="amount-box">
              <div class="amount-label">Amount Paid</div>
              <div class="amount-value">${currency || 'USD'} $${paymentAmount || '0.00'}</div>
            </div>
          </div>

          <div class="next-steps">
            <div class="next-steps-title">What's Next?</div>
            <ul class="steps-list">
              <li>You will receive access to the AIRES assessment portal within 24 hours</li>
              <li>A secure login link has been sent to this email address</li>
              <li>Complete your AI risk assessment and receive your personalized remediation plan</li>
              <li>Our team is standing by for support — reply to this email anytime</li>
            </ul>
          </div>

          <div class="button-group">
            ${cognitoLoginUrl ? `<a href="${cognitoLoginUrl}" class="button" style="background: #10b981;">Login to Portal</a>` : ''}
            ${invoicePdfUrl ? `<a href="${invoicePdfUrl}" class="button" style="background: #667eea;">View Invoice PDF</a>` : ''}
          </div>

          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; font-size: 13px; color: #6b7280;">
            <p><strong>Questions?</strong> Contact our support team at payments@test.aires-risk.com or reply directly to this email.</p>
          </div>
        </div>

        <div class="footer">
          <p>&copy; 2026 AIRES Assessment Platform. All rights reserved.</p>
          <p>This is an automated message — please do not reply directly to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const params = {
    Source: SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [customerEmail],
    },
    Message: {
      Subject: {
        Data: `Payment Confirmed – Invoice #${invoiceNumber || 'PENDING'} | AIRES Assessment`,
      },
      Body: {
        Html: {
          Data: htmlBody,
        },
      },
    },
  };

  try {
    console.log("🔄 About to send email via SES from:", SES_FROM_EMAIL);
    await ses.send(new SendEmailCommand(params));
    console.log("✅ Invoice email sent to", customerEmail);
  } catch (err) {
    console.error("❌ SES email error:", err.message);
    console.error("Full error:", err);
  }
}

// Security Middleware
app.use(helmet());
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const FRONTEND_BASE = FRONTEND_URL.replace(/^https?:\/\//, "");
// In production FRONTEND_URL = https://app.aires-risk.com (set via ECS secret / .env)
// localhost is only permitted when NODE_ENV !== production
const ALLOW_LOCALHOST = process.env.NODE_ENV !== "production";
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // same-origin / curl / ALB health checks
    const cleanOrigin = origin.replace(/^https?:\/\//, "");
    const isAllowed =
      cleanOrigin === FRONTEND_BASE ||
      (ALLOW_LOCALHOST && (origin === "http://localhost:5173" || origin === "https://localhost:5173"));
    if (isAllowed) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST"],
}));

// Stripe webhook — must use raw body, registered BEFORE express.json()
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not set");
    return res.status(500).send("Webhook secret not configured");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const paidAt = new Date().toISOString();

    console.log("Payment confirmed:", session.id);

    // Retrieve invoice from Stripe
    let invoiceNumber = "", invoiceDate = "", invoiceAmount = "", currency = "",
        invoiceStatus = "", invoicePdfUrl = "";
    if (session.invoice) {
      try {
        const inv = await stripe.invoices.retrieve(session.invoice);
        invoiceNumber = inv.number || "";
        invoiceDate = inv.created ? new Date(inv.created * 1000).toISOString() : "";
        invoiceAmount = ((inv.amount_paid || 0) / 100).toFixed(2);
        currency = (inv.currency || "").toUpperCase();
        invoiceStatus = inv.status || "";
        invoicePdfUrl = inv.invoice_pdf || "";
      } catch (e) {
        console.error("Could not retrieve invoice:", e.message);
      }
    }

    
    try {
      const meta = session.metadata || {};
      
      let paymentRes = await pool.query(
        `UPDATE payment SET payment_successful = TRUE
         WHERE stripe_session_id = $1
         RETURNING payment_id, organization_id, email_address, payment_amount`,
        [session.id]
      );

      // If no existing row (checkout RDS write failed), create org + payment now
      if (paymentRes.rows.length === 0) {
        console.log("No existing payment row — inserting from webhook metadata");
        const isAiRegulated = meta.aiRegulated === "Yes" ? true
          : meta.aiRegulated === "No" ? false : null;
        const customerEmail = session.customer_details?.email || meta.contactEmail;

        const orgRes2 = await pool.query(
          `INSERT INTO organization (
            company_name, industry, jurisdiction, post_no, address, city, state,
            country, postal_code, contact_person, email, phone_number, role,
            is_ai_regulated, reason_for_assessment
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          RETURNING organization_id`,
          [
            meta.companyName, meta.industry, meta.jurisdiction, meta.postNo,
            meta.address, meta.city, meta.state, meta.country, meta.postalCode,
            meta.contactName, customerEmail, meta.contactPhone, meta.contactRole,
            isAiRegulated, meta.reason
          ]
        );
        const orgId = orgRes2.rows[0].organization_id;

        const pmtRes2 = await pool.query(
          `INSERT INTO payment (
            organization_id, stripe_session_id, email_address,
            payment_method, payment_amount, payment_successful
          ) VALUES ($1,$2,$3,'card',49.99,TRUE)
          RETURNING payment_id, organization_id, email_address, payment_amount`,
          [orgId, session.id, customerEmail]
        );
        paymentRes = { rows: pmtRes2.rows };
      }

      if (paymentRes.rows.length > 0) {
        const { payment_id, organization_id, email_address, payment_amount } = paymentRes.rows[0];

        await pool.query(
          `INSERT INTO invoice (
            organization_id, payment_id, invoice_number, invoice_date,
            invoice_amount, currency, invoice_status, invoice_pdf_url
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT DO NOTHING`,
          [
            organization_id, payment_id, invoiceNumber,
            invoiceDate || null, invoiceAmount || null,
            currency, invoiceStatus, invoicePdfUrl
          ]
        );

        // Fetch org details for CSV
        const orgRes = await pool.query(
          `SELECT * FROM organization WHERE organization_id = $1`, [organization_id]
        );
        const org = orgRes.rows[0] || {};

        // Append to S3 CSV
        try {
          console.log("📊 Attempting to write payment data to S3...");
          await appendCsvRow([
            paidAt,
            org.company_name, org.industry, org.jurisdiction, org.post_no,
            org.address, org.city, org.state, org.country, org.postal_code,
            org.contact_person, email_address || org.email, org.phone_number,
            org.role, org.is_ai_regulated ? "Yes" : "No", org.reason_for_assessment,
            "card", payment_amount, "Yes",
            invoiceNumber, invoiceDate, invoiceAmount, currency, invoiceStatus, invoicePdfUrl,
            session.id
          ]);
          console.log("✅ RDS and S3 updated successfully");
        } catch (s3Err) {
          console.error("❌ S3 CSV append error (non-fatal):", s3Err.message);
          console.error("❌ Error details:", s3Err);
        }

        // Create Cognito user so they can log in to the assessment portal
        const userEmail = email_address || org.email;
        if (USER_POOL_ID && userEmail) {
          try {
            await cognito.send(new AdminCreateUserCommand({
              UserPoolId: USER_POOL_ID,
              Username: userEmail,
              UserAttributes: [
                { Name: "email", Value: userEmail },
                { Name: "email_verified", Value: "true" },
              ],
              DesiredDeliveryMediums: ["EMAIL"],
            }));
            console.log("Cognito user created:", userEmail);
          } catch (cogErr) {
            if (cogErr.name === "UsernameExistsException") {
              console.log("Cognito user already exists:", userEmail);
            } else {
              console.error("Cognito create user error:", cogErr.message);
            }
          }
        }

        console.log("✅ Payment confirmed from Stripe");
        console.log("Customer email:", email_address || org.email);
        console.log("Organization:", org.company_name);

        // Send invoice email using already-retrieved invoice details
        console.log("📬 Calling sendInvoiceEmail function...");
        await sendInvoiceEmail(
          email_address || org.email,
          org.company_name,
          org.contact_person,
          payment_amount,
          invoiceNumber,
          invoiceDate,
          invoiceAmount,
          currency,
          invoicePdfUrl
        );
        console.log("✓ Email function completed");
      }
    } catch (err) {
      console.error("Webhook error:", err.message);
    }
  }

  res.json({ received: true });
});

app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again after 15 minutes",
});

// Setup data directory for local backup
const DATA_DIR = path.join(__dirname, "data", "submissions");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Health check for ALB
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/checkout-session", limiter, async (req, res) => {
  try {
    let { metadata } = req.body;

    if (metadata) {
      Object.keys(metadata).forEach(key => {
        if (typeof metadata[key] === "string") {
          metadata[key] = metadata[key].substring(0, 500);
        }
      });
    }

    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: metadata?.contactEmail || undefined,
      line_items: [{
        price_data: {
          currency: "USD",
          product_data: {
            name: "AIRES LITE Assessment",
            description: "Comprehensive AI Risk Profile & Remediation Plan",
          },
          unit_amount: 4999,
        },
        quantity: 1,
      }],
      mode: "payment",
      invoice_creation: { enabled: true },
      metadata: metadata || {},
      success_url: `${FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/cancel`,
    });

    // Insert Organization + pending Payment into RDS
    if (metadata && metadata.companyName) {
      try {
        const isAiRegulated = metadata.aiRegulated === "Yes" ? true
          : metadata.aiRegulated === "No" ? false : null;

        const orgRes = await pool.query(
          `INSERT INTO organization (
            company_name, industry, jurisdiction, post_no, address, city, state,
            country, postal_code, contact_person, email, phone_number, role,
            is_ai_regulated, reason_for_assessment
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          RETURNING organization_id`,
          [
            metadata.companyName, metadata.industry, metadata.jurisdiction,
            metadata.postNo, metadata.address, metadata.city, metadata.state,
            metadata.country, metadata.postalCode, metadata.contactName,
            metadata.contactEmail, metadata.contactPhone, metadata.contactRole,
            isAiRegulated, metadata.reason
          ]
        );

        const orgId = orgRes.rows[0].organization_id;

        await pool.query(
          `INSERT INTO payment (
            organization_id, stripe_session_id, email_address,
            payment_method, payment_amount, payment_successful
          ) VALUES ($1,$2,$3,'card',49.99,FALSE)`,
          [orgId, session.id, metadata.contactEmail]
        );

        console.log(`Org + pending payment saved: ${session.id}`);
      } catch (dbErr) {
        console.error("RDS insert error:", dbErr.message);
      }
    }

    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout session error:", err.message);
    res.status(500).json({ error: "Failed to create checkout session. Please try again." });
  }
});

app.post("/embedded-checkout-session", limiter, async (req, res) => {
  try {
    let { metadata } = req.body;

    if (metadata) {
      Object.keys(metadata).forEach(key => {
        if (typeof metadata[key] === "string") {
          metadata[key] = metadata[key].substring(0, 500);
        }
      });
    }

    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      payment_method_types: ["card"],
      customer_email: metadata?.contactEmail || undefined,
      line_items: [{
        price_data: {
          currency: "USD",
          product_data: {
            name: "AIRES LITE Assessment",
            description: "Comprehensive AI Risk Profile & Remediation Plan",
          },
          unit_amount: 4999,
        },
        quantity: 1,
      }],
      mode: "payment",
      invoice_creation: { enabled: true },
      metadata: metadata || {},
      return_url: `${FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    });

    // Insert Organization + pending Payment into RDS
    if (metadata && metadata.companyName) {
      try {
        const isAiRegulated = metadata.aiRegulated === "Yes" ? true
          : metadata.aiRegulated === "No" ? false : null;

        const orgRes = await pool.query(
          `INSERT INTO organization (
            company_name, industry, jurisdiction, post_no, address, city, state,
            country, postal_code, contact_person, email, phone_number, role,
            is_ai_regulated, reason_for_assessment
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          RETURNING organization_id`,
          [
            metadata.companyName, metadata.industry, metadata.jurisdiction,
            metadata.postNo, metadata.address, metadata.city, metadata.state,
            metadata.country, metadata.postalCode, metadata.contactName,
            metadata.contactEmail, metadata.contactPhone, metadata.contactRole,
            isAiRegulated, metadata.reason
          ]
        );

        const orgId = orgRes.rows[0].organization_id;

        await pool.query(
          `INSERT INTO payment (
            organization_id, stripe_session_id, email_address,
            payment_method, payment_amount, payment_successful
          ) VALUES ($1,$2,$3,'card',49.99,FALSE)`,
          [orgId, session.id, metadata.contactEmail]
        );

        console.log(`Embedded checkout org + pending payment saved: ${session.id}`);
      } catch (dbErr) {
        console.error("RDS insert error (embedded):", dbErr.message);
      }
    }

    res.json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error("Embedded checkout session error:", err.message);
    res.status(500).json({ error: "Failed to create checkout session. Please try again." });
  }
});

app.get("/verify-token", async (req, res) => {
  if (!jwtVerifier) {
    return res.status(503).json({ error: "Auth not configured" });
  }
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }
  const token = auth.slice(7);
  try {
    const payload = await jwtVerifier.verify(token);
    res.json({ valid: true, email: payload.email, sub: payload.sub });
  } catch {
    res.status(401).json({ valid: false, error: "Invalid or expired token" });
  }
});

// Stub questions — replace when Kavin delivers the CSV
const STUB_QUESTIONS = [
  { id: "g1", category: "AI Governance", text: "Does your organization have a formal AI governance policy or framework?", type: "single", options: ["Yes, fully documented and approved", "Partially in place", "Being developed", "No"] },
  { id: "g2", category: "AI Governance", text: "Is there a designated AI Ethics or Responsible AI committee?", type: "single", options: ["Yes", "Planned", "No"] },
  { id: "g3", category: "AI Governance", text: "How frequently does leadership review AI-related risks?", type: "single", options: ["Quarterly or more", "Annually", "Ad hoc only", "Never"] },
  { id: "g4", category: "AI Governance", text: "Are AI systems subject to mandatory internal audit or review?", type: "single", options: ["Yes, regularly", "Occasionally", "Not yet", "No"] },
  { id: "d1", category: "Data & Privacy", text: "Is personal data used to train or operate any AI systems?", type: "single", options: ["Yes", "No", "Unsure"] },
  { id: "d2", category: "Data & Privacy", text: "Do you have a data retention policy for AI training datasets?", type: "single", options: ["Yes, enforced", "Yes, informal", "No"] },
  { id: "d3", category: "Data & Privacy", text: "Are AI outputs that involve personal data subject to privacy review?", type: "single", options: ["Yes, always", "Sometimes", "No"] },
  { id: "r1", category: "Risk Management", text: "Have you conducted a formal AI risk assessment in the past 12 months?", type: "single", options: ["Yes", "In progress", "No"] },
  { id: "r2", category: "Risk Management", text: "Do you have an incident response plan specifically for AI-related failures?", type: "single", options: ["Yes, tested", "Yes, not yet tested", "No"] },
  { id: "r3", category: "Risk Management", text: "Are third-party AI vendors assessed for compliance before onboarding?", type: "single", options: ["Yes, always", "Sometimes", "No"] },
  { id: "t1", category: "Technical Controls", text: "Are AI model outputs monitored in production for drift or anomalies?", type: "single", options: ["Yes, automated", "Yes, manual", "No"] },
  { id: "t2", category: "Technical Controls", text: "Do you maintain version control and audit logs for AI models?", type: "single", options: ["Yes", "Partially", "No"] },
  { id: "t3", category: "Technical Controls", text: "Are access controls enforced on AI systems and training data?", type: "single", options: ["Yes, role-based", "Partially", "No"] },
  { id: "c1", category: "Regulatory Compliance", text: "Are you aware of AI-specific regulations applicable to your jurisdiction?", type: "single", options: ["Yes, fully aware", "Partially aware", "No"] },
  { id: "c2", category: "Regulatory Compliance", text: "Has a legal review been conducted on your AI use cases?", type: "single", options: ["Yes", "Planned", "No"] },
];

// JWT middleware — protects assessment + user endpoints
async function requireAuth(req, res, next) {
  if (!jwtVerifier) return res.status(503).json({ error: "Auth not configured" });
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = await jwtVerifier.verify(auth.slice(7));
    req.user = { email: payload.email, sub: payload.sub };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Resolve organization for authenticated user (primary or secondary)
async function getOrgForUser(email) {
  let r = await pool.query(
    `SELECT organization_id FROM organization WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
    [email]
  );
  if (r.rows.length > 0) return { organizationId: r.rows[0].organization_id, role: "primary" };
  r = await pool.query(
    `SELECT organization_id FROM secondary_user WHERE email = $1`,
    [email]
  );
  if (r.rows.length > 0) return { organizationId: r.rows[0].organization_id, role: "secondary" };
  return null;
}

// GET /api/payment-status — return org info for a Stripe session (called from success page)
app.get("/api/payment-status", async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });
  try {
    const r = await pool.query(
      `SELECT p.organization_id, p.email_address, o.company_name, o.contact_person
       FROM payment p
       JOIN organization o ON p.organization_id = o.organization_id
       WHERE p.stripe_session_id = $1`,
      [session_id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Payment not found" });
    const { organization_id, email_address, company_name, contact_person } = r.rows[0];
    res.json({ organizationId: organization_id, email: email_address, companyName: company_name, contactPerson: contact_person });
  } catch (err) {
    console.error("Payment status error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/secondary-user — create secondary user in DB and Cognito
app.post("/api/secondary-user", limiter, async (req, res) => {
  const { organizationId, secondaryName, secondaryEmail } = req.body;
  if (!organizationId || !secondaryEmail) return res.status(400).json({ error: "Missing required fields" });
  try {
    await pool.query(
      `INSERT INTO secondary_user (organization_id, name, email) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING`,
      [organizationId, secondaryName || secondaryEmail, secondaryEmail]
    );
    if (USER_POOL_ID) {
      try {
        await cognito.send(new AdminCreateUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: secondaryEmail,
          UserAttributes: [
            { Name: "email", Value: secondaryEmail },
            { Name: "email_verified", Value: "true" },
          ],
          DesiredDeliveryMediums: ["EMAIL"],
        }));
        console.log("Secondary Cognito user created:", secondaryEmail);
      } catch (cogErr) {
        if (cogErr.name !== "UsernameExistsException") throw cogErr;
        console.log("Secondary Cognito user already exists:", secondaryEmail);
      }
    }
    // Log secondary user to S3 CSV
    try {
      const orgRes = await pool.query(
        `SELECT o.company_name, o.industry, o.jurisdiction, o.address, o.city, o.state, o.country, o.postal_code,
                o.contact_person, o.email, o.phone_number, o.role, o.is_ai_regulated, o.reason_for_assessment,
                p.stripe_session_id
         FROM organization o
         LEFT JOIN payment p ON p.organization_id = o.organization_id AND p.payment_successful = TRUE
         WHERE o.organization_id = $1 LIMIT 1`,
        [organizationId]
      );
      const org = orgRes.rows[0] || {};
      await appendCsvRow([
        new Date().toISOString(), org.company_name || "", org.industry || "", org.jurisdiction || "", "",
        org.address || "", org.city || "", org.state || "", org.country || "", org.postal_code || "",
        org.contact_person || "", org.email || "", org.phone_number || "", org.role || "",
        org.is_ai_regulated || "", org.reason_for_assessment || "", "SECONDARY_USER", "", "",
        "", "", "", "", "", "", org.stripe_session_id || "",
        secondaryName || secondaryEmail, secondaryEmail, new Date().toISOString()
      ]);
    } catch (s3Err) {
      console.error("Secondary user S3 log error (non-fatal):", s3Err.message);
    }
    res.json({ success: true, message: "Secondary user created. Credentials email sent." });
  } catch (err) {
    console.error("Secondary user error:", err.message);
    res.status(500).json({ error: "Failed to create secondary user" });
  }
});

// GET /api/user-info — return org details for authenticated user
app.get("/api/user-info", requireAuth, async (req, res) => {
  try {
    const orgInfo = await getOrgForUser(req.user.email);
    if (!orgInfo) return res.status(404).json({ error: "User not linked to any organization" });
    const orgRes = await pool.query(
      `SELECT company_name, contact_person FROM organization WHERE organization_id = $1`,
      [orgInfo.organizationId]
    );
    const org = orgRes.rows[0] || {};
    res.json({ ...orgInfo, email: req.user.email, companyName: org.company_name, contactPerson: org.contact_person });
  } catch (err) {
    console.error("User info error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/assessment/questions — return stub questions (replace with CSV when ready)
app.get("/api/assessment/questions", requireAuth, (req, res) => {
  res.json({ questions: STUB_QUESTIONS, total: STUB_QUESTIONS.length });
});

// POST /api/assessment/start — create or resume assessment session
app.post("/api/assessment/start", requireAuth, async (req, res) => {
  try {
    const orgInfo = await getOrgForUser(req.user.email);
    if (!orgInfo) return res.status(404).json({ error: "User not linked to any organization" });
    let sessionRes = await pool.query(
      `SELECT session_id, session_token, status FROM assessment_session
       WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [orgInfo.organizationId]
    );
    if (sessionRes.rows.length === 0) {
      sessionRes = await pool.query(
        `INSERT INTO assessment_session (organization_id, status, started_at)
         VALUES ($1,'in_progress',NOW())
         RETURNING session_id, session_token, status`,
        [orgInfo.organizationId]
      );
    } else if (sessionRes.rows[0].status === "not_started") {
      await pool.query(
        `UPDATE assessment_session SET status='in_progress', started_at=NOW() WHERE session_id=$1`,
        [sessionRes.rows[0].session_id]
      );
    }
    const session = sessionRes.rows[0];
    res.json({ sessionId: session.session_id, sessionToken: session.session_token, status: session.status });
  } catch (err) {
    console.error("Assessment start error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/assessment/answer — save a single answer (upsert)
app.post("/api/assessment/answer", requireAuth, async (req, res) => {
  const { sessionId, questionId, questionText, answer } = req.body;
  if (!sessionId || !questionId || answer === undefined) return res.status(400).json({ error: "Missing fields" });
  try {
    await pool.query(
      `INSERT INTO assessment_response (session_id, question_id, question_text, answer, answered_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (session_id, question_id)
       DO UPDATE SET answer=$4, answered_by=$5, answered_at=NOW()`,
      [sessionId, questionId, questionText || "", answer, req.user.email]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Answer save error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/assessment/submit — bulk save all answers and mark submitted
app.post("/api/assessment/submit", requireAuth, async (req, res) => {
  const { sessionId, answers } = req.body;
  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });
  try {
    if (answers && Array.isArray(answers)) {
      for (const a of answers) {
        await pool.query(
          `INSERT INTO assessment_response (session_id, question_id, question_text, answer, answered_by)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (session_id, question_id)
           DO UPDATE SET answer=$4, answered_by=$5, answered_at=NOW()`,
          [sessionId, a.questionId, a.questionText || "", a.answer, req.user.email]
        );
      }
    }
    await pool.query(
      `UPDATE assessment_session SET status='submitted', submitted_at=NOW() WHERE session_id=$1`,
      [sessionId]
    );
    console.log("Assessment submitted for session:", sessionId);
    res.json({ success: true, message: "Assessment submitted. Your report is being generated." });
  } catch (err) {
    console.error("Submit error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/assessment/status — get session status and progress
app.get("/api/assessment/status", requireAuth, async (req, res) => {
  try {
    const orgInfo = await getOrgForUser(req.user.email);
    if (!orgInfo) return res.status(404).json({ error: "User not linked to any organization" });
    const sessionRes = await pool.query(
      `SELECT s.session_id, s.session_token, s.status, s.started_at, s.submitted_at,
              COUNT(r.response_id) AS answered_count
       FROM assessment_session s
       LEFT JOIN assessment_response r ON s.session_id = r.session_id
       WHERE s.organization_id = $1
       GROUP BY s.session_id, s.session_token, s.status, s.started_at, s.submitted_at
       ORDER BY s.created_at DESC LIMIT 1`,
      [orgInfo.organizationId]
    );
    if (sessionRes.rows.length === 0) {
      return res.json({ status: "not_started", answeredCount: 0, totalQuestions: STUB_QUESTIONS.length });
    }
    const s = sessionRes.rows[0];
    res.json({
      sessionId: s.session_id,
      sessionToken: s.session_token,
      status: s.status,
      startedAt: s.started_at,
      submittedAt: s.submitted_at,
      answeredCount: parseInt(s.answered_count),
      totalQuestions: STUB_QUESTIONS.length,
    });
  } catch (err) {
    console.error("Assessment status error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/tester/full-reset — full reset for whitelisted tester emails only
// Deletes Cognito user + all DB records so tester can go through entire flow again
const TESTER_EMAILS = (process.env.TESTER_EMAILS || "marziasifa0106@gmail.com")
  .split(",").map(e => e.trim().toLowerCase());

app.post("/api/tester/full-reset", requireAuth, async (req, res) => {
  const email = req.user.email.toLowerCase();
  if (!TESTER_EMAILS.includes(email)) {
    return res.status(403).json({ error: "Not authorized for tester reset" });
  }
  try {
    const org = await getOrgForUser(email);
    if (org) {
      // Delete assessment data
      await pool.query(
        `DELETE FROM assessment_response WHERE session_id IN (
          SELECT session_id FROM assessment_session WHERE organization_id = $1
        )`, [org.organizationId]
      );
      await pool.query(`DELETE FROM assessment_session WHERE organization_id = $1`, [org.organizationId]);
      // Delete secondary users
      await pool.query(`DELETE FROM secondary_user WHERE organization_id = $1`, [org.organizationId]);
      // Delete invoice + payment
      await pool.query(
        `DELETE FROM invoice WHERE payment_id IN (
          SELECT payment_id FROM payment WHERE organization_id = $1
        )`, [org.organizationId]
      );
      await pool.query(`DELETE FROM payment WHERE organization_id = $1`, [org.organizationId]);
      await pool.query(`DELETE FROM organization WHERE organization_id = $1`, [org.organizationId]);
    }
    // Delete Cognito user
    if (USER_POOL_ID) {
      try {
        await cognito.send(new AdminDeleteUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: req.user.email,
        }));
        console.log(`Cognito user deleted for tester: ${email}`);
      } catch (cogErr) {
        if (cogErr.name !== "UserNotFoundException") throw cogErr;
      }
    }
    console.log(`Full tester reset completed for ${email}`);
    res.json({ success: true, message: "Full reset complete. You can now go through the full flow again from the landing page." });
  } catch (err) {
    console.error("Tester full reset error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
