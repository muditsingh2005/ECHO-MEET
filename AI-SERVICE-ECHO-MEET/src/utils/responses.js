/**
 * Response Helper Utilities
 *
 * Ensures consistent, safe response formats across all endpoints.
 * Guarantees: never returns success:true with empty/null data silently.
 */

export const responses = {
  success: (data, message = "Success") => ({
    success: true,
    message,
    data,
  }),

  error: (message, errorCode, details = null) => ({
    success: false,
    message,
    errorCode,
    ...(details && { details }),
  }),

  created: (data, message = "Created") => ({
    success: true,
    message,
    data,
  }),

  noContent: () => ({
    success: true,
    message: "No content",
  }),

  validateDataPresence: (data, dataName = "data") => {
    if (!data) {
      throw new Error(
        `Response requires ${dataName} but received null/undefined`,
      );
    }

    if (typeof data === "object") {
      const keys = Object.keys(data);
      if (keys.length === 0) {
        throw new Error(`Response ${dataName} is empty object`);
      }

      const hasContent = keys.some((k) => {
        const val = data[k];
        return val !== null && val !== undefined && val !== "";
      });

      if (!hasContent) {
        throw new Error(`Response ${dataName} has no meaningful content`);
      }
    }

    return data;
  },
};

export default responses;
