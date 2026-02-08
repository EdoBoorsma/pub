#!/usr/bin/env node

/**
 * OpenAPI Preprocessor for Spotlight
 * - Flattens allOf structures in requestBody schemas
 * - Generates examples from schema properties for responses without examples
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

function flattenAllOf(schema, spec) {
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
          }
          if (subItem.anyOf) {
            anyOfSection = subItem.anyOf;
            if (anyOfSection.length > 0 && !anyOfSection[0].title) {
              anyOfSection[0].title = 'With courseOfferingId';
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

function generateExampleFromSchema(schema, spec, seenRefs = [], depth = 0) {
  if (!schema) return null;

  // Prevent too deep nesting
  if (depth > 15) return null;

  // Resolve $ref if present
  if (schema.$ref) {
    const refCount = seenRefs.filter(r => r === schema.$ref).length;

    if (refCount >= 1 && depth > 3) {
      return null; // Skip deep circular references
    }

    if (refCount >= 2) {
      return null; // Never allow more than 2 levels deep
    }

    const newSeenRefs = [...seenRefs, schema.$ref];
    const resolved = resolveRef(schema.$ref, spec);
    if (resolved) {
      return generateExampleFromSchema(resolved, spec, newSeenRefs, depth + 1);
    }
    return null;
  }

  if (schema.example !== undefined) {
    return schema.example;
  }

  // Handle allOf - merge all properties
  if (schema.allOf) {
    const merged = {};
    for (const subSchema of schema.allOf) {
      const subExample = generateExampleFromSchema(subSchema, spec, seenRefs, depth + 1);
      if (subExample && typeof subExample === 'object' && !Array.isArray(subExample)) {
        Object.assign(merged, subExample);
      }
    }
    return Object.keys(merged).length > 0 ? merged : null;
  }

  // Handle oneOf - take first option
  if (schema.oneOf && schema.oneOf.length > 0) {
    return generateExampleFromSchema(schema.oneOf[0], spec, seenRefs, depth + 1);
  }

  // Handle anyOf - take first option
  if (schema.anyOf && schema.anyOf.length > 0) {
    return generateExampleFromSchema(schema.anyOf[0], spec, seenRefs, depth + 1);
  }

  // Handle type as array (e.g., ["null", "object"])
  let type = schema.type;
  if (Array.isArray(type)) {
    const nonNullTypes = type.filter(t => t !== 'null');
    type = nonNullTypes.length > 0 ? nonNullTypes[0] : type[0];
  }

  if (type === 'array') {
    if (schema.items) {
      const itemExample = generateExampleFromSchema(schema.items, spec, seenRefs, depth + 1);
      if (itemExample !== null && depth < 4) {
        return [itemExample];
      }
    }
    return [];
  }

  if (type === 'object' || schema.properties) {
    const example = {};
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        const value = generateExampleFromSchema(prop, spec, seenRefs, depth + 1);
        if (value !== null) {
          example[key] = value;
        }
      }
    }
    return Object.keys(example).length > 0 ? example : null;
  }

  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }

  if (schema.default !== undefined) {
    return schema.default;
  }

  switch (type) {
    case 'string':
      return schema.format === 'date-time' ? '2024-01-01T00:00:00Z' :
             schema.format === 'date' ? '2024-01-01' :
             schema.format === 'email' ? 'user@example.com' :
             schema.format === 'uri' ? 'https://example.com' :
             schema.format === 'uuid' ? '123e4567-e89b-12d3-a456-426614174000' :
             'string';
    case 'number':
      return 0;
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'null':
      return null;
    default:
      return null;
  }
}

function addExamplesToResponses(spec) {
  let addedCount = 0;
  let totalResponses = 0;
  let hasExample = 0;
  let noSchema = 0;
  let emptyGenerated = 0;
  let debugDetails = [];

  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (typeof operation !== 'object') continue;

      if (operation.responses) {
        for (const [status, response] of Object.entries(operation.responses)) {
          if (!response || typeof response !== 'object') continue;

          if (response.content) {
            for (const [mediaType, content] of Object.entries(response.content)) {
              if (!content || typeof content !== 'object') continue;

              totalResponses++;

              if (content.example || content.examples) {
                hasExample++;
                continue;
              }

              if (!content.schema) {
                noSchema++;
                continue;
              }

              const generated = generateExampleFromSchema(content.schema, spec, []);

              if (!generated || (typeof generated === 'object' && Object.keys(generated).length === 0)) {
                emptyGenerated++;
                debugDetails.push({
                  path: `${method.toUpperCase()} ${path} (${status})`,
                  schema: content.schema.$ref || 'inline',
                  generated: generated
                });
                continue;
              }

              content.example = generated;
              addedCount++;
            }
          }
        }
      }
    }
  }

  console.log(`\n📊 Response analysis:`);
  console.log(`  Total responses with content: ${totalResponses}`);
  console.log(`  Already had examples: ${hasExample}`);
  console.log(`  No schema: ${noSchema}`);
  console.log(`  Generated empty (failed): ${emptyGenerated}`);
  console.log(`  ✅ Added examples: ${addedCount}`);

  if (debugDetails.length > 0) {
    console.log(`\n⚠️  First 5 failed generations:`);
    for (let i = 0; i < Math.min(5, debugDetails.length); i++) {
      console.log(`  - ${debugDetails[i].path}`);
      console.log(`    Schema: ${debugDetails[i].schema}`);
      console.log(`    Generated: ${JSON.stringify(debugDetails[i].generated)}`);
    }
  }

  return addedCount;
}

function preprocessForSpotlight(inputFile, outputFile) {
  const spec = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

  spec.components = spec.components || {};
  spec.components.schemas = spec.components.schemas || {};
  spec.paths = spec.paths || {};

  // Flatten certain requestBody allOf patterns
  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (typeof operation !== 'object') continue;

      const requestBody = operation.requestBody?.content?.['application/json']?.schema;
      if (!requestBody) continue;

      if (requestBody.allOf) {
        const flattened = flattenAllOf(requestBody, spec);
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

  // Add examples to responses without examples
  const addedExamples = addExamplesToResponses(spec);

  fs.writeFileSync(outputFile, JSON.stringify(spec, null, 2));
  console.log(`\n✅ Spotlight version created: ${outputFile}`);
  console.log(`✅ Total examples added: ${addedExamples}`);
}

if (require.main === module) {
  if (process.argv.length !== 4) {
    console.log('Usage: preprocess_spotlight.js <input.json> <output.json>');
    process.exit(1);
  }
  preprocessForSpotlight(process.argv[2], process.argv[3]);
}

module.exports = { preprocessForSpotlight };
