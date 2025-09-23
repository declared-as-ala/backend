// Existing imports
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { tinyRateLimit } from "./middleware/rateLimit.js";
import { connectDB } from "./config/db.js";
// Customer routes
import productRoutes from "./routes/product.routes.js";
import StripeRoutes from "./routes/stripe.routes.js";
import customerAuthRoutes from "./routes/customerAuth.routes.js";
import customerOrderRoutes from "./routes/customerOrder.routes.js";
import { customerAuth } from "./middleware/customerAuth.js";
import Customerdiscountroutes from "./routes/reduce.routes.js";
import paypalRoutes from "./routes/paypal.routes.js";
import forgetpassword from "./routes/forgetpassword.routes.js";

// ✅ Admin routes
import adminAuthRoutes from "./routes/admin/authRoutes.js";
import adminDashboardRoutes from "./routes/admin/dashboardRoutes.js";
import adminProductRoutes from "./routes/admin/productRoutes.js";
import adminOrderRoutes from "./routes/admin/orderRoutes.js";
import adminCustomerRoutes from "./routes/admin/customerRoutes.js";
import adminDiscountRoutes from "./routes/admin/discountRoutes.js";

const app = express();

// Standard middlewares (before body parsing)
app.use(helmet());
const allowedOrigins = [
  "https://peaceful-pavlova-13c173.netlify.app",
  "http://localhost:3000",
  "https://lesdelicesadmin.com",
  "https://www.lesdelicesadmin.com/",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(morgan("dev"));
app.use(tinyRateLimit());

// ⚠️ Stripe webhook must come BEFORE express.json()
app.use(
  "/api/payments/stripe/webhook",
  express.raw({ type: "application/json" })
);

// JSON parser for all other routes
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// Disable caching for all API responses
app.disable("etag");
app.use("/api", (req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
app.get('/db', async (req, res) => {
  try {
    await connectDB();
    res.status(200).json({ message: '✅ Database connected successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '❌ Database connection failed', error: err.message });
  }
});
// ------------------- Routes -------------------

// Customer routes
app.use("/api", customerAuthRoutes);
app.use("/api", forgetpassword);
app.use("/api/orders", customerAuth, customerOrderRoutes);
app.use("/api/products", productRoutes);
app.use("/api/payments", StripeRoutes);
app.use("/api/payments/paypal", paypalRoutes);
app.use("/api/discounts", Customerdiscountroutes);

// Admin routes
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/products", adminProductRoutes);
app.use("/api/admin/orders", adminOrderRoutes);
app.use("/api/admin/customers", adminCustomerRoutes);
app.use("/api/admin/discounts", adminDiscountRoutes);

export default app;
