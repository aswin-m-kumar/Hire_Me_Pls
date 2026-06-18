const { ZodError } = require("zod");

async function withRetry(fn) {
  let attempt = 1;
  const maxAttempts = 3;

  while (true) {
    try {
      return await fn(attempt);
    } catch (error) {
      const isRetryable =
        error?.status === 429 ||
        error?.status === 503 ||
        error instanceof ZodError;

      if (!isRetryable || attempt >= maxAttempts) {
        throw error;
      }

      const delay = attempt === 1 ? 1000 : 2000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }
}

module.exports = withRetry;
