const axios = require('axios');
require('dotenv').config();
// Sign up at paymongo.com → get TEST secret key. Enable Disbursements product.
const KEY = Buffer.from(process.env.PAYMONGO_SK + ':').toString('base64');
const API = 'https://api.paymongo.com/v1';

exports.createDisbursement = async (method, accountNumber, amount, reference) => {
  // method: 'gcash' or 'maya'
  const { data } = await axios.post(`${API}/disbursements`, {
    data: {
      attributes: {
        amount: Math.round(amount * 100), // centavos
        currency: 'PHP',
        disbursement_type: method === 'gcash' ? 'gcash' : 'maya',
        account_number: accountNumber, // mobile number for GCash/Maya
        description: 'BlockBlast winnings',
        reference_number: reference
      }
    }
  }, { headers: { Authorization: `Basic ${KEY}` } });
  return { id: data.data.id };
};