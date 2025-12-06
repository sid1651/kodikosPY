import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import axios from "axios";
import User from "../model/usermodel.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googelAuth = async (req, res) => {
  try {
    console.log("🔐 Google Auth Request Received");
    const { token } = req.body;

    if (!token) {
      console.error("❌ No token provided in request");
      return res.status(400).json({ message: "Token is required" });
    }

    console.log("🔍 Verifying Google token...");
    console.log(`   Token length: ${token.length} characters`);

    let payload;
    let sub, name, email, picture;

    // Try to verify as ID token first (from GoogleLogin component)
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      payload = ticket.getPayload();
      sub = payload.sub;
      name = payload.name;
      email = payload.email;
      picture = payload.picture;
      console.log("✅ Verified as ID token");
    } catch (idTokenError) {
      // If ID token verification fails, try as access token (from useGoogleLogin)
      console.log("⚠️ ID token verification failed, trying as access token...");
      try {
        // Fetch user info using access token
        const userInfoResponse = await axios.get(
          `https://www.googleapis.com/oauth2/v2/userinfo`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        
        sub = userInfoResponse.data.id;
        name = userInfoResponse.data.name;
        email = userInfoResponse.data.email;
        picture = userInfoResponse.data.picture;
        console.log("✅ Verified as access token");
      } catch (accessTokenError) {
        console.error("❌ Both ID token and access token verification failed");
        throw new Error("Invalid token: Not a valid ID token or access token");
      }
    }

    console.log("✅ Token verified successfully");
    console.log(`   User: ${name} (${email})`);

    let user = await User.findOne({ googleId: sub });

    if (!user) {
      console.log("📝 Creating new user...");
      user = new User({
        googleId: sub,
        name,
        email,
        picture
      });
      await user.save();
      console.log("✅ New user created:", user._id);
    } else {
      console.log("👤 Existing user found:", user._id);
    }

    const jwtToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log("✅ Authentication successful, sending response");
    res.status(200).json({ user, JwtToken: jwtToken }); // Match main branch format

  } catch (error) {
    console.error("❌ Authentication Error:", error.message);
    console.error("   Stack:", error.stack);
    res.status(401).json({ 
      message: "Authentication failed",
      error: error.message 
    });
  }
};
