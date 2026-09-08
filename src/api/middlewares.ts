import { authenticate, defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import { StoreConvertGuestToCustomer } from "./store/customers/convert-guest/validators"

export default defineMiddlewares({
  routes: [
    {
      method: ["POST"],
      matcher: "/store/customers/convert-guest",
      middlewares: [
        // Same middleware, same options, as the native POST
        // /store/customers route (node_modules/@medusajs/medusa/dist/api/
        // store/customers/middlewares.js) — allowUnregistered lets a
        // request through on a *registration* JWT (auth_identity_id set,
        // actor_id not yet), which is exactly the token
        // sdk.auth.register()/sdk.auth.login() hands the storefront.
        authenticate("customer", ["session", "bearer"], {
          allowUnregistered: true,
        }),
        validateAndTransformBody(StoreConvertGuestToCustomer),
      ],
    },
  ],
})
