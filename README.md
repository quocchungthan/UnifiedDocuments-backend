# Unified Document Viewer

The three external services are mocked in `DealershipSystems/`. With the .NET 10. See [DealershipSystems/README.md](DealershipSystems/README.md#run) for details.

Then follow [Download the UI and run](./RUN%20with%20UI.md) to install the UI bundle and
start the application.

## Development

Requires the .NET 10 SDK. From the repository root:

```bash
dotnet build src/UnifiedDocuments/UnifiedDocuments.csproj
dotnet test src/UnifiedDocuments.Sync.Tests/UnifiedDocuments.Sync.Tests.csproj
```

See the [system design](Prod/02-system-design.md) and the
[dealership mock run instructions](DealershipSystems/README.md#run).

## AI Collaboration Narrative

GenAI assisted with design exploration and implementation. Its suggestions were
checked against the supplied requirements and mock API contracts, then refined
and verified with builds and tests; final decisions and quality remain the
author's responsibility.

## Run the complete stack

GitHub Actions builds and publishes the four images to GHCR on pushes to `main`.
The backend image includes the newest successful `vehicle-documents-ui`
artifact from `feat/ProjectLoop-frontend`. Configure the `GH_PAT` repository
Actions secret with permission to read that repository's workflow artifacts;
the token is used only by the workflow and is not included in an image.

Set `.env` from `.env.example`, then run `docker compose pull` followed by
`docker compose up -d`. Compose only pulls published images. To use an immutable
pipeline build, set `IMAGE_TAG` to its `sha-<commit>` tag in `.env`.

If the GHCR packages are private, authenticate Docker to `ghcr.io` with a token
that has `read:packages` before pulling.

In my machines I always have the variable environment named GH_PAT so I would do it like this:
```bash
cd UnifiedDocuments-backend/
echo $GH_PAT | docker login ghcr.io -u quocchungthan --password-stdin
docker compose pull
docker compose up -d
```

## Goal

Vehicle-related documents are currently distributed across three services within
the organization. The operations team needs a single application to find all
documents associated with a Vehicle Identification Number (VIN), reducing the
time spent searching across systems and helping the team support customers
without overlooking relevant information.

## Mission

**Hypothesis:** Unifying VIN-based document retrieval across the three services
will help the operations team find all relevant documents faster than searching
each service separately.

**Technical artifact:** A reusable document-integration package for the existing
car-knowledge application. It will accept a VIN, retrieve related documents from
the three services, and expose a unified result through a consistent interface.

**Validation:** Compare unified retrieval with separate searches using the same
VINs. Measure search time and document coverage against the known documents in
the mock systems, and verify that the existing car-knowledge application can
consume the package's results.
