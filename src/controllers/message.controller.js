import User from "../models/user.model.js";
import Message from "../models/message.model.js";

import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl;
    if (image) {
      // Upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image, {
        // Uncomment the line below and create an unsigned upload preset in Cloudinary
        // if your API key doesn't have upload permissions
        // upload_preset: "connectmedic-unsigned",
      });
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    await newMessage.save();

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    // Cloudinary rejects with a plain object, not an Error, so `${error}` prints
    // [object Object]. Most Cloudinary failures carry the real reason in
    // error.error.message. The exception is UnexpectedResponse (e.g. the 403 for
    // an API key lacking the "create" action), where the SDK drops the response
    // body and only the generic "unexpected status code" survives.
    const cloudinaryDetail = error?.error?.message;
    console.log(
      "Error in sendMessage controller ---",
      cloudinaryDetail || error?.message || error
    );
    if (error?.http_code) {
      return res.status(502).json({
        error: `Image upload failed: ${cloudinaryDetail || error.message}`,
      });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};
