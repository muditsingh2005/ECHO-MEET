import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Track if we're currently refreshing to prevent multiple refresh calls
let isRefreshing = false;
let failedQueue = [];

const AUTH_CHECK_ENDPOINTS = ["/v1/auth/me", "/v1/auth/refresh"];

const processQueue = (error) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve();
    }
  });
  failedQueue = [];
};

const redirectToLogin = () => {
  // Prevent redirect loops
  if (window.location.pathname === "/login") {
    return;
  }

  // Clear any local storage auth data if used
  localStorage.removeItem("user");
  sessionStorage.removeItem("user");

  window.location.href = "/login";
};

const shouldSkipRefresh = (url) => {
  return AUTH_CHECK_ENDPOINTS.some((endpoint) => url?.includes(endpoint));
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only handle 401 errors
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    if (shouldSkipRefresh(originalRequest.url)) {
      return Promise.reject(error);
    }

    // Don't retry if this is already a retry
    if (originalRequest._retry) {
      redirectToLogin();
      return Promise.reject(error);
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(() => api(originalRequest))
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Attempt to refresh the token
      await api.post("/v1/auth/refresh");

      // Token refreshed successfully, process queued requests
      processQueue(null);

      // Retry the original request
      return api(originalRequest);
    } catch (refreshError) {
      // Refresh failed, reject all queued requests
      processQueue(refreshError);

      // Redirect to login
      redirectToLogin();

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

if (import.meta.env.DEV) {
  api.interceptors.request.use(
    (config) => {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    },
    (error) => Promise.reject(error),
  );
}

export default api;
