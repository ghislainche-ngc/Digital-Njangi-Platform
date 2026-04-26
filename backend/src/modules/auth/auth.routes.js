'use strict';

const express = require('express');
const router = express.Router();
const { register, verifyOTP, login } = require('./auth.controller');

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
router.post('/login', login);

module.exports = router;
