const { createUpdates, getAllUpdates } = require("../controllers/update.controller");

const updatesRouter = require("express").Router();

updatesRouter.post("/addupdate", createUpdates);
updatesRouter.get("/getall", getAllUpdates);

module.exports = { updatesRouter };
