import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import api from "../services/api";
import { disconnectSocket } from "../services/socket";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await api.get("/v1/auth/me");
        setUser(response.data.user);
        setIsAuthenticated(true);
      } catch (error) {
        // Not authenticated or token expired
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
      await api.post("/v1/auth/logout");
    } catch (error) {
      // Continue with logout even if API fails
      console.error("[Auth] Logout API error:", error.message);
    } finally {
      // Always cleanup regardless of API response
      disconnectSocket();
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
    } catch (error) {
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
