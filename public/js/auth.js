// Authentication module
class AuthManager {
  constructor() {
    this.isAuthenticated = false;
    this.user = null;
    this.token = null;
  }

  async checkAuth() {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        this.user = data.user;
        this.isAuthenticated = true;
        return true;
      }

      this.isAuthenticated = false;
      this.user = null;
      return false;
    } catch (error) {
      console.error('Auth check failed:', error);
      this.isAuthenticated = false;
      return false;
    }
  }

  async login(email, password) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        this.user = data.user;
        this.isAuthenticated = true;
        return { success: true, data };
      }

      const error = await response.json();
      return { success: false, error: error.error || 'Login failed' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async signup(email, password, fullName) {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, fullName }),
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        this.user = data.user;
        this.isAuthenticated = true;
        return { success: true, data };
      }

      const error = await response.json();
      return { success: false, error: error.error || 'Signup failed' };
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

      this.isAuthenticated = false;
      this.user = null;
      window.location.reload();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  getUser() {
    return this.user;
  }

  isLoggedIn() {
    return this.isAuthenticated;
  }
}

// Initialize global auth instance
window.auth = new AuthManager();