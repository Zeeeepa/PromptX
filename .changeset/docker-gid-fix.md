---
"@promptx/mcp-server": patch
---

fix(docker): use built-in node user to fix GID conflict

- Fixed v1.28.1 Docker build failure caused by GID 1000 conflict
- Use node:20-alpine's built-in node user instead of creating new app user
- Maintains security (non-root execution) while simplifying Dockerfile
