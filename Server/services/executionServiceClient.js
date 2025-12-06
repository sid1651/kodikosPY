import axios from "axios";

/**
 * HTTP client for communicating with the code execution service
 * Handles all code execution requests to the separate microservice
 */

// Base URL for execution service
const EXECUTION_SERVICE_URL = process.env.EXECUTION_SERVICE_URL || "http://localhost:5001";

/**
 * Execute Python code via execution service
 * @param {string} code - Python code to execute
 * @returns {Promise<{output: string, images: Array}>}
 */
export const executePythonCode = async (code) => {
  try {
    const response = await axios.post(`${EXECUTION_SERVICE_URL}/execute/python`, {
      code,
    }, {
      timeout: 10000, // 10 second timeout
    });

    return response.data;
  } catch (error) {
    console.error("Execution service error:", error.message);
    
    // Handle different error types
    if (error.response) {
      // Service returned an error response
      throw new Error(error.response.data.error || "Execution service error");
    } else if (error.request) {
      // Request was made but no response received
      throw new Error("Execution service is not available");
    } else {
      // Something else happened
      throw new Error(error.message || "Unknown error");
    }
  }
};

/**
 * Execute C++ code via execution service
 * @param {string} code - C++ code to execute
 * @param {string} input - Optional input for the program
 * @returns {Promise<{output: string}>}
 */
export const executeCppCode = async (code, input) => {
  try {
    const response = await axios.post(`${EXECUTION_SERVICE_URL}/execute/cpp`, {
      code,
      input: input || "",
    }, {
      timeout: 10000, // 10 second timeout
    });

    return response.data;
  } catch (error) {
    console.error("Execution service error:", error.message);
    
    // Handle different error types
    if (error.response) {
      // Service returned an error response
      throw new Error(error.response.data.error || "Execution service error");
    } else if (error.request) {
      // Request was made but no response received
      throw new Error("Execution service is not available");
    } else {
      // Something else happened
      throw new Error(error.message || "Unknown error");
    }
  }
};

