import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../model/usermodel.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googelAuth = async (req, res) => {
  try {
    const { token } = req.body;

    // Verify Google Token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { sub, name, email, picture } = payload;

    console.log(payload);

    let user = await User.findOne({ googleId: sub });

    if (!user) {
      user = new User({
        googleId: sub,
        name,
        email,
        picture
      });
      await user.save();
    }

    const jwtToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({ user, jwtToken });

  } catch (error) {
    console.log(error);
    res.status(401).json({ message: "Authentication failed" });
  }
};
