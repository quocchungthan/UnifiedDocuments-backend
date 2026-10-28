ARG AFFINE_BASE=ghcr.io/toeverything/affine:stable
FROM ${AFFINE_BASE}
COPY dist-ui/affine.css /app/static/single-ui.css
COPY deployment/local/note/install-style.mjs /tmp/install-style.mjs
RUN node /tmp/install-style.mjs
