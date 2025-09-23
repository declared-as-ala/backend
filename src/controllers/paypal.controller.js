import axios from "axios";
import Order from "../models/Order.js";
import { PayPalError, ValidationError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { sendInvoiceEmail } from '../utils/mailer.js';

const PAYPAL_API_BASE = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

class PayPalController {
  constructor() {
    this.validateCredentials();
    
    // Production environment detection
    this.environment = process.env.PAYPAL_ENVIRONMENT || 
                      (process.env.NODE_ENV === 'production' ? 'live' : 'sandbox');
                      
    this.apiBase = PAYPAL_API_BASE[this.environment] || PAYPAL_API_BASE.sandbox;
    
    // Production validation
    if (process.env.NODE_ENV === 'production' && this.environment !== 'live') {
      logger.warn('WARNING: Running in production but PayPal environment is not set to live');
    }
    
    // Log environment info (remove sensitive data)
    logger.info('PayPal Controller initialized:', {
      environment: this.environment,
      apiBase: this.apiBase,
      nodeEnv: process.env.NODE_ENV,
      hasClientId: !!process.env.PAYPAL_CLIENT_ID,
      hasClientSecret: !!process.env.PAYPAL_CLIENT_SECRET,
      baseUrl: process.env.BASE_URL
    });
  }

  validateCredentials() {
    const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, BASE_URL } = process.env;
    
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("PayPal credentials are not configured");
    }
    
    if (!BASE_URL) {
      throw new Error("BASE_URL is required for PayPal return URLs");
    }
    
    // Production validation
    if (process.env.NODE_ENV === 'production') {
      if (!BASE_URL.startsWith('https://')) {
        logger.warn('WARNING: Production BASE_URL should use HTTPS');
      }
      
      if (BASE_URL.includes('localhost')) {
        throw new Error("Production environment cannot use localhost URLs");
      }
    }
  }

  async getAccessToken() {
    try {
      const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;

      logger.info(`Requesting PayPal access token from ${this.environment} environment`);

      const response = await axios({
        url: `${this.apiBase}/v1/oauth2/token`,
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
        timeout: 15000,
      });

      if (!response.data.access_token) {
        throw new PayPalError("Invalid token response from PayPal");
      }

      logger.info('PayPal access token obtained successfully');
      return response.data.access_token;

    } catch (error) {
      logger.error("PayPal token generation failed:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        environment: this.environment,
        apiBase: this.apiBase
      });
      
      if (error.response?.status === 401) {
        throw new PayPalError("PayPal credentials are invalid for " + this.environment + " environment");
      }
      
      throw new PayPalError("Failed to authenticate with PayPal");
    }
  }

  validateOrderData(data) {
    const {
      amount,
      customer,
      items,
      pickupType,
      deliveryAddress,
      deliveryTime,
    } = data;

    // Amount validation
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      throw new ValidationError("Invalid amount provided");
    }

    // Customer validation
    const customerName = customer?.fullName || customer?.name;
    if (!customerName?.trim() || !customer?.email?.trim() || !customer?.phone?.trim()) {
      throw new ValidationError("Customer information is incomplete");
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.email)) {
      throw new ValidationError("Invalid email format");
    }

    // Items validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError("Items are required");
    }

    // Pickup type validation
    if (!["store", "delivery"].includes(pickupType)) {
      throw new ValidationError("Invalid pickup type");
    }

    // Delivery validation
    if (pickupType === "delivery") {
      if (!deliveryAddress?.street?.trim() || !deliveryAddress?.city?.trim()) {
        throw new ValidationError("Delivery address is incomplete");
      }
      if (!deliveryTime) {
        throw new ValidationError("Delivery time slot is required");
      }
    }

    // Detailed item validation
    items.forEach((item, index) => {
      const requiredFields = ['productId', 'variantId', 'name', 'price', 'quantity'];
      
      for (const field of requiredFields) {
        if (!item[field] && field !== 'quantity') {
          throw new ValidationError(`Item ${index + 1}: ${field} is required`);
        }
      }

      if (isNaN(item.price) || Number(item.price) <= 0) {
        throw new ValidationError(`Item ${index + 1}: Invalid price`);
      }

      if (isNaN(item.quantity) || Number(item.quantity) <= 0 || !Number.isInteger(Number(item.quantity))) {
        throw new ValidationError(`Item ${index + 1}: Invalid quantity`);
      }

      if (item.unitType && !['weight', 'piece'].includes(item.unitType)) {
        throw new ValidationError(`Item ${index + 1}: Invalid unitType '${item.unitType}'. Must be 'weight' or 'piece'`);
      }
    });
  }

  calculateTotals(items, deliveryFee = 0, discountAmount = 0) {
    const itemsTotal = items.reduce(
      (sum, item) => sum + (Number(item.price) * Number(item.quantity)),
      0
    );

    const shippingTotal = Number(deliveryFee) || 0;
    const discount = Number(discountAmount) || 0;
    const total = Number((itemsTotal + shippingTotal - discount).toFixed(2));

    return {
      itemsTotal: Number(itemsTotal.toFixed(2)),
      shippingTotal: Number(shippingTotal.toFixed(2)),
      discountAmount: Number(discount.toFixed(2)),
      total
    };
  }

  buildPurchaseUnit(orderData, totals, customId) {
    const { customer, items, pickupType, deliveryAddress } = orderData;

    const paypalItems = items.map((item) => ({
      name: `${String(item.name)} - ${String(item.variantUnit || item.variantName || '')}`.substring(0, 127),
      unit_amount: {
        currency_code: "EUR",
        value: Number(item.price).toFixed(2),
      },
      quantity: String(item.quantity),
      category: "PHYSICAL_GOODS",
    }));

    const customerName = customer.fullName || customer.name;

    const purchaseUnit = {
      custom_id: String(customId),
      reference_id: `TEMP_${Date.now()}`,
      description: `Commande Délices du Terroir - ${this.environment}`,
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

    if (totals.shippingTotal > 0) {
      purchaseUnit.amount.breakdown.shipping = {
        currency_code: "EUR",
        value: totals.shippingTotal.toFixed(2),
      };
    }

    if (totals.discountAmount > 0) {
      purchaseUnit.amount.breakdown.discount = {
        currency_code: "EUR",
        value: totals.discountAmount.toFixed(2),
      };
    }

    if (pickupType === "delivery" && deliveryAddress) {
      purchaseUnit.shipping = {
        name: { 
          full_name: String(customerName).substring(0, 300) 
        },
        address: {
          address_line_1: String(deliveryAddress.street).substring(0, 300),
          admin_area_2: String(deliveryAddress.city).substring(0, 120),
          postal_code: String(deliveryAddress.postalCode || '').substring(0, 60),
          country_code: String(deliveryAddress.country || "FR").substring(0, 2).toUpperCase(),
        },
      };
    }

    return purchaseUnit;
  }

  async createPayPalOrder(req, res) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.info(`[${requestId}] PayPal order creation started in ${this.environment} environment`);

    try {
      const orderData = req.body;
      
      const { environment, ...sanitizedData } = orderData;
      this.validateOrderData(sanitizedData);

      const totals = this.calculateTotals(
        sanitizedData.items,
        sanitizedData.deliveryFee,
        sanitizedData.discountAmount
      );

      const frontendTotal = Number(sanitizedData.amount);
      if (Math.abs(totals.total - frontendTotal) > 0.01) {
        throw new ValidationError(
          `Total mismatch: calculated ${totals.total}€, received ${frontendTotal}€`
        );
      }

      const customerName = sanitizedData.customer.fullName || sanitizedData.customer.name;
      if (!customerName) {
        throw new ValidationError("Customer name is required");
      }

      // Prepare complete order data
      const completeOrderData = {
        items: sanitizedData.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          productTitle: item.name,
          variantName: item.variantUnit || item.variantName || '',
          unitType: item.unitType || 'piece',
          grams: item.grams || null,
          quantity: Number(item.quantity),
          price: Number(item.price),
          total: Number(item.price) * Number(item.quantity),
          image: item.image || "",
          currency: item.currency || "EUR",
        })),
        customer: {
          fullName: customerName.trim(),
          email: sanitizedData.customer.email.trim().toLowerCase(),
          phone: sanitizedData.customer.phone.trim(),
          isAdmin: sanitizedData.customer.isAdmin || false,
        },
        pickupType: sanitizedData.pickupType,
        pickupLocation: sanitizedData.pickupType === "store" ? 
          (sanitizedData.pickupLocation || sanitizedData.pickupLocationDetails) : undefined,
        deliveryAddress: sanitizedData.pickupType === "delivery" ? sanitizedData.deliveryAddress : undefined,
        deliveryTime: sanitizedData.pickupType === "delivery" ? sanitizedData.deliveryTime : undefined,
        deliveryFee: totals.shippingTotal,
        amount: totals.total,
        currency: "EUR",
        discountCode: sanitizedData.discountCode || "",
        discountAmount: totals.discountAmount,
        paymentMethod: "paypal",
        notes: sanitizedData.notes || "",
      };

      // Build PayPal payload
      const purchaseUnit = this.buildPurchaseUnit(sanitizedData, totals, requestId);
      
      // Production return URLs
      const baseUrl = process.env.BASE_URL;
      const returnUrl = `${baseUrl}/api/payments/paypal/return`;
      const cancelUrl = `${baseUrl}/api/payments/paypal/cancel`;

      logger.info(`[${requestId}] PayPal return URLs:`, { returnUrl, cancelUrl });

      const payload = {
        intent: "CAPTURE",
        purchase_units: [purchaseUnit],
        application_context: {
          return_url: returnUrl,
          cancel_url: cancelUrl,
          brand_name: "Délices du Terroir",
          locale: "fr-FR",
          landing_page: "LOGIN",
          shipping_preference: sanitizedData.pickupType === "delivery" ? "SET_PROVIDED_ADDRESS" : "NO_SHIPPING",
          user_action: "PAY_NOW",
        },
      };

      // Make PayPal API request
      const token = await this.getAccessToken();
      
      logger.info(`[${requestId}] Creating PayPal order with payload size: ${JSON.stringify(payload).length} chars`);

      const response = await axios.post(
        `${this.apiBase}/v2/checkout/orders`, 
        payload, 
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "PayPal-Request-Id": requestId,
            Prefer: "return=representation",
          },
          timeout: 30000,
        }
      );

      // Extract approval URL
      const approvalUrl = response.data.links?.find((link) => link.rel === "approve")?.href;

      if (!approvalUrl) {
        throw new PayPalError("No approval URL received from PayPal");
      }

      logger.info(`[${requestId}] PayPal order created successfully`, {
        paypalOrderId: response.data.id,
        status: response.data.status,
        approvalUrl: approvalUrl,
        environment: this.environment
      });

      // Store order data temporarily
      global.pendingPayPalOrders = global.pendingPayPalOrders || {};
      global.pendingPayPalOrders[response.data.id] = completeOrderData;

      res.status(201).json({
        success: true,
        paypalOrderId: response.data.id,
        approvalUrl,
        paypalOrder: {
          id: response.data.id,
          status: response.data.status,
          links: response.data.links,
        },
        environment: this.environment,
        requestId
      });

    } catch (error) {
      logger.error(`[${requestId}] PayPal order creation failed:`, {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        environment: this.environment
      });
      
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          message: error.message,
          requestId,
        });
      }

      if (error instanceof PayPalError) {
        return res.status(502).json({
          success: false,
          error: "PayPal service error",
          message: error.message,
          requestId,
        });
      }

      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to create PayPal order",
        requestId,
      });
    }
  }

  async capturePayPalOrder(req, res) {
    const requestId = `cap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.info(`[${requestId}] PayPal capture started in ${this.environment} environment`);

    try {
      const { paypalOrderId } = req.body;
      
      if (!paypalOrderId) {
        return res.status(400).json({ 
          success: false,
          error: 'PayPal Order ID is required',
          requestId 
        });
      }

      // Get order data from temporary storage
      const orderData = global.pendingPayPalOrders?.[paypalOrderId];
      if (!orderData) {
        logger.error(`[${requestId}] No pending order data found for PayPal order: ${paypalOrderId}`);
        return res.status(404).json({ 
          success: false,
          error: 'Order data not found',
          requestId 
        });
      }

      const token = await this.getAccessToken();

      logger.info(`[${requestId}] Checking PayPal order status: ${paypalOrderId}`);

      const orderDetailsResponse = await axios.get(
        `${this.apiBase}/v2/checkout/orders/${paypalOrderId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          timeout: 30000
        }
      );

      const orderDetails = orderDetailsResponse.data;
      logger.info(`[${requestId}] PayPal order status:`, {
        status: orderDetails.status,
        intent: orderDetails.intent,
        environment: this.environment
      });

      if (orderDetails.status !== 'APPROVED') {
        const errorMessage = orderDetails.status === 'CANCELLED' 
          ? 'Le paiement a été annulé'
          : orderDetails.status === 'CREATED'
          ? 'Le paiement n\'a pas encore été approuvé'
          : `État de commande inattendu: ${orderDetails.status}`;

        logger.warn(`[${requestId}] Cannot capture order:`, {
          status: orderDetails.status,
          paypalOrderId,
          environment: this.environment
        });

        return res.status(422).json({
          success: false,
          error: 'ORDER_NOT_APPROVED',
          message: errorMessage,
          details: {
            status: orderDetails.status,
            paypalOrderId,
            environment: this.environment
          },
          requestId
        });
      }

      logger.info(`[${requestId}] Capturing approved PayPal order: ${paypalOrderId}`);

      const response = await axios.post(
        `${this.apiBase}/v2/checkout/orders/${paypalOrderId}/capture`,
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

      const captureStatus = response.data.status;
      const isCompleted = captureStatus === 'COMPLETED';

      if (!isCompleted) {
        logger.error(`[${requestId}] PayPal capture failed:`, {
          status: captureStatus,
          paypalOrderId,
          environment: this.environment
        });
        
        delete global.pendingPayPalOrders[paypalOrderId];
        
        return res.status(422).json({
          success: false,
          error: 'CAPTURE_FAILED',
          message: 'Le paiement n\'a pas pu être capturé',
          requestId
        });
      }

      // Create order in database
      const order = await Order.create({
        ...orderData,
        status: 'payé',
        paypalOrderId: paypalOrderId,
        paypalCaptureId: response.data.purchase_units?.[0]?.payments?.captures?.[0]?.id,
        paypalCaptureDetails: {
          captureId: response.data.purchase_units?.[0]?.payments?.captures?.[0]?.id,
          status: captureStatus,
          capturedAt: new Date(),
          amount: response.data.purchase_units?.[0]?.payments?.captures?.[0]?.amount,
          environment: this.environment
        }
      });

      logger.info(`[${requestId}] Order created successfully:`, {
        orderId: order._id,
        paypalOrderId,
        status: captureStatus,
        captureId: order.paypalCaptureId,
        environment: this.environment
      });

      delete global.pendingPayPalOrders[paypalOrderId];

      // Send invoice email
      try {
        await sendInvoiceEmail(order.customer.email, order);
        logger.info(`[${requestId}] Invoice sent successfully to: ${order.customer.email}`);
      } catch (emailError) {
        logger.error(`[${requestId}] Failed to send invoice email:`, {
          email: order.customer.email,
          orderId: order._id,
          error: emailError.message
        });
      }

      res.json({
        success: true,
        orderId: order._id,
        paypalOrderId,
        captureStatus,
        order: {
          id: order._id,
          status: order.status,
          amount: order.amount,
          currency: order.currency,
        },
        environment: this.environment,
        requestId
      });

    } catch (error) {
      logger.error(`[${requestId}] PayPal capture failed:`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        environment: this.environment
      });

      if (error.response?.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'PayPal order not found',
          requestId
        });
      }

      if (error.response?.status === 422) {
        return res.status(422).json({
          success: false,
          error: 'PayPal order cannot be captured',
          message: 'Order may already be captured or cancelled',
          details: error.response?.data,
          requestId
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to capture PayPal payment',
        message: error.response?.data?.message || error.message,
        requestId
      });
    }
  }

  async handlePayPalReturn(req, res) {
    try {
      const { token, PayerID } = req.query;
      logger.info(`PayPal return - Environment: ${this.environment}`, { token, PayerID });

      res.send(`
        <!DOCTYPE html>
        <html lang="fr">
          <head>
            <title>Paiement Approuvé - Délices du Terroir</title>
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
              <div class="details">Environnement: ${this.environment}</div>
            </div>
            <script>
              const messageData = {
                type: 'PAYPAL_SUCCESS',
                token: '${token || ''}',
                payerId: '${PayerID || ''}',
                environment: '${this.environment}',
                timestamp: new Date().toISOString()
              };

              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify(messageData));
              }

              if (window.parent && window.parent !== window) {
                window.parent.postMessage(messageData, '*');
              }

              setTimeout(() => {
                try {
                  window.close();
                } catch (e) {
                  document.body.innerHTML = \`
                    <div class="container">
                      <div class="success-icon">🎉</div>
                      <h1>Paiement Réussi!</h1>
                      <p>Vous pouvez fermer cette fenêtre.</p>
                    </div>
                  \`;
                }
              }, 2000);
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
          <script>
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PAYPAL_ERROR',
                error: 'Payment processing failed',
                environment: '${this.environment}'
              }));
            }
          </script>
        </body></html>
      `);
    }
  }

  async handlePayPalCancel(req, res) {
    try {
      const { token } = req.query;
      logger.info(`PayPal payment cancelled - Environment: ${this.environment}`, { token });

      res.send(`
        <!DOCTYPE html>
        <html lang="fr">
          <head>
            <title>Paiement Annulé - Délices du Terroir</title>
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
              <div class="details">Environnement: ${this.environment}</div>
            </div>
            <script>
              const messageData = {
                type: 'PAYPAL_CANCELLED',
                token: '${token || ''}',
                environment: '${this.environment}',
                timestamp: new Date().toISOString()
              };

              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify(messageData));
              }

              if (window.parent && window.parent !== window) {
                window.parent.postMessage(messageData, '*');
              }

              setTimeout(() => {
                try {
                  window.close();
                } catch (e) {
                  // Can't close, that's fine
                }
              }, 2000);
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

  async getOrderStatus(req, res) {
    try {
      const { orderId } = req.params;
      
      if (!orderId) {
        return res.status(400).json({ error: 'Order ID is required' });
      }
      
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      logger.info(`Order status check:`, {
        orderId,
        status: order.status,
        environment: this.environment
      });

      res.json({
        success: true,
        order: {
          id: order._id,
          status: order.status,
          amount: order.amount,
          currency: order.currency,
          paypalOrderId: order.paypalOrderId,
          paypalCaptureId: order.paypalCaptureId,
          pickupType: order.pickupType,
          itemsCount: order.items?.length || 0,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt
        },
        environment: this.environment
      });
    } catch (error) {
      logger.error('Order status check failed:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get order status' 
      });
    }
  }
}

// Export singleton instance
const paypalController = new PayPalController();

export const createPayPalOrder = (req, res) => paypalController.createPayPalOrder(req, res);
export const capturePayPalOrder = (req, res) => paypalController.capturePayPalOrder(req, res);
export const handlePayPalReturn = (req, res) => paypalController.handlePayPalReturn(req, res);
export const handlePayPalCancel = (req, res) => paypalController.handlePayPalCancel(req, res);
export const getOrderStatus = (req, res) => paypalController.getOrderStatus(req, res);