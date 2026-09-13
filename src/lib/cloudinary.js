import { v2 as cloudinary } from "cloudinary";
import { config } from "dotenv";

config();

// Support both CLOUDINARY_URL and individual env variables
// CLOUDINARY_URL format: cloudinary://<api_key>:<api_secret>@<cloud_name>
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Image uploads are optional — booking and messaging work without them.
export const isCloudinaryConfigured =
  Boolean(process.env.CLOUDINARY_URL) ||
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

export default cloudinary;
