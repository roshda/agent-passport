import { httpRouter } from "convex/server";
import { verifyPassport } from "./passports";

const http = httpRouter();

http.route({
  path: "/verifyPassport",
  method: "POST",
  handler: verifyPassport,
});

http.route({
  path: "/verifyPassport",
  method: "OPTIONS",
  handler: verifyPassport,
});

export default http;
