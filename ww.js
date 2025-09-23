// Simple test to verify your live PayPal credentials
import axios from 'axios';

async function testPayPalLiveCredentials() {
  const PAYPAL_CLIENT_ID = 'AW7JBWO9Re7XBhmJzMm0xJvrTctJoECsmxtfCcaCPe1aQd9avrzRDn28sD8S8Yc_cDfJlVSfThX9Ez2c';
  const PAYPAL_CLIENT_SECRET = 'EMk7lyxcDBcU0OpGOGZd5bf_ahW787UAXMPTZK5dSxP8aDjV6aXZVNSVwCG9B-EUIEqxGCX-eVQD_M4T';
  const PAYPAL_API_BASE = 'https://api-m.paypal.com';

  try {
    console.log('Testing PayPal live credentials...');
    
    // Test 1: Get access token
    const tokenResponse = await axios({
      url: `${PAYPAL_API_BASE}/v1/oauth2/token`,
      method: 'post',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      auth: {
        username: PAYPAL_CLIENT_ID,
        password: PAYPAL_CLIENT_SECRET,
      },
      data: 'grant_type=client_credentials',
      timeout: 30000,
    });

    console.log('✅ Access token obtained successfully');
    const accessToken = tokenResponse.data.access_token;

    // Test 2: Create minimal order
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'EUR',
          value: '10.00'
        },
        description: 'Test order'
      }],
      application_context: {
        return_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
        brand_name: 'Test Store',
        locale: 'fr-FR',
        user_action: 'PAY_NOW'
      }
    };

    const orderResponse = await axios.post(
      `${PAYPAL_API_BASE}/v2/checkout/orders`,
      orderPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        timeout: 30000,
      }
    );

    console.log('✅ Test order created successfully');
    console.log('Order ID:', orderResponse.data.id);
    console.log('Status:', orderResponse.data.status);
    
    const approvalUrl = orderResponse.data.links?.find(link => link.rel === 'approve')?.href;
    console.log('Approval URL:', approvalUrl);

    return {
      success: true,
      orderId: orderResponse.data.id,
      approvalUrl
    };

  } catch (error) {
    console.error('❌ PayPal test failed:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data);
    
    if (error.response?.status === 401) {
      console.error('🚨 CREDENTIALS INVALID - Check your Client ID and Secret');
    } else if (error.response?.status === 403) {
      console.error('🚨 ACCESS FORBIDDEN - Your account may need verification or app approval');
    } else if (error.response?.status === 422) {
      console.error('🚨 BUSINESS VALIDATION ERROR - Check your PayPal business account status');
    }
    
    return { success: false, error: error.message };
  }
}

// Run the test
testPayPalLiveCredentials();