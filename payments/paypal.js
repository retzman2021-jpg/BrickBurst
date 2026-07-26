const axios = require('axios');
require('dotenv').config();

// Get these from https://developer.paypal.com (SANDBOX credentials!)
const AUTH = Buffer.from(`${process.env.PAYPAL_CLIENT}:${process.env.PAYPAL_SECRET}`).toString('base64');
const API = 'https://api-m.sandbox.paypal.com'; // LIVE would be api-m.paypal.com

exports.createPayout = async (receiverEmail, amount, reference) => {
  const { data: { access_token } } = await axios.post(`${API}/v1/oauth2/token`,
    'grant_type=client_credentials', { headers: { Authorization: `Basic ${AUTH}` } });

  const { data } = await axios.post(`${API}/v1/payments/payouts`, {
    sender_batch_header: { sender_batch_id: reference, email_subject: 'BlockBlast payout' },
    items: [{ recipient_type: 'EMAIL', amount: { value: amount.toFixed(2), currency: 'PHP' },
             receiver: receiverEmail, note: 'Game winnings', sender_item_id: reference }]
  }, { headers: { Authorization: `Bearer ${access_token}` } });
  return { id: data.batch_header.payout_batch_id };
};