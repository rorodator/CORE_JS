---
name: core-js-application-service
description: Creates or refactors a consuming application's registered domain service so components express semantic intent without direct IO. Use for app-level $svc services, component AJAX removal, or application IO boundaries.
---

# CORE_JS — application service boundary

1. Read `.cursor/rules/core-js-io-boundaries.mdc`, `ai-instructions/services.md`, and `ai-instructions/layering.md`.
2. Inventory component IO, transport payload names, response conventions, and non-visual application operations for one coherent capability.
3. Keep the domain service in the **consuming app**, not CORE_JS. Register it in the app's `Core` subclass.
4. Design semantic operations (`list`, `addEntry`, `archive`), never `post(path, payload)` or an endpoint mirror.
5. Move endpoint paths, methods, backend parameter names, protocol flags, and technical response normalization into the service.
6. Preserve the app's current Observable/async model unless the capability itself requires shared state.
7. Leave DOM, rendering, modal/focus behavior, notifications, routing UI, and local busy/loading state in components.
8. Do not duplicate domain calculations whose source of truth already lives elsewhere.
9. Verify components contain no direct IO for the migrated capability and run behavioral tests.
10. Add a small static boundary check only when it is robust and can be scoped without blocking known legacy migrations.
