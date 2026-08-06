const objectId = (value, helpers) => {
    if (!value.match(/^[0-9a-fA-F]{24}$/)) {
      return helpers.message('"{{#label}}" must be a valid mongo id');
    }
    return value;
  };
  
  const password = (value, helpers) => {
    if (value.length < 8) {
      return helpers.message('password must be at least 8 characters');
    }
    const missing = [];
    if (!value.match(/[A-Z]/)) missing.push('1 uppercase letter');
    if (!value.match(/[a-z]/)) missing.push('1 lowercase letter');
    if (!value.match(/\d/)) missing.push('1 number');
    if (!value.match(/[!@#$%^&*]/)) missing.push('1 special character (!@#$%^&*)');
    if (missing.length) {
      return helpers.message(`password must contain at least ${missing.join(', ')}`);
    }
    return value;
  };
  
  module.exports = {
    objectId,
    password,
  };