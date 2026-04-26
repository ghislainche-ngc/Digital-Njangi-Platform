'use strict';

require('dotenv').config();
require('./config/env'); // validate env vars on startup

const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Route imports — add each module as it is implemented
const authRoutes = require('./modules/auth/auth.routes');
const groupRoutes = require('./modules/groups/group.routes');
const memberRoutes = require('./modules/members/member.routes');
const contributionRoutes = require('./modules/contributions/contribution.routes');
const payoutRoutes = require('./modules/payouts/payout.routes');
const fineRoutes = require('./modules/fines/fine.routes');
const socialFundRoutes = require('./modules/social-fund/social-fund.routes');
const reportRoutes = require('./modules/reports/report.routes');

const errorMiddleware = require('./middleware/error.middleware');

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Swagger / OpenAPI ────────────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NAAS — NjangiBridge API',
      version: '1.0.0',
      description: 'Njangi as a Service — RESTful API Documentation',
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.js'],
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

// ─── Health check ─────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/groups', groupRoutes);
app.use('/groups', memberRoutes);
app.use('/groups', contributionRoutes);
app.use('/groups', payoutRoutes);
app.use('/groups', fineRoutes);
app.use('/groups', socialFundRoutes);
app.use('/groups', reportRoutes);

// ─── Global error handler (must be last) ──────────────────────────────────
app.use(errorMiddleware);

// ─── Start server (skip when imported by tests) ───────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`NAAS backend running on http://localhost:${PORT}`);
    // eslint-disable-next-line no-console
    console.log(`API docs:          http://localhost:${PORT}/api-docs`);
  });
}

module.exports = app;
