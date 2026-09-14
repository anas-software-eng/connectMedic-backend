import Doctor from "../models/Doctors.js"




export const createDocProfile = async (req, res) => {
  try {
     const userId = req.user._id
  
    const doc = await Doctor.create(  {
        ...req.body,
      userId,
    }).populate("userId");

    res.status(201).json({
      msg: "Doctor profile created successfully",
      doctor: doc,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      msg: "Failed to create doctor profile",
    });
  }
};
export const getDocProfileOverview = async (req, res) => {
  try {
     const userId = req.user._id
  
    const doc = await Doctor.findById(  {
      userId})

    res.status(201).json({
      msg: "Doctor profile created successfully",
      doctor: doc,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      msg: "Failed to create doctor profile",
    });
  }
};