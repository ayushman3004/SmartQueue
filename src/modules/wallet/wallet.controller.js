import asyncHandler from "../../../utils/asyncHandler.js";
import ApiError from "../../../utils/ApiError.js";

export const getBalance = asyncHandler(async () => {
  throw new ApiError(410, "The customer wallet system has been retired in favor of direct online and counter payments.");
});

export const addMoney = asyncHandler(async () => {
  throw new ApiError(410, "The customer wallet system has been retired in favor of direct online and counter payments.");
});

export const deductMoney = asyncHandler(async () => {
  throw new ApiError(410, "The customer wallet system has been retired in favor of direct online and counter payments.");
});

export const createDepositOrder = asyncHandler(async () => {
  throw new ApiError(410, "The customer wallet system has been retired in favor of direct online and counter payments.");
});

export const verifyDeposit = asyncHandler(async () => {
  throw new ApiError(410, "The customer wallet system has been retired in favor of direct online and counter payments.");
});
