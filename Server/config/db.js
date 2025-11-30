import mongoose from 'mongoose';

const connectDb = async () => {
  try {
    mongoose.connection.on("connected", () =>
      console.log("✅ MongoDB Connected")
    );

    mongoose.connection.on("error", (err) =>
      console.log("❌ MongoDB Connection Error:", err)
    );

    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "Kodikos",   // ❗ Use your actual project DB
      
    });

  } catch (error) {
    console.log("❌ DB Connection Failed:", error);
  }
};

export default connectDb;
