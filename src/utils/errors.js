export class PayPalError extends Error {
  constructor(message, code = null) {
    super(message);
    this.name = 'PayPalError';
    this.code = code;
  }
}

export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}
