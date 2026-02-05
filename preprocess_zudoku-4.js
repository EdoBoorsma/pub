#!/usr/bin/env node
/**
 * OpenAPI Preprocessor for Zudoku
 * Creates flat allOf structures without nesting
 */
const fs = require('fs');

function safeSlug(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseSchemaRefFromDescription(desc) {
  if (!desc) return null;
  const m = String(desc).match(/<SchemaDefinition\s+schemaRef\s*=\s*"([^"]+)"\s*\/>/i)
    || String(desc).match(/<SchemaDefinition\s+schemaRef\s*=\s*"([^"]+)"\s*>/i);
  return m ? m[1] : null;
}

function schemaNameFromRef(ref) {
  const m = String(ref || '').match(/#\/components\/schemas\/(.+)$/);
  return m ? m[1] : null;
}

function isModelTag(tagName) {
  return typeof tagName === 'string' && tagName.endsWith('_model');
}

function isInjectedTextOnlyOperation(operation) {
  if (!operation || typeof operation !== 'object') return false;
  const summary = String(operation.summary || '').toLowerCase();
  const description = String(operation.description || '').toLowerCase();
  return (
    summary.includes('zudoku placeholder') ||
    description.includes('documentation only') ||
    description.includes('injected') ||
    description.includes('placeholder')
  );
}

function removeInjectedTextOnlyForModelTags(spec) {
  if (!spec.paths || typeof spec.paths !== 'object') return 0;

  const modelTags = new Set(
    (Array.isArray(spec.tags) ? spec.tags : [])
      .map(t => t && t.name)
      .filter(isModelTag)
  );

  let removed = 0;
  for (const [p, methods] of Object.entries(spec.paths)) {
    if (!p.startsWith('/_zudoku/')) continue;
    if (!methods || typeof methods !== 'object') continue;

    for (const [m, op] of Object.entries(methods)) {
      if (!op || typeof op !== 'object') continue;
      const opTags = Array.isArray(op.tags) ? op.tags : [];
      const hasModelTag = opTags.some(t => modelTags.has(t));
      if (!hasModelTag) continue;
      if (!isInjectedTextOnlyOperation(op)) continue;

      delete methods[m];
      removed += 1;
    }

    if (Object.keys(methods).length === 0) {
      delete spec.paths[p];
    }
  }

  return removed;
}

function injectModelOperations(spec) {
  if (!spec.paths || typeof spec.paths !== 'object') spec.paths = {};

  const tags = Array.isArray(spec.tags) ? spec.tags : [];
  let injected = 0;

  for (const t of tags) {
    if (!t || !isModelTag(t.name)) continue;

    const schemaRef = parseSchemaRefFromDescription(t.description);
    if (!schemaRef) continue;

    const schemaName = schemaNameFromRef(schemaRef);
    if (!schemaName) continue;

    const displayName = t['x-displayName'] || schemaName;
    const opPath = `/_zudoku/models/${safeSlug(displayName)}`;

    if (spec.paths[opPath]) continue;

    spec.paths[opPath] = {
      get: {
        summary: `Model: ${displayName}`,
        operationId: `zudokuModel_${safeSlug(t.name)}_${safeSlug(schemaName)}`,
        description: 'Documentation only. Injected so Zudoku renders this model schema.',
        tags: [t.name],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: schemaRef }
              }
            }
          }
        }
      }
    };

    t.description = `Model schema: ${displayName}`;
    injected += 1;
  }

  return injected;
}

function resolveRef(refPath, spec) {
  if (!refPath.startsWith('#/')) return null;

  const parts = refPath.substring(2).split('/');
  let current = spec;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }

  return current;
}

function getSchemaNameFromPath(path, method) {
  const cleanPath = path.replace(/\//g, ' ').replace(/-/g, ' ');
  const words = cleanPath.split(' ').filter(w => w);
  const schemaName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') +
                     method.charAt(0).toUpperCase() + method.slice(1) + 'Request';
  return schemaName;
}

function flattenAllOfForZudoku(schema, spec) {
  if (!schema.allOf) return null;

  const flatAllOf = [];
  const inlineProperties = {};
  let anyOfSection = null;
  const requiredFields = schema.required || [];

  for (const item of schema.allOf) {
    if (item.$ref) {
      const refSchema = resolveRef(item.$ref, spec);
      if (refSchema?.allOf) {
        for (const subItem of refSchema.allOf) {
          if (subItem.$ref) {
            flatAllOf.push(subItem);
          } else if (subItem.properties) {
            Object.assign(inlineProperties, subItem.properties);
            if (subItem.anyOf) {
              anyOfSection = subItem.anyOf;
              if (anyOfSection.length > 0 && !anyOfSection[0].title) {
                anyOfSection[0].title = 'With courseOfferingId';
              }
            }
          }
        }
      } else {
        flatAllOf.push(item);
      }
    } else if (item.properties) {
      Object.assign(inlineProperties, item.properties);
    }
  }

  const inlineObj = {
    type: 'object',
    properties: inlineProperties
  };

  if (anyOfSection) {
    inlineObj.anyOf = anyOfSection;
  }

  flatAllOf.push(inlineObj);

  const result = {
    type: 'object',
    allOf: flatAllOf
  };

  if (requiredFields.length > 0) {
    result.required = requiredFields;
  }

  return result;
}

function preprocessForZudoku(inputFile, outputFile) {
  const spec = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

  if (!spec.components || typeof spec.components !== 'object') spec.components = {};
  if (!spec.components.schemas || typeof spec.components.schemas !== 'object') {
    spec.components.schemas = {};
  }

  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (typeof operation !== 'object') continue;

      const requestBody = operation.requestBody?.content?.['application/json']?.schema;
      if (!requestBody) continue;

      if (requestBody.allOf) {
        const flattened = flattenAllOfForZudoku(requestBody, spec);
        if (flattened) {
          const schemaName = getSchemaNameFromPath(path, method);
          spec.components.schemas[schemaName] = flattened;

          operation.requestBody.content['application/json'].schema = {
            $ref: `#/components/schemas/${schemaName}`
          };
        }
      }
    }
  }

  const removedTextOnly = removeInjectedTextOnlyForModelTags(spec);
  const injectedModels = injectModelOperations(spec);

  fs.writeFileSync(outputFile, JSON.stringify(spec, null, 2));
  if (removedTextOnly > 0) {
    console.log(`🧹 Removed injected model text only operations: ${removedTextOnly}`);
  }
  if (injectedModels > 0) {
    console.log(`🧩 Injected model operations: ${injectedModels}`);
  }
  console.log(`✅ Zudoku version created: ${outputFile}`);
}

if (require.main === module) {
  if (process.argv.length !== 4) {
    console.log('Usage: preprocess_zudoku.js <input.json> <output.json>');
    process.exit(1);
  }

  preprocessForZudoku(process.argv[2], process.argv[3]);
}

module.exports = { preprocessForZudoku };
