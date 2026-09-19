import axios from "./axios";

export const getBalance = () => axios.get("/wallet/balance");
export const addMoney = (amount) => axios.post("/wallet/add", { amount });
export const deductMoney = (amount) => axios.post("/wallet/deduct", { amount });
export const createDepositOrder = (amount) => axios.post("/wallet/order", { amount });
export const verifyDeposit = (data) => axios.post("/wallet/verify", data);
