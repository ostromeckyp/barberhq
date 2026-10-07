import { initializeApp } from "firebase-admin/app";
import { stockCommand } from "./stock/commands.js";
initializeApp();
export const submitRequest = stockCommand("SUBMIT");
export const approveRequest = stockCommand("APPROVE");
export const rejectRequest = stockCommand("REJECT");
export const dispatchTransfer = stockCommand("DISPATCH");
export const receiveTransfer = stockCommand("RECEIVE");
