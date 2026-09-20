# Doctor dashboard API

All routes use the `/api/v1` prefix and require `x-doctor-token`. Responses use the HELIOS success/error envelope. The server ignores unknown input fields through bounded Zod schemas and never accepts browser-provided role or doctor identity.

| Method  | Route                                       | Purpose                                             |
| ------- | ------------------------------------------- | --------------------------------------------------- |
| `POST`  | `/doctor-sessions`                          | Synthetic demo sign-in; returns signed doctor proof |
| `GET`   | `/doctor/dashboard`                         | Metrics, notifications and paginated queue          |
| `GET`   | `/doctor/patients/:patientId/workspace`     | Aggregated patient workspace                        |
| `GET`   | `/doctor/patients/:patientId/notes`         | Doctor-only notes                                   |
| `POST`  | `/doctor/patients/:patientId/notes`         | Add attributed note                                 |
| `PATCH` | `/doctor/patients/:patientId/notes/:noteId` | Author/admin edit                                   |
| `POST`  | `/doctor/visits/:visitId/status`            | Validated consultation transition                   |

Dashboard query parameters are `search`, `status`, `sort=time|priority|name`, `direction=asc|desc`, `page` and `limit` (maximum 50). Workspace accepts an optional `visitId`, but the repository always queries it together with the path patient ID.

Existing Phase 10 verification routes provide verify, correct, reject, uncertain and explicit conflict-resolution actions. Existing document verification routes provide evidence-linked review. Phase 13 does not create competing clinical logic.
