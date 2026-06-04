import apiClient from './apiClient';

export const login = async (email?: string, password?: string) => {
  const formData = new URLSearchParams();
  if (email) formData.append('username', email);
  if (password) formData.append('password', password);

  const response = await apiClient.post(`/auth/login`, formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (response.data.access_token) {
    localStorage.setItem('token', response.data.access_token);
  }
  
  if (response.data.user) {
    localStorage.setItem('user', JSON.stringify(response.data.user));
  }

  return response.data;
};

export const getUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

export const logout = async () => {
  try {
    await apiClient.post(`/auth/logout`, {});
  } catch (err) {
    console.error("Logout backend failed", err);
  }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getToken = () => {
  return localStorage.getItem('token');
};
