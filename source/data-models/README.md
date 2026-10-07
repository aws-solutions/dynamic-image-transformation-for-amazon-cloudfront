# data-models (v8 shared schemas)

[Zod](https://zod.dev/) schemas and TypeScript types for the three v8 configuration entities: origins, mappings, and transformation policies. They are the single definition of what a valid entity and a valid transformation look like. The admin UI, the management API, and the container all import them, so a change here changes validation in all three.

## Layout

| File | What it defines |
|------|-----------------|
| `origin.ts` | `Origin`: a domain, optional path, and headers the container sends when it fetches from that origin |
| `mappings.ts` | `Mapping`: a host header pattern or a path pattern (exactly one) that selects an origin, and optionally a transformation policy |
| `transformation-policy.ts` | `TransformationPolicy`, plus `transformationSchemas`, `outputSchemas`, and `fallbackSchemas` |
| `pagination.ts` | Paginated list response types for the management API |
| `index.ts` | The public exports. Consumers import from here |

## Schema pattern

Each entity file follows the same shape:

- An entity schema (`OriginSchema`, `MappingSchema`, `TransformationPolicySchema`) for a stored item, including server-set fields such as IDs and timestamps. These schemas are internal; consumers call the exported `validate*` functions.
- A Create schema without the server-set fields, and an Update schema where every field is optional but at least one is required.
- Exported types made with `z.infer`, and `validate*` functions that call `safeParse` and return `{ success, data }` or `{ success, error }` instead of throwing.

`transformation-policy.ts` also exports the value schemas the policy is built from:

- `transformationSchemas`: one schema per transformation (`resize`, `blur`, `smartCrop`, `watermark`, and so on). The policy's `transformations` array is a discriminated union over the same keys, so a transformation in a policy and the same transformation in a URL are validated by the same schema.
- `outputSchemas` and `fallbackSchemas`: the policy's `outputs` (`quality`, `format`, `autosize`) and the values used when client hints are missing.

## Who validates what

| Consumer | Imports via | Validates |
|----------|-------------|-----------|
| [management-lambda](../management-lambda/README.md) | relative path `../../data-models` | Create and update requests, before anything is written to the config table (`services/*-service.ts`) |
| [container](../container/README.md) | workspace package `@dit/data-models` | Each URL transformation parameter at request time, against its `transformationSchemas` entry (`transformation-extractor.ts`). Invalid parameters are logged and dropped, not rejected |
| [admin-ui](../admin-ui/README.md) | Vite alias `@data-models` (`vite.config.ts`) | Form input before it is sent (`utils/transformationValidation.ts`, `TransformationConfigModal.tsx`) |

The container is an npm workspace member, so `@dit/data-models` resolves through `source/node_modules`. The container's Docker image copies this package in, which is why the image is built from `source/`.

## Add a transformation parameter

To add a new transformation, or a new field on an existing one, change these places in order:

1. **Schema (this package).** Add or edit the entry in `transformationSchemas`. For a new transformation, also add a `z.strictObject({ transformation: z.literal("<name>"), value: transformationSchemas.<name>, condition: conditionSchema.optional() })` arm to the `transformations` union in `policySchema`. Add tests in `test/`.
2. **Container.** If the value can go to Sharp unchanged as `sharp.<name>(value)`, add the name to `SharpUtils.ALLOWED_TRANSFORMATIONS` (`src/services/image-processing/utils/sharp-utils.ts`); edits not on that list are skipped. If it needs reshaping first, add a case to `transformation-engine/transformation-mapper.ts`. If it needs special handling or ordering, add it to `transformation-engine/edit-applicator.ts`.
3. **Admin UI.** Add it to `src/constants/transformations.ts` so it appears in the policy editor, add its form to `src/components/transformationPolicy/TransformationConfigModal.tsx`, and add its UI limits to `src/utils/transformationValidation.ts`. To try it in the Playground, add a control in `src/components/playground/TransformationControls.tsx`.
4. **Management API.** Nothing to change. It validates with `validateTransformationPolicyCreate` and `validateTransformationPolicyUpdate`, which pick up the new schema.

Then run the tests in `data-models`, `container`, `admin-ui`, and `management-lambda`.

**Smart crop limits.** The caps at the top of `transformation-policy.ts` (`SMART_CROP_MAX_LABELS`, `SMART_CROP_MAX_LABEL_LENGTH`, and the custom model ARN rules) are repeated in the container's `src/services/smart-crop/smart-crop-parser.ts`. Change both together.

## Develop

```bash
cd source/data-models
npm test        # pretest deletes node_modules and runs npm ci
npm run build   # tsc
```

## Related

- [container](../container/README.md), [management-lambda](../management-lambda/README.md), [admin-ui](../admin-ui/README.md): the three consumers
- [source/README.md](../README.md): workspace install and the full package list
