import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Booking
  app.post("/api/book", async (req, res) => {
    const { name, groupSize, date, contact, email, pickupAddress, pickupTime, dropoffLocation, dropoffTime, country } = req.body;

    console.log("New Booking Received:", { name, groupSize, date, contact, email, pickupAddress, pickupTime, dropoffLocation, dropoffTime, country });

    try {
      // Google Sheets Integration (Placeholder/Example)
      // To make this work, the user needs:
      // 1. A Google Service Account JSON
      // 2. The Spreadsheet ID
      if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SHEET_ID) {
        let key = process.env.GOOGLE_PRIVATE_KEY;
        
        // Handle JSON-wrapped keys or escaped newlines
        if (key.startsWith('{')) {
          try {
            const parsed = JSON.parse(key);
            key = parsed.private_key || key;
          } catch (e) { /* ignore */ }
        }

        // The most reliable way to fix the "DECODER routines::unsupported" error:
        // 1. Replace literal "\n" strings with actual newlines
        // 2. Ensure it starts and ends with the correct PEM headers
        // 3. Remove any accidental surrounding quotes
        key = key.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1').trim();
        
        if (!key.includes('-----BEGIN PRIVATE KEY-----')) {
          key = `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
        }

        const serviceAccountAuth = new JWT({
          email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          key: key,
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        
        // Ensure headers exist if the sheet is empty
        try {
          await sheet.loadHeaderRow();
        } catch (e) {
          // If no headers, set them
          await sheet.setHeaderRow([
            "Timestamp", "Name", "Country", "Contact", "Email", 
            "Group Size", "Date", "Pickup Address", "Pickup Time", 
            "Dropoff Location", "Dropoff Time"
          ]);
        }

        await sheet.addRow({
          Timestamp: new Date().toISOString(),
          Name: name,
          Country: country,
          Contact: contact.startsWith("+") ? `'${contact}` : contact, // Prepend ' to prevent formula interpretation
          Email: email,
          "Group Size": groupSize,
          Date: date,
          "Pickup Address": pickupAddress,
          "Pickup Time": pickupTime,
          "Dropoff Location": dropoffLocation,
          "Dropoff Time": dropoffTime || "N/A",
        });
        console.log("Logged to Google Sheets");
      } else {
        console.warn("Google Sheets credentials missing. Skipping sheet logging.");
      }

      // WhatsApp Notification (Placeholder)
      // In a real app, you'd use Twilio or WhatsApp Business API here.
      // For now, we'll just acknowledge the request.
      // The frontend will also provide a direct wa.me link for the user.
      
      // Email Notification
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: process.env.SMTP_PORT === "465",
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });

          const mailOptions = {
            from: `"Mt Fuji Tour" <${process.env.SMTP_USER}>`,
            to: [email, process.env.NOTIFICATION_EMAIL].filter(Boolean).join(", "),
            bcc: "heymilon@gmail.com",
            subject: `Booking Request Confirmation: ${name}`,
            text: `
              Mt Fuji Tour Booking Request Received
              
              Hello ${name},
              
              We have received your booking request. Our team will check driver availability and get back to you shortly via WhatsApp or Email.
              
              Request Details:
              ----------------
              Name: ${name}
              Country: ${country}
              Group Size: ${groupSize}
              Date: ${date}
              Contact: ${contact}
              Email: ${email}
              Pickup: ${pickupAddress} at ${pickupTime}
              Dropoff: ${dropoffLocation} ${dropoffTime ? `at ${dropoffTime}` : ""}
              
              Thank you for choosing Mt Fuji Tour!
            `,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                <h2 style="color: #1877F2;">Mt Fuji Tour Booking Request</h2>
                <p>Hello <strong>${name}</strong>,</p>
                <p>We have received your booking request. Our team will check driver availability and get back to you shortly via WhatsApp or Email.</p>
                
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; font-size: 14px; color: #65676B; text-transform: uppercase;">Request Details</h3>
                  <p><strong>Name:</strong> ${name}</p>
                  <p><strong>Country:</strong> ${country}</p>
                  <p><strong>Group Size:</strong> ${groupSize}</p>
                  <p><strong>Date:</strong> ${date}</p>
                  <p><strong>Contact:</strong> ${contact}</p>
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>Pickup:</strong> ${pickupAddress} at ${pickupTime}</p>
                  <p><strong>Dropoff:</strong> ${dropoffLocation} ${dropoffTime ? `at ${dropoffTime}` : ""}</p>
                </div>
                
                <p style="color: #65676B; font-size: 12px;">This is an automated confirmation. Please do not reply directly to this email.</p>
              </div>
            `,
          };

          await transporter.sendMail(mailOptions);
          console.log("Notification email sent");
        } catch (mailError) {
          console.error("Failed to send notification email:", mailError);
          // We don't throw here so the booking still succeeds in the UI
        }
      }

      res.status(200).json({ 
        success: true, 
        message: "Booking received successfully!",
        whatsappLink: `https://wa.me/${(process.env.WHATSAPP_NUMBER || "").replace(/\D/g, "")}?text=${encodeURIComponent(
          `*New Mt Fuji Tour Booking Request*\n\n` +
          `*Name:* ${name}\n` +
          `*Country:* ${country}\n` +
          `*Group Size:* ${groupSize}\n` +
          `*Date:* ${date}\n` +
          `*Contact:* ${contact}\n` +
          `*Pickup:* ${pickupAddress} at ${pickupTime}\n` +
          `*Dropoff:* ${dropoffLocation}${dropoffTime ? ` at ${dropoffTime}` : ""}`
        )}`
      });
    } catch (error) {
      console.error("Error processing booking:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to process booking.";
      res.status(500).json({ success: false, message: errorMessage });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
