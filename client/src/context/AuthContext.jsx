import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import api, { TokenStorage } from "../services/api";
import { disconnectSocket } from "../services/socket";

const AuthContext = createContext(null);

/** Extract OAuth tokens from URL params and clean the address bar. */
const extractTokensFromURL = () => {
  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get("accessToken");
  const refreshToken = params.get("refreshToken");

  if (accessToken) {
    TokenStorage.setTokens(accessToken, refreshToken);

    // Remove tokens from the URL without triggering a reload
    const cleanURL = window.location.pathname;
    window.history.replaceState({}, "", cleanURL);

    return true;
  }

  return false;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // If redirected from OAuth, extract tokens first
        extractTokensFromURL();

        // Only attempt auth check if we have a stored token
        const token = TokenStorage.getAccessToken();
        if (!token) {
          setUser(null);
          setIsAuthenticated(false);
          return;
        }

        const response = await api.get("/v1/auth/me");
        setUser(response.data.user);
        setIsAuthenticated(true);
      } catch {
        // Not authenticated or token expired
        TokenStorage.clearTokens();
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(() => {
    window.location.href = `${import.meta.env.VITE_API_BASE_URL}/v1/auth/google`;
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = TokenStorage.getRefreshToken();
      await api.post("/v1/auth/logout", { refreshToken });
    } catch (error) {
      console.error("[Auth] Logout API error:", error.message);
    } finally {
      disconnectSocket();
      TokenStorage.clearTokens();
      setUser(null);
      setIsAuthenticated(false);
      window.location.href = "/login";
    }
  }, []);

  const updateUser = useCallback((userData) => {
    setUser((prev) => ({ ...prev, ...userData }));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get("/v1/auth/me");
      setUser(response.data.user);
      setIsAuthenticated(true);
      return response.data.user;
    } catch {
      setUser(null);
      setIsAuthenticated(false);
      return null;
    }
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    updateUser,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
