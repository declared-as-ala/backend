import Customer from '../models/Customer.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefresh,
} from '../utils/jwt.js';

// REGISTER
export async function register(req, res, next) {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    const exists = await Customer.findOne({ email });
    if (exists) return res.status(409).json({ message: 'Email déjà utilisé' });

    const user = await Customer.create({
      email,
      password,
      firstName,
      lastName,
      phone,
    });
    const payload = { id: user._id, email: user.email, firstName, lastName };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.status(201).json({
      user: { ...payload, phone, loyaltyPoints: user.loyaltyPoints },
      accessToken,
      refreshToken,
    });
  } catch (e) {
    next(e);
  }
}

// LOGIN
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await Customer.findOne({ email, active: true });
    if (!user)
      return res.status(401).json({ message: 'Identifiants invalides' });
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: 'Identifiants invalides' });

    const payload = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.json({
      user: {
        ...payload,
        phone: user.phone,
        loyaltyPoints: user.loyaltyPoints,
      },
      accessToken,
      refreshToken,
    });
  } catch (e) {
    next(e);
  }
}

// REFRESH TOKEN
export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(400).json({ message: 'Missing refreshToken' });

    const payload = verifyRefresh(refreshToken);
    const { id, email, firstName, lastName } = payload;
    const accessToken = signAccessToken({ id, email, firstName, lastName });

    res.json({ accessToken });
  } catch (e) {
    return res
      .status(401)
      .json({ message: 'Refresh token expired or invalid' });
  }
}

export async function me(req, res, next) {
  try {
    // req.user is set by auth middleware from access token
    const u = await Customer.findById(req.user.id).select('-password');
    if (!u) return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.set('Cache-Control', 'no-store');
    res.json({ user: u });
  } catch (e) {
    next(e);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const { firstName, lastName, phone } = req.body;
    const u = await Customer.findByIdAndUpdate(
      req.user.id,
      { firstName, lastName, phone },
      { new: true, select: '-password' }
    );
    res.json({ user: u });
  } catch (e) {
    next(e);
  }
}

// Minimal stub – hook to your email service (resend, nodemailer, etc.)
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const u = await Customer.findOne({ email });
    if (!u) return res.json({ ok: true }); // don't leak
    // Generate token + send email (not implemented here)
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
