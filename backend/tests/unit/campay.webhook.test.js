'use strict';

const { verifyWebhookSignature } = require('../../src/services/payment/campaySignature');
const { handleCampayWebhook } = require('../../src/modules/webhooks/campay.controller');

// Mock ContributionService
jest.mock('../../src/modules/contributions/contribution.service', () => ({
  applyTerminalStatus: jest.fn(),
}));
const ContributionService = require('../../src/modules/contributions/contribution.service');

jest.mock('../../src/services/payment/campaySignature', () => ({
  verifyWebhookSignature: jest.fn(),
}));

describe('Campay Webhook Controller', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      get: jest.fn(),
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('returns 401 when X-Campay-Signature header is missing', async () => {
    req.get.mockReturnValue(undefined);
    await handleCampayWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Missing') }));
  });

  it('returns 401 when signature is invalid', async () => {
    req.get.mockReturnValue('bad-sig');
    verifyWebhookSignature.mockReturnValue(false);
    req.body = { reference: 'r1', status: 'SUCCESSFUL' };
    await handleCampayWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Invalid') }));
  });

  it('returns 400 when reference or status is missing', async () => {
    req.get.mockReturnValue('good-sig');
    verifyWebhookSignature.mockReturnValue(true);
    req.body = { reference: 'r1' }; // missing status
    await handleCampayWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 200 and processes SUCCESSFUL webhook', async () => {
    req.get.mockReturnValue('good-sig');
    verifyWebhookSignature.mockReturnValue(true);
    req.body = {
      reference: 'campay-ref-1',
      status: 'SUCCESSFUL',
      amount: '5000',
      operator: 'MTN',
      operator_reference: '00X',
    };
    ContributionService.applyTerminalStatus.mockResolvedValue({
      contributionId: 'contrib-1',
      status: 'confirmed',
    });

    await handleCampayWebhook(req, res);

    expect(ContributionService.applyTerminalStatus).toHaveBeenCalledWith(
      'campay-ref-1',
      'SUCCESSFUL',
      expect.objectContaining({
        amount: '5000',
        gateway: 'campay',
        rawPayload: req.body,
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      received: true,
      reference: 'campay-ref-1',
      status: 'confirmed',
      contributionId: 'contrib-1',
    }));
  });

  it('returns 500 (so Campay retries) on internal error', async () => {
    req.get.mockReturnValue('good-sig');
    verifyWebhookSignature.mockReturnValue(true);
    req.body = { reference: 'campay-ref-1', status: 'SUCCESSFUL' };
    ContributionService.applyTerminalStatus.mockRejectedValue(new Error('DB down'));

    await handleCampayWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Internal processing error' }));
  });
});
