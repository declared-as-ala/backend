import mongoose from "mongoose";
import bcrypt from "bcrypt";

const adminSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "manager"], default: "manager" },
    active: { type: Boolean, default: true },
    refreshToken: { type: String, default: null },
  },
  { timestamps: true }
);

// Hash password before save
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

const AdminUser = mongoose.model("AdminUser", adminSchema);
export default AdminUser;
