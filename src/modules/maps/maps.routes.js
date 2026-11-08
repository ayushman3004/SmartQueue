import { Router } from "express";
import * as mapsController from "./maps.controller.js";

const router = Router();

router.get("/autocomplete", mapsController.autocomplete);
router.get("/geocode", mapsController.geocode);
router.get("/reverse-geocode", mapsController.reverseGeocode);

export default router;

