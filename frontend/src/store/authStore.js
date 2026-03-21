import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('userInfo')) || null,
  isLoading: false,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/api/auth/login', { username, password });
      set({ user: data, isLoading: false });
      localStorage.setItem('userInfo', JSON.stringify(data));
      return data;
    } catch (error) {
      set({ 
        error: error.response?.data?.message || error.message, 
        isLoading: false 
      });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('userInfo');
    set({ user: null });
  },
}));

export default useAuthStore;
