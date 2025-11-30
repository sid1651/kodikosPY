import { createSlice } from "@reduxjs/toolkit";

// Safe JSON loader (prevents crash if JSON is broken)
const loadUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    return null;
  }
};

const initialState = {
  user: loadUser(),
  token: localStorage.getItem("token") || null,
  isLoggedIn: !!localStorage.getItem("token"), // auto-set on refresh
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isLoggedIn = true;

      // Persist
      localStorage.setItem("user", JSON.stringify(state.user));
      localStorage.setItem("token", state.token);
    },

    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isLoggedIn = false;

      localStorage.removeItem("user");
      localStorage.removeItem("token");
    },

    // For loading on app start
    checkAuth: (state) => {
      const token = localStorage.getItem("token");
      state.isLoggedIn = !!token;
      state.token = token;
      state.user = loadUser();
    },
  },
});

export const { login, logout, checkAuth } = authSlice.actions;
export default authSlice.reducer;
