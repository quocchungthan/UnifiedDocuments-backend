# Dealership Systems (external service mocks)

## Circumstance

Three systems owned by other teams store vehicle documents, such as PDF, HTML,
CSV, TXT, JSON, XML, SVG, EML and MD files. **None of them is organized by VIN.**
Each system groups documents by its own business key, uses a different API shape,
and can only list everything page by page. The VIN appears only inside document
content, and some documents do not contain one. ProjectLoop must find every
document for a VIN across all three systems.

| System | Grouped by | List API | Paging | JSON |
|---|---|---|---|---|
| Sales | Deal (`DEAL-1001/contracts/...`) | `GET /api/v1/documents` | `page` / `pageSize` | camelCase |
| Service | Document kind (`repair-orders/...`) | `GET /service-api/v2/documents` | `offset` / `limit` | snake_case |
| Warranty | Claim, via `manifest.json` | `POST /warranty/v1/claims/documents/search` | opaque `PageToken` | PascalCase |

> `Resources/` names only the Sales and Service systems. Warranty is an extra
> source added for testing.

## Run

Install the .NET 10 SDK, then run each service in a separate terminal:

```bash
cd DealershipSystems
dotnet run --project SalesSystem     # http://localhost:5101/swagger
dotnet run --project ServiceSystem   # http://localhost:5102/swagger
dotnet run --project WarrantySystem  # http://localhost:5103/swagger
```

Use each service's **Swagger UI** to inspect its OpenAPI contract and try its
endpoints. Select **Authorize** and enter the mock credentials listed below.

## Security

| System | Authentication | Mock credentials (`appsettings.json`) | Rate limit |
|---|---|---|---|
| Sales | OAuth2 client credentials, token from `POST /connect/token` | `projectloop` / `sales-mock-secret` | 60/min |
| Service | OAuth2 client credentials, token from `POST /oauth2/token` | `projectloop` / `service-mock-secret` | 100/min |
| Warranty | HTTP Basic authentication | `projectloop` / `warranty-mock-password` | 30/min |

- Each token is valid only for the service that issued it, and tokens stop
  working when that service restarts.
- CORS allows browser requests only from `localhost`, `127.0.0.1` and `::1` origins.
- Rate limits apply per client or user, or per IP address before authentication.
  Requests over the limit receive `429` with a `Retry-After` header.
- These credentials are for local mocks only. Override them with environment
  variables, such as `Auth__Clients__0__ClientSecret=...`.

## Add documents

Restart the service after adding files.

- **Sales:** add files under `SalesSystem/Documents/{deal}/{category}/`.
- **Service:** add files under `ServiceSystem/Documents/{kind}/`. Any file name is allowed.
- **Warranty:** add files under `WarrantySystem/Documents/`, then add each file to
  `manifest.json`. The Warranty API ignores files missing from the manifest.
