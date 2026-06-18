const ApiError = require("../utils/ApiError");

const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(
        ApiError.badRequest("Validation failed", result.error.issues)
      );
    }
    req[source] = result.data;
    next();
  };

const validateResumeText = (text) => {
  const trimmed = (text || "").trim();
  if (trimmed.length === 0) {
    throw ApiError.badRequest("Resume content is empty");
  }
  if (trimmed.length > 30000) {
    throw ApiError.badRequest("Resume exceeds maximum allowed size");
  }
  return trimmed;
};

module.exports = { validate, validateResumeText };
