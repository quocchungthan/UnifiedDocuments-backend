FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG PROJECT_FILE
ARG INCLUDE_FRONTEND=false
WORKDIR /source
COPY . .
RUN dotnet restore "$PROJECT_FILE"
RUN dotnet publish "$PROJECT_FILE" --configuration Release --no-restore --output /app/publish
RUN if [ "$INCLUDE_FRONTEND" = "true" ]; then mkdir -p /app/publish/www && cp -a /source/frontend-bundle/. /app/publish/www/; fi

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && groupadd --system app \
    && useradd --system --gid app --home-dir /app app \
    && mkdir -p /data \
    && chown app:app /data \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/publish/ ./
RUN chown -R app:app /app
USER app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet"]