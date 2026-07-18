# Feature Documentation Backend Explained Rule

Use this rule together with `feature_documentation_guide.md`.

The document must still follow the structure and requirements defined in `feature_documentation_guide.md`.

Add these requirements on top of that guide:

- Write the document for readers who do not understand the current backend source code.
- Do not rely on controller names, service names, method names, DTO names, or entity names alone to explain the feature.
- Whenever you mention a backend function, class, DTO, or API, add a short plain-language explanation of what it does.
- In `Sequence Text`, write a numbered step-by-step sequence showing how the request flows through layers, what business logic or validation happens, and what the result is. Format each step as: `[Which component] [does what action]. [What is the result or outcome]`. Never lead with function names. Show data flow, side effects, and results. Example: "1. Client sends request to Unit Controller. 2. Unit Controller calls Unit Service. 3. Unit Service loads the building and validates it is ACTIVE. 4. Unit Service checks the requested floor does not exceed the building floor count. 5. Unit Service counts existing units on that floor and rejects if count ≥ 5. 6. Unit Service creates the unit record with ACTIVE status and returns it. 7. Unit Controller returns the created unit to the client." Avoid: "UnitController.create() calls UnitService.create() which loads the building".
- In `API Contracts`, do not only refer to request DTO names or response DTO names. Show the concrete request shape with actual field names whenever possible so frontend developers can map data correctly.
- Do not use backend function names, service names, or method names as a substitute for explaining what happens. Readers should understand the business logic without needing to know Java method signatures. If you mention a function name, always add "which does X" or "that handles Y".
- Do not remove or replace backend field names with business-only wording. Keep the real field names and add short explanations for important fields when needed.
- In `API Contracts`, explain important fields, validations, path params, query params, and key response data in addition to showing the field names.
- If the backend auto-generates, derives, or ignores some client-sent fields, state that clearly in the API contract.
- If a business capability is only partially implemented in the current backend, say that explicitly instead of implying full support.
