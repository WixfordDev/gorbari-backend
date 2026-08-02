const express = require('express');
const validate = require('../../middlewares/validate');
const authValidation = require('../../validations/auth.validation');
const authController = require('../../controllers/auth.controller');
const auth = require('../../middlewares/auth');
const { emailLimiter } = require('../../middlewares/rateLimiter');


const router = express.Router();

router.post('/register', validate(authValidation.register), authController.register);
router.post('/verify-email', validate(authValidation.verifyEmail), authController.verifyEmail);
router.post('/login', validate(authValidation.login), authController.login);
router.post('/forgot-password', emailLimiter, validate(authValidation.forgotPassword), authController.forgotPassword);
router.post('/reset-password', validate(authValidation.resetPassword), authController.resetPassword);
router.post('/change-password', auth('common'),validate(authValidation.changePassword), authController.changePassword);
router.post('/logout', validate(authValidation.logout), authController.logout);
router.post('/refresh-tokens', validate(authValidation.refreshTokens), authController.refreshTokens);
// Deliberately unauthenticated: an unverified account cannot log in, so it has
// no token to present. Rate limited instead, since the email is the only thing
// being handed out and it always goes to the address already on the account.
router.post(
  '/send-verification-email',
  emailLimiter,
  validate(authValidation.sendVerificationEmail),
  authController.sendVerificationEmail
);
router.post('/delete-me',auth('user'),validate(authValidation.deleteMe),authController.deleteMe);

module.exports = router;

