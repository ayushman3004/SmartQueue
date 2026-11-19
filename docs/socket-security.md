# Socket room authorization

Clients send resource IDs, never room names. All join and leave handlers accept only 24-character hexadecimal MongoDB IDs, normalized to lowercase. Missing, malformed, object, array, and colon-containing IDs are rejected before room construction. A public `join:room` request cannot select the `:admin` namespace.

| Room | Access |
| --- | --- |
| `business:<id>` | Public queue subscriptions, including guests |
| `user:<id>` | The authenticated user only; automatically joined on connection |
| `business:<id>:admin` | An administrator, or the owner of that approved business; business must exist |
| `booking:<id>` | The booking's customer, an administrator, or the owner of its approved business; booking must exist |

JWTs are verified with HS256. Supplied invalid, expired, activation, deleted-user, or stale-version credentials fail the connection rather than silently becoming guest connections. Roles come from the current user record, never the token's role claim. Tokenless guest connections remain available for public updates.

Each private-room join revalidates the token, user token version, owner lifecycle, and resource permission. Connected sessions and existing private-room grants are checked every 30 seconds, so idle clients lose access after session revocation, role changes, business ownership changes, or approval withdrawal. This periodic check permits a revocation delay of up to 30 seconds, plus database latency. Failed session checks disconnect the socket and remove presence; lost resource permissions remove the corresponding room and business presence.

The regression tests use real local Socket.IO server/client connections with database stubs. They verify denied room membership and the absence of private message delivery, authorized access, malformed payload handling, and idle-session revocation.

Socket.IO connection middleware runs once per connection; the additional join and periodic checks are needed for ongoing authorization. See [Socket.IO middleware documentation](https://socket.io/docs/v4/middlewares/) and [room documentation](https://socket.io/docs/v4/rooms/).
