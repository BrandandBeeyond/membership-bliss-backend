const { AdminLogin } = require("../controllers/admin.controller");

const adminRouter = require("express").Router();

adminRouter.post("/login", AdminLogin);
