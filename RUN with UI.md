# Download the UI and run

Requires the .NET 10 SDK and the
[three dealership services](./DealershipSystems/README.md#run).
Node.js and an Angular server are not needed for the downloaded UI.

## Install the bundle

The UI lives on this repository's
[`feat/ProjectLoop-frontend` branch](https://github.com/quocchungthan/UnifiedDocuments-backend/tree/feat/ProjectLoop-frontend).

1. Open [UI workflow runs](https://github.com/quocchungthan/UnifiedDocuments-backend/actions/workflows/vehicle-documents.yml?query=branch%3Afeat%2FProjectLoop-frontend)
   and select a successful push run on that branch.
2. Sign in to GitHub and download **vehicle-documents-ui** under **Artifacts**.
   Artifacts are retained for 30 days; use a newer successful run if expired.
3. Extract the ZIP contents into `src\UnifiedDocuments\www` in your backend
   checkout. `index.html`, JavaScript, CSS and assets must sit directly inside
   `www`, without an extra `browser` or artifact-name folder.
   Replace the previous bundle contents when updating. `www` is gitignored.

## Start the backend

From the backend repository root:

```text
cd src\UnifiedDocuments
dotnet ef database update --project ..\UnifiedDocuments.Data
dotnet run --no-launch-profile --urls http://localhost:5268
```

If `dotnet ef` is unavailable, install it once:
`dotnet tool install --global dotnet-ef --version 10.0.14`.

Open <http://localhost:5268/>. The backend serves the UI and API on the same
origin, including document view/download and unlinked-document paging.
If `/` returns 404, check `www\index.html` and restart after installing the bundle.

For frontend development only, run `npm start -- --app=car-documents` from
`SingleUI` on the frontend branch. Its dev proxy forwards `/vehicles/**` and
`/documents/**` to the backend on port 5268; restart Angular after proxy changes.
