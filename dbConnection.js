const mongoose = require("mongoose");
const { MONGO_URI } = require("./utils/config");


const connectTodb = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("connected to db");
  } catch (error) {
    console.error(error);
  }
};

module.exports = connectTodb;