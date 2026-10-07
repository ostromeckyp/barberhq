import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDataConnect } from "firebase-admin/data-connect";
import { connectorConfig } from "@barberhq/server";
import type { StockAction } from "../../../shared/contracts/stock.js";
import { StockRepository } from "./repository.js";
import { parseAction } from "./schemas.js";
import { StockError } from "./errors.js";

export function stockCommand(type: StockAction["type"]) {
  return onCall(
    {
      region: "europe-west1",
      enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
      maxInstances: 5,
    },
    async (request) => {
      if (!request.auth)
        throw new HttpsError("unauthenticated", "Sign in to continue.");
      try {
        const action = parseAction(type, request.data);
        return await new StockRepository(
          getDataConnect(connectorConfig),
        ).execute(request.auth.uid, action);
      } catch (error) {
        if (error instanceof StockError) {
          const code =
            error.code === "FORBIDDEN"
              ? "permission-denied"
              : error.code === "VALIDATION_ERROR"
                ? "invalid-argument"
                : "failed-precondition";
          throw new HttpsError(code, error.message, {
            code: error.code,
            ...(error.conflicts ? { conflicts: error.conflicts } : {}),
          });
        }
        // Do not promise failure: SQL may have committed before its response was lost.
        throw new HttpsError(
          "unavailable",
          "Outcome unknown. Retry with the same action key.",
        );
      }
    },
  );
}
