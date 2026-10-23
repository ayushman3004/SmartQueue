// Deprecated: The customer wallet system has been retired in favor of direct online and counter payments.
export const getBalance = () => Promise.resolve({ data: { data: { balance: 0 } } });
export const addMoney = () => Promise.reject(new Error("Wallet system has been retired"));
export const deductMoney = () => Promise.reject(new Error("Wallet system has been retired"));
export const createDepositOrder = () => Promise.reject(new Error("Wallet system has been retired"));
export const verifyDeposit = () => Promise.reject(new Error("Wallet system has been retired"));
