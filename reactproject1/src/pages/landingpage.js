// src/pages/LandingPage.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin, useGoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { login as reduxLogin } from "../Redux/authSlice";

const LandingPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { isLoggedIn } = useSelector((state) => state.auth);

  // ⭐ Google Popup Login (for Create Room button)
  const googlePopupLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await axios.post(
          `${process.env.REACT_APP_BACKEND || "http://localhost:5002"}/api/auth/google-auth`,
          { token: tokenResponse.credential || tokenResponse.access_token }
        );

        const { user, JwtToken } = res.data;

        // Save in Redux
        dispatch(
          reduxLogin({
            user,
            token: JwtToken,
          })
        );

        navigate("/home");
      } catch (err) {
        console.log("❌ Popup error:", err);
      }
    },
    onError: () => console.log("Google Popup Failed"),
  });

  // ⭐ Google Button Login Handler
  const handleSuccess = async (credentialResponse) => {
    const token = credentialResponse.credential;

    try {
      const res = await axios.post(
        `${process.env.REACT_APP_BACKEND || "http://localhost:5002"}/api/auth/google-auth`,
        { token }
      );

      const { user, JwtToken } = res.data;

      dispatch(
        reduxLogin({
          user,
          token: JwtToken,
        })
      );

      navigate("/home");
    } catch (err) {
      console.error("❌ Error:", err.response?.data || err.message);
    }
  };

  // ⭐ Create Room Button Behavior
  const handleCreateRoom = () => {
    if (isLoggedIn) {
      // already logged in → no popup needed
      return navigate("/home");
    }

    // not logged in → open Google popup
    googlePopupLogin();
  };

  return (
    <div className="landing-page">
      <nav className="navbar">
        <div className="navbar-logo">
          <img src="logo-dark.png" alt="Kódikos Logo" />
          <span>Kódikos</span>
        </div>

        <ul className="navbar-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#about">About</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>

        <div className="navbar-actions">
          {/* ⭐ Hide Google Button if logged in */}
          {!isLoggedIn && (
            <div className="google-btn">
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={() => console.log("Google Login Failed")}
              />
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero">
        <div className="hero-content">
          <h1>Kódikos</h1>
          <img src="logo-dark.png" alt="Kódikos Logo" className="hero-logo" />
          <p>
            The modern collaborative code editor where you can create, share,
            and build projects together in real-time.
          </p>

          {/* ⭐ Create Room Button */}
          <button className="btn-secondary" onClick={handleCreateRoom}>
            Create Room
          </button>
        </div>
      </header>

      {/* Features Section */}
      <section className="features" id="features">
        <h2>Why Kódikos?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <img src="/download.png" alt="Real-time" />
            <h3>Real-time Collaboration</h3>
            <p>
              Work live — every keystroke is instantly visible to everyone.
            </p>
          </div>
          <div className="feature-card">
            <img src="https://img.icons8.com/color/344/code-file.png" alt="Languages" />
            <h3>Multi-Language Support</h3>
            <p>Code in HTML, CSS, JS and more.</p>
          </div>
          <div className="feature-card">
            <img src="https://img.icons8.com/fluency/344/shield.png" alt="Secure" />
            <h3>Secure & Private</h3>
            <p>Temporary, protected rooms. Invite only your team.</p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="about" id="about">
        <h2>About Kódikos</h2>
        <p>
          Kódikos is built for real-time editing and teamwork. 
          Inspired by CodePen and VSCode.
        </p>
      </section>

      {/* CTA */}
      <section className="cta" id="create-room">
        <h2>Ready to Start?</h2>
        <p>Create your coding room today.</p>

        {/* ⭐ Same create room button logic */}
        <button className="btn-secondary" onClick={handleCreateRoom}>
          Create Room
        </button>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>© 2025 Kódikos. Built with ❤️ for developers.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
