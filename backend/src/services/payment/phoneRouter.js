'use strict';

// Cameroon MSISDN prefix tables. Source: Monetbil operators table (p.10)
// and corroborated by Campay's auto-detect behavior. Longest prefix wins.
const MTN_PREFIXES = ['650', '651', '652', '653', '654',
                      '680', '681', '682', '683', '684', '67'];
const ORANGE_PREFIXES = ['655', '656', '657', '658', '659',
                         '685', '686', '687', '688', '689', '69'];

// Sort descending by length so 3-char prefixes match before 2-char ones.
// Example: '650' must be checked before '65' so '650123...' matches MTN, not Orange.
const SORTED_MTN = [...MTN_PREFIXES].sort((a, b) => b.length - a.length);
const SORTED_ORANGE = [...ORANGE_PREFIXES].sort((a, b) => b.length - a.length);

/**
 * Detect the Cameroon mobile operator from an E.164 phone number.
 * @param {string} phone — expected format: '+237<prefix><subscriber>'
 * @returns {'mtn' | 'orange' | null}
 */
function detectOperatorFromPhone(phone) {
  if (typeof phone !== 'string') return null;
  if (!phone.startsWith('+237')) return null;
  const local = phone.slice(4); // strip '+237'
  if (local.length === 0) return null;

  if (SORTED_MTN.some(p => local.startsWith(p))) return 'mtn';
  if (SORTED_ORANGE.some(p => local.startsWith(p))) return 'orange';
  return null;
}

/**
 * Resolve which payout gateway to use based on the recipient's phone prefix.
 * Never returns 'campay' — that value is only reachable via an explicit
 * preferred_payout_gateway column setting in njangi_groups.
 *
 * @param {string} phone
 * @returns {'mtn_momo' | 'orange_money'}
 * @throws {Error} .statusCode=400 if the prefix is not recognized
 */
function resolvePayoutGateway(phone) {
  const operator = detectOperatorFromPhone(phone);
  if (operator === 'mtn') return 'mtn_momo';
  if (operator === 'orange') return 'orange_money';

  const err = new Error(`Unrecognized phone prefix for payout routing: ${phone}`);
  err.statusCode = 400;
  throw err;
}

module.exports = { detectOperatorFromPhone, resolvePayoutGateway };
