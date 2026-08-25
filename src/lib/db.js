
import  mongoose  from "mongoose" ;
import dotenv from 'dotenv'
import dns from 'dns'
dotenv.config();

const currentServers = dns.getServers();

console.log(currentServers)

export const connectDB = async () => {
  try 
  {
    const conn = await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017');
    console.log(`MongoDB connected to the db: ${conn.connection.name}`);
  }
   catch (error) {
    console.log("MongoDB connection error:", error);
  }
};
