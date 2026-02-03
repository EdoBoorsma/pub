#!/usr/bin/env node
/**
 * OpenAPI Preprocessor for Zudoku
 * Creates flat allOf structures without nesting
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

function preprocessForZudoku(inputFile, outputFile) {
  const spec = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

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

  fs.writeFileSync(outputFile, JSON.stringify(spec, null, 2));
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
