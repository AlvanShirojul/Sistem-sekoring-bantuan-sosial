/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext, useState, useEffect } from 'react';
import apiFetch from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if the user is authenticated on initial load
    const token = localStorage.getItem('token');
    if (token) {
      apiFetch('/api/check-auth', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.isAuthenticated) {
            setUser(data.user);
          } else {
            localStorage.removeItem('token');
          }
          setLoading(false);
        })
        .catch(() => {
          localStorage.removeItem('token');
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const response = await apiFetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (response.ok) {
      localStorage.setItem('token', data.token);
      setUser({ username });
      return data;
    }
    throw new Error(data.error || 'Login failed');
  };

  const logout = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      await apiFetch('/api/logout', { 
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    }
    localStorage.removeItem('token');
    setUser(null);
  };

  const value = { user, login, logout, isAuthenticated: !!user };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><div>Loading...</div></div>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  return useContext(AuthContext);
};
