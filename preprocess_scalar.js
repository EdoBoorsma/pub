#!/usr/bin/env node
/**
 * OpenAPI Preprocessor for Scalar
 * Flattens nested allOf schemas to simple properties objects
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

function flattenAllOf(schema, spec) {
  if (!schema.allOf) return null;

  const allProperties = {};
  const allRequired = new Set(schema.required || []);
  let anyOfSection = null;

  for (const item of schema.allOf) {
    if (item.$ref) {
      const refSchema = resolveRef(item.$ref, spec);
      if (refSchema) {
        if (refSchema.allOf) {
          for (const subItem of refSchema.allOf) {
            if (subItem.$ref) {
              const subRefSchema = resolveRef(subItem.$ref, spec);
              if (subRefSchema?.properties) {
                Object.assign(allProperties, subRefSchema.properties);
              }
              if (subRefSchema?.required) {
                subRefSchema.required.forEach(r => allRequired.add(r));
              }
            } else if (subItem.properties) {
              Object.assign(allProperties, subItem.properties);
              if (subItem.anyOf) {
                anyOfSection = subItem.anyOf;
                if (anyOfSection.length > 0 && !anyOfSection[0].title) {
                  anyOfSection[0].title = 'With courseOfferingId';
                }
              }
            }
          }
        } else if (refSchema.properties) {
          Object.assign(allProperties, refSchema.properties);
          if (refSchema.required) {
            refSchema.required.forEach(r => allRequired.add(r));
          }
        }
      }
    } else if (item.properties) {
      Object.assign(allProperties, item.properties);
    }
  }

  const result = {
    type: 'object',
    properties: allProperties
  };

  if (allRequired.size > 0) {
    result.required = Array.from(allRequired).sort();
  }

  if (anyOfSection) {
    result.anyOf = anyOfSection;
  }

  return result;
}

function preprocessForScalar(inputFile, outputFile) {
  const spec = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (typeof operation !== 'object') continue;

      const requestBody = operation.requestBody?.content?.['application/json']?.schema;
      if (!requestBody) continue;

      if (requestBody.allOf) {
        const flattened = flattenAllOf(requestBody, spec);
        if (flattened) {
          operation.requestBody.content['application/json'].schema = flattened;
        }
      }
    }
  }

  fs.writeFileSync(outputFile, JSON.stringify(spec, null, 2));
  console.log(`✅ Scalar version created: ${outputFile}`);
}

if (require.main === module) {
  if (process.argv.length !== 4) {
    console.log('Usage: preprocess_scalar.js <input.json> <output.json>');
    process.exit(1);
  }

  preprocessForScalar(process.argv[2], process.argv[3]);
}

module.exports = { preprocessForScalar };
