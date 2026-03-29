import axios from "./axios";

export const getBalance = () => axios.get("/wallet/balance");
export const addMoney = (amount) => axios.post("/wallet/add", { amount });
export const deductMoney = (amount) => axios.post("/wallet/deduct", { amount });
