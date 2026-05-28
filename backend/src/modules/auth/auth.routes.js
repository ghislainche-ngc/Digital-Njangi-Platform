'use strict';

const express = require('express');
const router = express.Router();
const { register, verifyOTP, login } = require('./auth.controller');
const { createRateLimiter } = require('../../middleware/rateLimit.middleware');
const WhatsAppNotificationService = require('../../services/notification/WhatsAppNotificationService');

const loginLimiter = createRateLimiter({
	windowMs: 15 * 60 * 1000,
	limit: 10,
	message: 'Too many login attempts. Please try again later.',
});

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Register, verify OTP, and obtain JWT tokens
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, phone, full_name, password]
 *             properties:
 *               email:    { type: string, example: alice@njangi.cm }
 *               phone:    { type: string, example: "+237677000001" }
 *               full_name: { type: string, example: Alice Mbah }
 *               password: { type: string, example: SecurePass123! }
 *               language: { type: string, enum: [en, fr], default: en }
 *     responses:
 *       201: { description: User registered, OTP sent }
 *       400: { description: Validation error }
 *       409: { description: Email or phone already exists }
 */
router.post('/register', register);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify 6-digit OTP and receive JWT
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, code]
 *             properties:
 *               phone: { type: string, example: "+237677000001" }
 *               code:  { type: string, example: "123456" }
 *     responses:
 *       200: { description: JWT token returned }
 *       400: { description: Invalid or expired OTP }
 */
router.post('/verify-otp', verifyOTP);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, example: alice@njangi.cm }
 *               password: { type: string, example: SecurePass123! }
 *     responses:
 *       200: { description: JWT token returned }
 *       401: { description: Invalid credentials }
 */
router.post('/login', loginLimiter, login);

router.get('/whatsapp/status', (req, res) => {
  try {
    const status = WhatsAppNotificationService.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/whatsapp/qr', (req, res) => {
  try {
    const { status, qr } = WhatsAppNotificationService.getStatus();
    
    if (status === 'CONNECTED') {
      return res.send(`
        <html>
          <head>
            <title>WhatsApp Status</title>
            <style>
              body { font-family: sans-serif; background: #0a0a0a; color: #fff; text-align: center; padding: 50px; }
              .card { background: #1a1a1a; padding: 30px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
              .status { color: #10b981; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>WhatsApp Bot Status</h2>
              <p class="status">✓ Connected and active</p>
              <p>Your phone is linked to NjangiBridge as a self-hosted notification bot.</p>
            </div>
          </body>
        </html>
      `);
    }

    if (status === 'QR_READY' && qr) {
      const qrUrl = \`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=\${encodeURIComponent(qr)}\`;
      return res.send(\`
        <html>
          <head>
            <title>Link WhatsApp</title>
            <style>
              body { font-family: sans-serif; background: #0a0a0a; color: #fff; text-align: center; padding: 50px; }
              .card { background: #1a1a1a; padding: 30px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
              img { margin: 20px 0; border: 10px solid #fff; border-radius: 8px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>Link WhatsApp Bot</h2>
              <p>Scan this QR code using Link Devices in your phone's WhatsApp settings:</p>
              <img src="\${qrUrl}" alt="WhatsApp QR Code"/>
              <p style="color: #999; font-size: 12px;">This links NjangiBridge as a WhatsApp Web client under your number.</p>
            </div>
          </body>
        </html>
      \`);
    }

    return res.send(`
      <html>
        <head>
          <title>WhatsApp Status</title>
          <style>
            body { font-family: sans-serif; background: #0a0a0a; color: #fff; text-align: center; padding: 50px; }
            .card { background: #1a1a1a; padding: 30px; border-radius: 12px; display: inline-block; }
          </style>
          <script>
            setTimeout(() => { window.location.reload(); }, 3000);
          </script>
        </head>
        <body>
          <div class="card">
            <h2>WhatsApp Bot status: ${status}</h2>
            <p>Please wait... (page will refresh automatically)</p>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

module.exports = router;
