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
    this.environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
    this.apiBase = PAYPAL_API_BASE[this.environment] || PAYPAL_API_BASE.sandbox;
  }

  validateCredentials() {
    const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("PayPal credentials are not configured");
    }
  }

  async getAccessToken() {
    try {
      const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;

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

      return response.data.access_token;
    } catch (error) {
      logger.error("PayPal token generation failed:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
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

    // Customer validation - Fix: check for 'name' or 'fullName'
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
      const requiredFields = ['productId', 'variantId', 'name', 'variantUnit', 'price', 'quantity'];
      
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

      // Validate unitType
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

  buildPurchaseUnit(orderData, totals, orderId) {
    const { customer, items, pickupType, deliveryAddress } = orderData;

    // Build PayPal items - Remove unitType as PayPal doesn't need it
    const paypalItems = items.map((item) => ({
      name: `${String(item.name)} - ${String(item.variantUnit)}`.substring(0, 127),
      unit_amount: {
        currency_code: "EUR",
        value: Number(item.price).toFixed(2),
      },
      quantity: String(item.quantity),
      category: "PHYSICAL_GOODS",
    }));

    // Fix: Handle both 'name' and 'fullName' from customer
    const customerName = customer.fullName || customer.name;

    const purchaseUnit = {
      custom_id: String(orderId),
      reference_id: `ORDER_${orderId}`,
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

    // Add shipping if applicable
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

    // Add shipping address for delivery
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
    logger.info(`[${requestId}] PayPal order creation started`);

    try {
      const orderData = req.body;
      
      // Clean and validate input
      const { environment, ...sanitizedData } = orderData;
      this.validateOrderData(sanitizedData);

      // Calculate and verify totals
      const totals = this.calculateTotals(
        sanitizedData.items,
        sanitizedData.deliveryFee,
        sanitizedData.discountAmount
      );

      // Verify total matches frontend calculation
      const frontendTotal = Number(sanitizedData.amount);
      if (Math.abs(totals.total - frontendTotal) > 0.01) {
        throw new ValidationError(
          `Total mismatch: calculated ${totals.total}€, received ${frontendTotal}€`
        );
      }

      // Fix: Handle both customer.name and customer.fullName
      const customerName = sanitizedData.customer.fullName || sanitizedData.customer.name;
      if (!customerName) {
        throw new ValidationError("Customer name is required");
      }

      // Create order in database
      const order = await Order.create({
        items: sanitizedData.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          productTitle: item.name,
          variantName: item.variantUnit,
          quantity: Number(item.quantity),
          price: Number(item.price),
          total: Number(item.price) * Number(item.quantity),
          unitType: item.unitType || 'piece', // Use actual unitType from frontend
          currency: item.currency || "EUR",
          image: item.image || "",
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
        status: "en_attente",
      });

      logger.info(`[${requestId}] Order created in DB:`, { 
        orderId: order._id, 
        amount: totals.total,
        itemsCount: sanitizedData.items.length 
      });

      // Build PayPal payload
      const purchaseUnit = this.buildPurchaseUnit(sanitizedData, totals, order._id);
      
      // Setup mobile-friendly return URLs
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const returnUrl = `${baseUrl}/api/payments/paypal/return`;
      const cancelUrl = `${baseUrl}/api/payments/paypal/cancel`;

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
      
      logger.info(`[${requestId}] Creating PayPal order in ${this.environment} environment`);

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

      // Save PayPal order ID
      order.paypalOrderId = response.data.id;
      await order.save();

      logger.info(`[${requestId}] PayPal order created successfully`, {
        orderId: order._id,
        paypalOrderId: response.data.id,
        status: response.data.status,
        approvalUrl: approvalUrl
      });

      // Return success response
      res.status(201).json({
        success: true,
        orderId: order._id,
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
        response: error.response?.data
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
    logger.info(`[${requestId}] PayPal capture started`);

    try {
      const { orderId, paypalOrderId } = req.body;
      
      if (!orderId) {
        return res.status(400).json({ 
          success: false,
          error: 'Order ID is required',
          requestId 
        });
      }

      // Find order in database
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ 
          success: false,
          error: 'Order not found',
          requestId 
        });
      }

      const paypalId = paypalOrderId || order.paypalOrderId;
      if (!paypalId) {
        return res.status(400).json({ 
          success: false,
          error: 'PayPal order ID not found',
          requestId 
        });
      }

      const token = await this.getAccessToken();

      logger.info(`[${requestId}] Capturing PayPal order: ${paypalId}`);

      const response = await axios.post(
        `${this.apiBase}/v2/checkout/orders/${paypalId}/capture`,
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

      // Update order status
      order.status = isCompleted ? 'payé' : 'échec_paiement';
      order.paypalCaptureId = response.data.purchase_units?.[0]?.payments?.captures?.[0]?.id;
      await order.save();

      logger.info(`[${requestId}] PayPal capture completed`, {
        orderId: order._id,
        paypalOrderId: paypalId,
        status: captureStatus,
        captureId: order.paypalCaptureId
      });

      res.json({
        success: isCompleted,
        orderId: order._id,
        paypalOrderId: paypalId,
        captureStatus,
        order: {
          id: order._id,
          status: order.status,
          amount: order.amount,
          currency: order.currency,
        },
        requestId
      });

    } catch (error) {
      logger.error(`[${requestId}] PayPal capture failed:`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
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
      logger.info('PayPal return:', { token, PayerID });

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
              // Enhanced mobile app communication
              const messageData = {
                type: 'PAYPAL_SUCCESS',
                token: '${token || ''}',
                payerId: '${PayerID || ''}',
                timestamp: new Date().toISOString()
              };

              // React Native WebView
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify(messageData));
              }

              // Expo WebBrowser
              if (window.location.origin !== 'null') {
                window.location.hash = '#paypal-success';
              }

              // Custom URL scheme redirect
              setTimeout(() => {
                const customUrl = 'yourapp://paypal/success?token=${token || ''}&payerId=${PayerID || ''}';
                window.location.href = customUrl;
              }, 2000);

              // Fallback
              setTimeout(() => {
                window.close();
              }, 5000);
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

  async handlePayPalCancel(req, res) {
    try {
      const { token } = req.query;
      logger.info('PayPal payment cancelled:', { token });

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
            </style>
          </head>
          <body>
            <div class="container">
              <div class="cancel-icon">❌</div>
              <h1>Paiement Annulé</h1>
              <p>Vous avez annulé le paiement PayPal.</p>
              <p><small>Vous pouvez fermer cette fenêtre et réessayer.</small></p>
            </div>
            <script>
              const messageData = {
                type: 'PAYPAL_CANCELLED',
                token: '${token || ''}',
                timestamp: new Date().toISOString()
              };

              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify(messageData));
              }

              window.location.hash = '#paypal-cancelled';
              
              setTimeout(() => {
                const customUrl = 'yourapp://paypal/cancel?token=${token || ''}';
                window.location.href = customUrl;
              }, 2000);

              setTimeout(() => {
                window.close();
              }, 5000);
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
        }
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