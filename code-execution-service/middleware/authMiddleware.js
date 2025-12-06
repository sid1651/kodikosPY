/**
 * Authentication middleware for execution service
 * Only allows requests from the backend service using API key
 */

export const authenticateService = (req, res, next) => {
  // Get API key from header
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

  // Get expected API key from environment
  const expectedApiKey = process.env.EXECUTION_SERVICE_API_KEY;

  // Debug logging
  console.log(`🔐 Auth check - Received key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING'}, Expected: ${expectedApiKey ? expectedApiKey.substring(0, 10) + '...' : 'NOT SET'}`);

  // If no API key is configured, allow all requests (development mode)
  if (!expectedApiKey) {
    console.warn("⚠️  No EXECUTION_SERVICE_API_KEY set - allowing all requests (development mode)");
    return next();
  }

  // Check if API key matches
  if (!apiKey || apiKey !== expectedApiKey) {
    console.warn(`❌ Unauthorized request from ${req.ip} - Invalid or missing API key`);
    console.warn(`   Received: ${apiKey ? apiKey.substring(0, 20) : 'MISSING'}`);
    console.warn(`   Expected: ${expectedApiKey.substring(0, 20)}`);
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or missing API key. This service is only accessible by the backend."
    });
  }

  // API key is valid
  console.log("✅ API key validated successfully");
  next();
};

