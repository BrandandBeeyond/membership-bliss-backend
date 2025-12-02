require("dotenv").config();

const express = require("express");
const cloudinary = require("cloudinary");
const cookieparser = require("cookie-parser");
const cors = require("cors");

const {
  PORT,
  CLOUDINARY_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = require("./utils/config");
const connectTodb = require("./dbConnection");
const userRouter = require("./routes/user.route");
const {
  membershipCategoryRouter,
} = require("./routes/membershipcategory.route");
const { membershipPlanRouter } = require("./routes/membershipPlan.route");
const { offerRouter } = require("./routes/offer.route");

const app = express();
const port = PORT;

connectTodb();

cloudinary.config({
  cloud_name: CLOUDINARY_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieparser());
app.use(cors());

app.get("/", (req, res) => {
  res.send(`<center><h1>Server is Started...</h1></center>`);
});

app.use("/api/v1/user", userRouter);
app.use("/api/v1/category", membershipCategoryRouter);
app.use("/api/v1/categoryplan", membershipPlanRouter);
app.use("/api/v1/offers", offerRouter);

app.listen(port, () => {
  console.log(`server is running on http://localhost:${port}`);
});
