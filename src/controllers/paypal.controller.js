import axios from "axios";
import Order from "../models/Order.js";
import { PayPalError, ValidationError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const PAYPAL_API_BASE = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

class PayPalController {
  constructor() {
    this.validateCredentials();
  }

  /**
   * Validate PayPal credentials on initialization
   */
  validateCredentials() {
    const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("PayPal credentials are not configured");
    }
  }

  /**
   * Get PayPal access token
   */
  async getAccessToken() {
    try {
      const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENVIRONMENT } = process.env;
      const environment = PAYPAL_ENVIRONMENT || 'sandbox';
      const apiBase = PAYPAL_API_BASE[environment] || PAYPAL_API_BASE.sandbox;

      const response = await axios({
        url: `${apiBase}/v1/oauth2/token`,
        method: "post",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        auth: {
          username: PAYPAL_CLIENT_ID,
          password: PAYPAL_CLIENT_SECRET,
        },
        data: "grant_type=client_credentials",
        timeout: 10000,
      });

      if (!response.data.access_token) {
        throw new PayPalError("Invalid token response from PayPal");
      }

      return response.data.access_token;
    } catch (error) {
      logger.error("PayPal token generation failed:", error);
      throw new PayPalError("Failed to authenticate with PayPal");
    }
  }

  /**
   * Validate order data
   */
  validateOrderData(data) {
    const {
      amount,
      customer,
      items,
      pickupType,
      deliveryAddress,
      deliveryTime,
    } = data;

    if (!amount || amount <= 0) {
      throw new ValidationError("Invalid amount");
    }

    if (!customer?.fullName || !customer?.email || !customer?.phone) {
      throw new ValidationError("Customer information is incomplete");
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError("Items are required");
    }

    if (!["store", "delivery"].includes(pickupType)) {
      throw new ValidationError("Invalid pickup type");
    }

    if (pickupType === "delivery" && !deliveryAddress) {
      throw new ValidationError("Delivery address is required");
    }

    if (pickupType === "delivery" && !deliveryTime) {
      throw new ValidationError("Delivery time slot is required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.email)) {
      throw new ValidationError("Invalid email format");
    }

    // Validate item structure
    items.forEach((item, index) => {
      if (
        !item.productId ||
        !item.variantId ||
        !item.name ||
        !item.variantUnit ||
        !item.price ||
        !item.quantity
      ) {
        throw new ValidationError(
          `Item ${index + 1} is missing required fields`
        );
      }
      if (item.price <= 0 || item.quantity <= 0) {
        throw new ValidationError(
          `Item ${index + 1} has invalid price or quantity`
        );
      }
    });
  }

  /**
   * Calculate totals
   */
  calculateTotals(items, deliveryFee = 0, discountAmount = 0) {
    const itemsTotal = items.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    );

    const shippingTotal = Number(deliveryFee) || 0;
    const total = Number(
      (itemsTotal + shippingTotal - (discountAmount || 0)).toFixed(2)
    );

    return {
      itemsTotal: Number(itemsTotal.toFixed(2)),
      shippingTotal,
      discountAmount: discountAmount || 0,
      total,
    };
  }

  /**
   * Build PayPal purchase unit
   */
  buildPurchaseUnit(orderData, totals, orderId) {
    const { customer, items, pickupType, deliveryAddress } = orderData;

    const paypalItems = items.map((item) => ({
      name: `${String(item.name)} - ${String(item.variantUnit)}`.substring(0, 127),
      unit_amount: {
        currency_code: "EUR",
        value: Number(item.price).toFixed(2),
      },
      quantity: String(item.quantity),
      category: "PHYSICAL_GOODS",
    }));

    const purchaseUnit = {
      custom_id: String(orderId),
      description: `Commande #${orderId}`,
      amount: {
        currency_code: "EUR",
        value: totals.total.toFixed(2),
        breakdown: {
          item_total: {
            currency_code: "EUR",
            value: totals.itemsTotal.toFixed(2),
          },
        },
      },
      items: paypalItems,
    };

    // Add shipping fee if applicable
    if (totals.shippingTotal > 0) {
      purchaseUnit.amount.breakdown.shipping = {
        currency_code: "EUR",
        value: totals.shippingTotal.toFixed(2),
      };
    }

    // Add discount if applicable  
    if (totals.discountAmount > 0) {
      purchaseUnit.amount.breakdown.discount = {
        currency_code: "EUR",
        value: totals.discountAmount.toFixed(2),
      };
    }

    // Add delivery address if needed
    if (pickupType === "delivery" && deliveryAddress) {
      purchaseUnit.shipping = {
        name: { full_name: String(customer.fullName).substring(0, 300) },
        address: {
          address_line_1: String(deliveryAddress.street).substring(0, 300),
          admin_area_2: String(deliveryAddress.city).substring(0, 120),
          postal_code: String(deliveryAddress.postalCode).substring(0, 60),
          country_code: String(deliveryAddress.country || "FR")
            .substring(0, 2)
            .toUpperCase(),
        },
      };
    }

    return purchaseUnit;
  }

  /**
   * Create PayPal order
   */
  async createPayPalOrder(req, res) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.info(`[${requestId}] PayPal order creation started`);

    try {
      const orderData = req.body;
      
      // Remove environment from validation as we get it from ENV
      const { environment, ...sanitizedData } = orderData;
      
      // Validate input data
      this.validateOrderData(sanitizedData);

      // Calculate totals
      const totals = this.calculateTotals(
        sanitizedData.items,
        sanitizedData.deliveryFee,
        sanitizedData.discountAmount
      );

      // Verify total matches front-end
      if (Math.abs(totals.total - Number(sanitizedData.amount)) > 0.01) {
        throw new ValidationError(
          `Amount mismatch: calculated ${totals.total}, received ${sanitizedData.amount}`
        );
      }

      // Save order in DB first
      const order = await Order.create({
        items: sanitizedData.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          productTitle: item.name,
          variantName: item.variantUnit,
          quantity: item.quantity,
          price: item.price,
          currency: item.currency || "EUR",
          image: item.image || "",
        })),
        customer: {
          fullName: sanitizedData.customer.fullName,
          email: sanitizedData.customer.email,
          phone: sanitizedData.customer.phone,
          isAdmin: sanitizedData.customer.isAdmin || false,
        },
        pickupType: sanitizedData.pickupType,
        pickupLocation: sanitizedData.pickupType === "store" ? sanitizedData.pickupLocation : undefined,
        deliveryAddress: sanitizedData.pickupType === "delivery" ? sanitizedData.deliveryAddress : undefined,
        deliveryTime: sanitizedData.pickupType === "delivery" ? sanitizedData.deliveryTime : undefined,
        deliveryFee: totals.shippingTotal,
        amount: totals.total,
        currency: "EUR",
        discountCode: sanitizedData.discountCode || "",
        discountAmount: sanitizedData.discountAmount || 0,
        paymentMethod: "paypal",
        notes: sanitizedData.notes || "",
        status: "en_attente",
      });

      logger.info(`[${requestId}] Order created in DB with ID: ${order._id}`);

      // Build PayPal payload
      const purchaseUnit = this.buildPurchaseUnit(sanitizedData, totals, order._id);

      // Set up return URLs based on your mobile app deep linking scheme
      const returnUrl = `${req.protocol}://${req.get("host")}/api/payments/paypal/return`;
      const cancelUrl = `${req.protocol}://${req.get("host")}/api/payments/paypal/cancel`;

      const payload = {
        intent: "CAPTURE",
        purchase_units: [purchaseUnit],
        application_context: {
          return_url: returnUrl,
          cancel_url: cancelUrl,
          brand_name: "Votre Boutique",
          locale: "fr-FR",
          landing_page: "LOGIN",
          shipping_preference: sanitizedData.pickupType === "delivery" ? "SET_PROVIDED_ADDRESS" : "NO_SHIPPING",
          user_action: "PAY_NOW",
        },
      };

      // Request PayPal API
      const token = await this.getAccessToken();
      const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
      const apiBase = PAYPAL_API_BASE[environment];

      logger.info(`[${requestId}] Creating PayPal order in ${environment} environment`);

      const response = await axios.post(`${apiBase}/v2/checkout/orders`, payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "PayPal-Request-Id": requestId,
          Prefer: "return=representation",
        },
        timeout: 30000,
      });

      const approvalUrl = response.data.links?.find((link) => link.rel === "approve")?.href;

      if (!approvalUrl) {
        throw new PayPalError("No approval URL received from PayPal");
      }

      // Save PayPal order ID
      order.paypalOrderId = response.data.id;
      await order.save();

      logger.info(`[${requestId}] PayPal order created successfully`, {
        orderId: order._id,
        paypalOrderId: response.data.id,
        status: response.data.status
      });

      res.status(201).json({
        orderId: order._id,
        approvalUrl,
        paypalOrder: {
          id: response.data.id,
          status: response.data.status,
          links: response.data.links,
        },
      });

    } catch (error) {
      logger.error(`[${requestId}] PayPal order creation failed:`, error);
      
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: "Validation error",
          message: error.message,
          requestId,
        });
      }

      if (error instanceof PayPalError) {
        return res.status(502).json({
          error: "PayPal service error",
          message: error.message,
          requestId,
        });
      }

      res.status(500).json({
        error: "Internal server error",
        message: "Failed to create PayPal order",
        requestId,
      });
    }
  }

  /**
   * Capture PayPal order - FIXED VERSION (removed duplicate)
   */
  async capturePayPalOrder(req, res) {
    const requestId = `cap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.info(`[${requestId}] PayPal capture started`);

    try {
      const { orderId } = req.body;
      
      if (!orderId) {
        return res.status(400).json({ 
          error: 'Order ID is required',
          requestId 
        });
      }

      // Find order in database
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ 
          error: 'Order not found',
          requestId 
        });
      }

      if (!order.paypalOrderId) {
        return res.status(400).json({ 
          error: 'PayPal order ID not found',
          requestId 
        });
      }

      const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
      const token = await this.getAccessToken();
      const apiBase = PAYPAL_API_BASE[environment] || PAYPAL_API_BASE.sandbox;

      logger.info(`[${requestId}] Capturing PayPal order: ${order.paypalOrderId}`);

      const response = await axios.post(
        `${apiBase}/v2/checkout/orders/${order.paypalOrderId}/capture`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'PayPal-Request-Id': requestId
          },
          timeout: 30000
        }
      );

      logger.info(`[${requestId}] PayPal capture response status: ${response.status}`);

      // Update order status based on PayPal response
      const captureStatus = response.data.status;
      order.status = captureStatus === 'COMPLETED' ? 'payé' : 'annulé';
      await order.save();

      logger.info(`[${requestId}] Order status updated to: ${order.status}`);

      res.json({
        success: captureStatus === 'COMPLETED',
        order: {
          id: order._id,
          status: order.status,
          amount: order.amount,
          currency: order.currency,
        },
        requestId
      });

    } catch (error) {
      logger.error(`[${requestId}] PayPal capture failed:`, error);

      if (error.response?.status === 404) {
        return res.status(404).json({
          error: 'PayPal order not found',
          requestId
        });
      }

      if (error.response?.status === 422) {
        return res.status(400).json({
          error: 'PayPal order cannot be captured',
          message: 'Order may already be captured or cancelled',
          requestId
        });
      }

      res.status(500).json({
        error: 'Failed to capture PayPal payment',
        message: error.response?.data?.message || error.message,
        requestId
      });
    }
  }

  /**
   * Handle PayPal success return
   */
  async handlePayPalReturn(req, res) {
    try {
      const { token, PayerID } = req.query;
      logger.info('PayPal return with token:', token, 'PayerID:', PayerID);

      res.send(`
        <!DOCTYPE html>
        <html lang="fr">
          <head>
            <title>Paiement Approuvé</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta charset="utf-8">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #16a34a, #22c55e);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 16px;
                box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
                text-align: center;
                max-width: 400px;
                width: 100%;
              }
              .success-icon { font-size: 60px; margin-bottom: 20px; }
              h1 { color: #16a34a; margin-bottom: 15px; font-size: 24px; }
              p { color: #666; margin-bottom: 20px; line-height: 1.5; }
              .spinner {
                border: 3px solid #f3f3f3;
                border-top: 3px solid #16a34a;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                animation: spin 1s linear infinite;
                margin: 20px auto;
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              .details { font-size: 12px; color: #9ca3af; margin-top: 15px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✅</div>
              <h1>Paiement Approuvé!</h1>
              <p>Votre paiement PayPal a été approuvé avec succès.</p>
              <div class="spinner"></div>
              <p><small>Finalisation en cours...</small></p>
              ${token ? `<div class="details">Référence: ${token.substring(0, 10)}***</div>` : ''}
            </div>
            <script>
              window.location.hash = '#paypal-success';
              
              // Communication with React Native WebView
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'PAYPAL_SUCCESS',
                  token: '${token || ''}',
                  payerId: '${PayerID || ''}'
                }));
              }
              
              // Fallback redirect
              setTimeout(() => {
                if (window.location.href.indexOf('auto_redirect') === -1) {
                  window.location.href = window.location.href + '&auto_redirect=true';
                }
              }, 3000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      logger.error('PayPal return error:', error);
      res.status(500).send(`
        <html><body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1 style="color: #ef4444;">❌ Erreur</h1>
          <p>Une erreur s'est produite lors du traitement de votre paiement.</p>
        </body></html>
      `);
    }
  }

  /**
   * Handle PayPal cancel
   */
  async handlePayPalCancel(req, res) {
    try {
      const { token } = req.query;
      logger.info('PayPal payment cancelled, token:', token);

      res.send(`
        <!DOCTYPE html>
        <html lang="fr">
          <head>
            <title>Paiement Annulé</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta charset="utf-8">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #ef4444, #f87171);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 16px;
                box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
                text-align: center;
                max-width: 400px;
                width: 100%;
              }
              .cancel-icon { font-size: 60px; margin-bottom: 20px; }
              h1 { color: #ef4444; margin-bottom: 15px; font-size: 24px; }
              p { color: #666; margin-bottom: 20px; line-height: 1.5; }
              .details { font-size: 12px; color: #9ca3af; margin-top: 15px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="cancel-icon">❌</div>
              <h1>Paiement Annulé</h1>
              <p>Vous avez annulé le paiement PayPal.</p>
              <p><small>Vous pouvez fermer cette fenêtre et réessayer.</small></p>
              ${token ? `<div class="details">Référence: ${token.substring(0, 10)}***</div>` : ''}
            </div>
            <script>
              window.location.hash = '#paypal-cancelled';
              
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'PAYPAL_CANCELLED',
                  token: '${token || ''}'
                }));
              }
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      logger.error('PayPal cancel error:', error);
      res.status(500).send(`
        <html><body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1 style="color: #ef4444;">❌ Erreur</h1>
          <p>Une erreur s'est produite.</p>
        </body></html>
      `);
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(req, res) {
    try {
      const { orderId } = req.params;
      
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.json({
        id: order._id,
        status: order.status,
        amount: order.amount,
        currency: order.currency,
        paypalOrderId: order.paypalOrderId,
        pickupType: order.pickupType,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      });
    } catch (error) {
      logger.error('Order status check failed:', error);
      res.status(500).json({ error: 'Failed to get order status' });
    }
  }
}

// Export controller instance
const paypalController = new PayPalController();

export const createPayPalOrder = (req, res) => paypalController.createPayPalOrder(req, res);
export const capturePayPalOrder = (req, res) => paypalController.capturePayPalOrder(req, res);
export const handlePayPalReturn = (req, res) => paypalController.handlePayPalReturn(req, res);
export const handlePayPalCancel = (req, res) => paypalController.handlePayPalCancel(req, res);
export const getOrderStatus = (req, res) => paypalController.getOrderStatus(req, res);