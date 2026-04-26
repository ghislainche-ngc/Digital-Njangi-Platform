'use strict';

const MTNMoMoService = require('./MTNMoMoService');
const OrangeMoneyService = require('./OrangeMoneyService');

const config = {
  mtn: {
    apiUser: process.env.MTN_MOMO_API_USER,
    apiKey: process.env.MTN_MOMO_API_KEY,
    subscriptionKey: process.env.MTN_MOMO_SUBSCRIPTION_KEY,
    targetEnv: process.env.MTN_MOMO_TARGET_ENV || 'sandbox',
    callbackUrl: process.env.MTN_MOMO_CALLBACK_URL,
  },
  orange: {
    apiKey: process.env.ORANGE_MONEY_API_KEY,
    baseUrl: process.env.ORANGE_MONEY_BASE_URL,
  },
};

/**
 * Factory — get the correct PaymentProvider instance for a given gateway.
 * @param {'mtn_momo'|'orange_money'} gateway
 * @returns {PaymentProvider}
 */
const getProvider = (gateway) => {
  switch (gateway) {
    case 'mtn_momo':     return new MTNMoMoService(config.mtn);
    case 'orange_money': return new OrangeMoneyService(config.orange);
    default: throw new Error(`Unknown payment gateway: ${gateway}`);
  }
};

module.exports = { getProvider };
