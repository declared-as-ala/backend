import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  debug: true, // Enable debug output
  logger: true, // Log information in console
});

export const sendInvoiceEmail = async (to, order) => {
  try {
    console.log('📧 Attempting to send email to:', to);
    console.log('📧 SMTP Config:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      // Don't log password
    });

    // Premium French email template with beautiful design
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmation de commande - Les Délices du Verger</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            line-height: 1.6;
            color: #2c3e50;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
          }
          
          .email-container {
            max-width: 650px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 25px 50px rgba(0,0,0,0.15);
          }
          
          .header {
            background: linear-gradient(135deg, #2c5530 0%, #4a7c59 50%, #6ba368 100%);
            color: white;
            padding: 80px 80px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="2" fill="rgba(255,255,255,0.1)"/><circle cx="20" cy="20" r="1" fill="rgba(255,255,255,0.05)"/><circle cx="80" cy="30" r="1.5" fill="rgba(255,255,255,0.08)"/></svg>');
            animation: float 20s infinite linear;
          }
          
          @keyframes float {
            0% { transform: translateX(-50px) translateY(-50px) rotate(0deg); }
            100% { transform: translateX(-50px) translateY(-50px) rotate(360deg); }
          }
          
          .logo-container {
            position: relative;
            z-index: 2;
            margin-bottom: 20px;
          }
          
          .logo {
            width: 80px;
            height: 80px;
            background: #ffffff;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 60px;
            margin-bottom: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            position: relative;
            overflow: hidden;
          }
          
          .logo::before {
            content: '';
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            background: linear-gradient(45deg, #e74c3c, #c0392b, #a93226);
            border-radius: 50%;
            z-index: -1;
            opacity: 0.1;
          }
          
          .company-name {
            font-family: 'Playfair Display', serif;
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            position: relative;
            z-index: 2;
          }
          
          .tagline {
            font-size: 14px;
            opacity: 0.9;
            font-weight: 300;
            position: relative;
            z-index: 2;
          }
          
          .content {
            padding: 40px 30px;
          }
          
          .success-badge {
            background: linear-gradient(135deg, #00b894, #00cec9);
            color: white;
            padding: 12px 25px;
            border-radius: 50px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-weight: 500;
            margin-bottom: 25px;
            box-shadow: 0 5px 15px rgba(0, 184, 148, 0.3);
          }
          
          .greeting {
            font-size: 24px;
            color: #2c3e50;
            margin-bottom: 10px;
            font-weight: 600;
          }
          
          .order-info {
            background: linear-gradient(135deg, #f8f9ff, #e3f2fd);
            padding: 25px;
            border-radius: 15px;
            margin: 25px 0;
            border-left: 4px solid #4a7c59;
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
          }
          
          .info-item {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .info-icon {
            width: 20px;
            height: 20px;
            color: #4a7c59;
          }
          
          .info-label {
            font-weight: 500;
            color: #64748b;
            font-size: 13px;
          }
          
          .info-value {
            font-weight: 600;
            color: #2c3e50;
          }
          
          .items-section {
            margin: 30px 0;
          }
          
          .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .items-list {
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          }
          
          .item {
            display: flex;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid #f1f5f9;
            transition: background-color 0.2s;
          }
          
          .item:hover {
            background: #f8fafc;
          }
          
          .item:last-child {
            border-bottom: none;
          }
          
          .item-icon {
            width: 45px;
            height: 45px;
            background: linear-gradient(135deg, #4a7c59, #6ba368);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 20px;
            margin-right: 15px;
          }
          
          .item-details {
            flex: 1;
          }
          
          .item-name {
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 2px;
          }
          
          .item-meta {
            font-size: 13px;
            color: #64748b;
          }
          
          .item-price {
            font-weight: 700;
            color: #4a7c59;
            font-size: 16px;
          }
          
          .delivery-section {
            background: linear-gradient(135deg, #fff5f5, #fef7f7);
            padding: 20px;
            border-radius: 12px;
            margin: 25px 0;
            border-left: 4px solid #e74c3c;
          }
          
          .pickup-section {
            background: linear-gradient(135deg, #e8f5e8, #f0fdf4);
            padding: 20px;
            border-radius: 12px;
            margin: 25px 0;
            border-left: 4px solid #4a7c59;
          }
          
          .total-section {
            background: linear-gradient(135deg, #4a7c59, #6ba368);
            color: white;
            padding: 25px;
            border-radius: 15px;
            margin: 30px 0;
            text-align: center;
          }
          
          .total-amount {
            font-size: 36px;
            font-weight: 700;
            margin-bottom: 8px;
          }
          
          .total-label {
            font-size: 14px;
            opacity: 0.9;
          }
          
          .footer {
            background: #f8fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          
          .social-links {
            margin: 20px 0;
          }
          
          .social-link {
            display: inline-block;
            margin: 0 10px;
            width: 40px;
            height: 40px;
            background: #4a7c59;
            color: white;
            border-radius: 50%;
            text-decoration: none;
            line-height: 40px;
            transition: transform 0.2s;
          }
          
          .social-link:hover {
            transform: translateY(-2px);
          }
          
          .contact-info {
            font-size: 13px;
            color: #64748b;
            margin-top: 20px;
          }
          
          .notes {
            background: #fef9e7;
            border-left: 4px solid #f39c12;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
          }
          
          @media (max-width: 600px) {
            body { padding: 10px; }
            .email-container { border-radius: 10px; }
            .header, .content { padding: 25px 20px; }
            .info-grid { grid-template-columns: 1fr; }
            .total-amount { font-size: 28px; }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <!-- Header avec logo et branding -->
          <div class="header">
            <div class="logo-container">
              <div class="logo">🍏</div>
              <h1 class="company-name">Les Délices du Verger</h1>
              <p class="tagline">Fruits et légumes de qualité premium</p>
            </div>
          </div>
          
          <div class="content">
            <!-- Badge de succès -->
            <div class="success-badge">
              ✅ Commande confirmée et payée
            </div>
            
            <h2 class="greeting">Bonjour ${order.customer.fullName} !</h2>
            <p style="margin-bottom: 25px; color: #64748b;">
              Nous vous remercions pour votre confiance. Votre commande a été traitée avec succès et sera bientôt prête.
            </p>
            
            <!-- Informations de commande -->
            <div class="order-info">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-icon">🏷️</span>
                  <div>
                    <div class="info-label">Numéro de commande</div>
                    <div class="info-value">#${String(order._id)
                      .slice(-8)
                      .toUpperCase()}</div>
                  </div>
                </div>
                <div class="info-item">
                  <span class="info-icon">📅</span>
                  <div>
                    <div class="info-label">Date de commande</div>
                    <div class="info-value">${new Date(
                      order.createdAt || Date.now()
                    ).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}</div>
                  </div>
                </div>
                <div class="info-item">
                  <span class="info-icon">${
                    order.pickupType === 'delivery' ? '🚚' : '🏪'
                  }</span>
                  <div>
                    <div class="info-label">Mode de récupération</div>
                    <div class="info-value">${
                      order.pickupType === 'delivery'
                        ? 'Livraison à domicile'
                        : 'Retrait en magasin'
                    }</div>
                  </div>
                </div>
                <div class="info-item">
                  <span class="info-icon">💳</span>
                  <div>
                    <div class="info-label">Statut du paiement</div>
                    <div class="info-value">✅ Payé</div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Articles commandés -->
            <div class="items-section">
              <h3 class="section-title">
                🛒 Vos articles (${order.items.reduce(
                  (acc, item) => acc + item.quantity,
                  0
                )} article${
      order.items.reduce((acc, item) => acc + item.quantity, 0) > 1 ? 's' : ''
    })
              </h3>
              <div class="items-list">
                ${order.items
                  .map(
                    (item) => `
                  <div class="item">
                    <div class="item-icon">🥕</div>
                    <div class="item-details">
                      <div class="item-name">${item.name}</div>
                      <div class="item-meta">Quantité: ${item.quantity}</div>
                    </div>
                    <div class="item-price">${item.price}€</div>
                  </div>
                `
                  )
                  .join('')}
                
                ${
                  order.deliveryFee > 0
                    ? `
                  <div class="item">
                    <div class="item-icon">🚚</div>
                    <div class="item-details">
                      <div class="item-name">Frais de livraison</div>
                      <div class="item-meta">Transport à domicile</div>
                    </div>
                    <div class="item-price">${order.deliveryFee}€</div>
                  </div>
                `
                    : ''
                }
              </div>
            </div>
            
            ${
              order.pickupType === 'delivery' && order.deliveryAddress
                ? `
              <div class="delivery-section">
                <h3 class="section-title">
                  📍 Adresse de livraison
                </h3>
                <p style="margin: 10px 0; font-weight: 500;">
                  ${order.deliveryAddress.street}<br>
                  ${order.deliveryAddress.postalCode} ${order.deliveryAddress.city}<br>
                  ${order.deliveryAddress.country}
                </p>
                <p style="font-size: 13px; color: #e74c3c; margin-top: 15px;">
                  📞 Nous vous contacterons avant la livraison pour confirmer votre disponibilité.
                </p>
              </div>
            `
                : order.pickupType === 'store' && order.pickupLocation
                ? `
              <div class="pickup-section">
                <h3 class="section-title">
                  🏪 Retrait en magasin
                </h3>
                <p style="margin: 10px 0; font-weight: 500;">
                  ${order.pickupLocation.name}<br>
                  ${order.pickupLocation.address}
                </p>
                ${
                  order.pickupLocation.description
                    ? `
                <p style="margin: 10px 0; color: #64748b; font-style: italic;">
                  ${order.pickupLocation.description}
                </p>
                `
                    : ''
                }
                <p style="font-size: 13px; color: #4a7c59; margin-top: 15px;">
                  📞 Votre commande sera prête dans 2-4 heures. Nous vous contacterons dès qu'elle sera disponible.
                </p>
              </div>
            `
                : `
              <div class="pickup-section">
                <h3 class="section-title">
                  🏪 Retrait en magasin
                </h3>
                <p style="margin: 10px 0; font-weight: 500;">
                  Les Délices du Verger<br>
                  123 Rue des Jardins<br>
                  75001 Paris, France
                </p>
                <p style="font-size: 13px; color: #4a7c59; margin-top: 15px;">
                  📞 Votre commande sera prête dans 2-4 heures. Nous vous contacterons dès qu'elle sera disponible.
                </p>
              </div>
            `
            }
            
            ${
              order.notes
                ? `
              <div class="notes">
                <h3 style="margin-bottom: 10px; color: #f39c12;">📝 Notes spéciales</h3>
                <p style="margin: 0; font-style: italic;">${order.notes}</p>
              </div>
            `
                : ''
            }
            
            <!-- Total -->
            <div class="total-section">
              <div class="total-amount">${order.amount}€</div>
              <div class="total-label">Montant total payé</div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <p style="color: #64748b; margin-bottom: 20px;">
                Merci de faire confiance aux Délices du Verger pour vos achats de fruits et légumes frais !
              </p>
              <p style="font-size: 14px; color: #4a7c59; font-weight: 500;">
                🌱 Nos produits sont sélectionnés avec soin pour vous offrir la meilleure qualité
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <h3 style="color: #2c3e50; margin-bottom: 15px;">Les Délices du Verger</h3>
            
            <div class="social-links">
              <a href="#" class="social-link">📘</a>
              <a href="#" class="social-link">📷</a>
              <a href="#" class="social-link">🐦</a>
            </div>
            
            <div class="contact-info">
              <p><strong>📍 Adresse :</strong> 123 Rue des Jardins, 75001 Paris</p>
              <p><strong>📞 Téléphone :</strong> +33 1 23 45 67 89</p>
              <p><strong>📧 Email :</strong> contact@delicesverger.fr</p>
              <p><strong>🕒 Horaires :</strong> Lun-Sam 8h00-19h00, Dim 9h00-13h00</p>
            </div>
            
            <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
              <p>© 2025 Les Délices du Verger. Tous droits réservés.</p>
              <p>Fruits et légumes frais • Qualité premium • Livraison rapide</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await transporter.sendMail({
      from: `"Les Délices du Verger" <${process.env.SMTP_USER}>`,
      to,
      subject: `🍎 Confirmation de commande #${String(order._id)
        .slice(-8)
        .toUpperCase()} - Les Délices du Verger`,
      html: htmlContent,
      // Version texte pour les clients email qui ne supportent pas HTML
      text: `
Bonjour ${order.customer.fullName},

Merci pour votre commande chez Les Délices du Verger !

Détails de votre commande :
- Numéro : #${String(order._id).slice(-8).toUpperCase()}
- Date : ${new Date(order.createdAt || Date.now()).toLocaleDateString('fr-FR')}
- Mode : ${
        order.pickupType === 'delivery'
          ? 'Livraison à domicile'
          : 'Retrait en magasin'
      }

Articles commandés :
${order.items
  .map((item) => `• ${item.name} x ${item.quantity} - ${item.price}€`)
  .join('\n')}
${order.deliveryFee > 0 ? `• Frais de livraison - ${order.deliveryFee}€` : ''}

Montant total : ${order.amount}€

${
  order.pickupType === 'delivery' && order.deliveryAddress
    ? `Livraison à : ${order.deliveryAddress.street}, ${order.deliveryAddress.postalCode} ${order.deliveryAddress.city}`
    : order.pickupLocation
    ? `À retirer au : ${order.pickupLocation.name}, ${order.pickupLocation.address}`
    : 'À retirer au : 123 Rue des Jardins, 75001 Paris'
}

Merci de votre confiance !
Les Délices du Verger
+33 1 23 45 67 89
      `,
    });

    console.log('✅ Email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    throw error;
  }
};

// Test transporter configuration
export const testEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified');
  } catch (error) {
    console.error('❌ SMTP connection failed:', error);
  }
};
