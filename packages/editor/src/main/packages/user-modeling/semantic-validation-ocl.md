# User Model Semantic Validation (OCL)

This document describes the semantic OCL constraints added to `usermetamodel_buml_short.json`.

The goal is to move beyond purely syntactic checks with lightweight domain rules that are easy to understand and maintain.

## Added Constraints

1. `context Personal_Information inv age_range: self.age >= 0 and self.age <= 120`
- Rationale: prevents unrealistic ages and catches common input mistakes.

2. `context Skill inv name_not_empty: self.name <> ''`
- Rationale: prevents unnamed skills.

3. `context Education inv required_degree_fields: self.degreeName <> '' and self.providedBy <> ''`
- Rationale: avoids incomplete education records by requiring degree title and institution.

4. `context Disability inv description_not_empty: self.description <> ''`
- Rationale: ensures disability entries include meaningful explanatory text.

## Notes

- These are intentionally simple first-step semantic constraints.
- They can be refined later (for example, stricter code-format checks or score ranges if `Skill.score` is changed to a numeric type).
- The constraints are stored as `ClassOCLConstraint` elements directly in the model JSON.
