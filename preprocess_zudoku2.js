#!/usr/bin/env node
/**
 * OpenAPI Preprocessor for Zudoku
 * Creates flat allOf structures without nesting
 * Also injects an internal + deprecated placeholder operation for tags
 * that exist in tags/x-tagGroups but are not used by any operation.
 */
const fs = require('fs');

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

function slugifyTag(tag) {
  return String(tag)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function preprocessForZudoku(inputFile, outputFile) {
  const spec = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

  spec.components = spec.components || {};
  spec.components.schemas = spec.components.schemas || {};
  spec.paths = spec.paths || {};

  // Flatten certain requestBody allOf patterns for Zudoku
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

  // Collect defined tags (from tags and x-tagGroups)
  const definedTags = new Set();

  for (const t of (spec.tags || [])) {
    if (t && typeof t === 'object' && t.name) definedTags.add(t.name);
  }

  for (const g of (spec['x-tagGroups'] || [])) {
    for (const t of ((g && g.tags) || [])) {
      if (typeof t === 'string') definedTags.add(t);
    }
  }

  // Collect used tags (from operations)
  const usedTags = new Set();

  for (const methods of Object.values(spec.paths || {})) {
    for (const op of Object.values(methods || {})) {
      if (op && Array.isArray(op.tags)) {
        for (const t of op.tags) usedTags.add(t);
      }
    }
  }

  // Inject placeholder operations for unused tags
  let injected = 0;

  for (const tag of definedTags) {
    if (usedTags.has(tag)) continue;

    const path = `/_zudoku/tags/${slugifyTag(tag) || 'tag'}`;
    if (!spec.paths[path]) spec.paths[path] = {};

    spec.paths[path].get = {
      tags: [tag],
      summary: `Zudoku placeholder for tag ${tag}`,
      description: 'Documentation only. Injected so Zudoku shows this tag in navigation.',
      deprecated: true,
      'x-internal': true,
      responses: {
        '204': { description: 'No content' }
      }
    };

    injected += 1;
  }

  fs.writeFileSync(outputFile, JSON.stringify(spec, null, 2));
  console.log(`✅ Zudoku version created: ${outputFile}`);
  console.log(`✅ Injected placeholder operations (internal + deprecated): ${injected}`);
}

if (require.main === module) {
  if (process.argv.length !== 4) {
    console.log('Usage: preprocess_zudoku.js <input.json> <output.json>');
    process.exit(1);
  }

  preprocessForZudoku(process.argv[2], process.argv[3]);
}

module.exports = { preprocessForZudoku };
