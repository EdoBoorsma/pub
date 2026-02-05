import type { ZudokuBuildConfig } from "zudoku";

async function expandSchemaDefinitionTags({ schema }) {
  if (!schema || !schema.tags || !schema.paths) {
    return schema;
  }
  
  let aantalToegevoegd = 0;
  
  schema.tags.forEach((tag) => {
    const desc = tag.description || '';
    
    if (desc.includes('SchemaDefinition')) {
      const match = desc.match(/schemaRef="([^"]+)"/);
      
      if (match) {
        const schemaRef = match[1];
        const schemaName = schemaRef.split('/').pop();
        
        const dummyPath = `/_models/${schemaName}`;
        
        schema.paths[dummyPath] = {
          get: {
            summary: tag['x-displayName'] || schemaName,
            description: '',
            tags: [tag.name],
            operationId: `schema_${schemaName}`,
            'x-schema-only': true,  // Marker voor CSS
            responses: {
              '200': {
                description: '',
                content: {
                  'application/json': {
                    schema: { $ref: schemaRef }
                  }
                }
              }
            }
          }
        };
        
        aantalToegevoegd++;
      }
    }
  });
  
  console.log(`✅ ${aantalToegevoegd} schemas toegevoegd\n`);
  
  return schema;
}

const buildConfig: ZudokuBuildConfig = {
  processors: [expandSchemaDefinitionTags]
};

export default buildConfig;
