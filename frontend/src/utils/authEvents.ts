/**
 * A simple event bridge to allow non-React code (like axios interceptors)
 * to trigger auth actions like logout without circular dependency issues.
 */
type LogoutCallback = () => void;

let logoutCallback: LogoutCallback | null = null;

export const authEvents = {
  /**
   * Register the logout function from AuthContext.
   * Called once when the AuthProvider mounts.
   */
  setLogoutHandler: (fn: LogoutCallback) => {
    logoutCallback = fn;
  },

  /**
   * Trigger logout from anywhere (e.g., axios 401 interceptor).
   */
  triggerLogout: () => {
    if (logoutCallback) {
      logoutCallback();
    }
  },
};
