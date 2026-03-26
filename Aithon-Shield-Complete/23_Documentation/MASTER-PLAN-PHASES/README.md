# Master plan — phased delivery

This folder tracks **all 41 features** from the GitHub + GitLab master plan, grouped into **phases**, with **per-feature documentation**, **Category 1 / 2** labeling, **testing steps**, and a **user verification gate** before the next feature ships.

## Workflow

1. Open [`00-PHASE-INDEX.md`](./00-PHASE-INDEX.md) for the ordered list of features by phase.  
2. Implement **one** feature.  
3. Create or update [`features/<FEATURE-ID>.md`](./features/) using [`TEMPLATE-FEATURE.md`](./TEMPLATE-FEATURE.md).  
4. Update [`features/_STATUS.md`](./features/_STATUS.md).  
5. **Wait for user verification** before starting the next feature.

**Commands:** The product owner does not run the terminal. The AI agent runs `npm run check`, `db:push`, tests, etc., via Cursor after you approve **Run** / network when prompted. Results belong in each feature doc under **Automated / agent testing performed**.

## Categories

| Label | Meaning |
|-------|---------|
| **Category 1** | Frontend / UI — visible in the browser |
| **Category 2** | Backend — API, DB, server jobs, integrations |
| **Both** | Split explicitly into UI vs backend bullets |

## Cursor rule

Enforcement and conventions: [`.cursor/rules/aithon-master-plan-delivery.mdc`](../../.cursor/rules/aithon-master-plan-delivery.mdc)

## Related

- Full feature inventory (Scenario 1): [`../MASTER-PLAN-41-FEATURES-GITHUB-GITLAB.md`](../MASTER-PLAN-41-FEATURES-GITHUB-GITLAB.md)  
- Deferred providers: [`../deferred-bitbucket-azure-devops/README.md`](../deferred-bitbucket-azure-devops/README.md)
